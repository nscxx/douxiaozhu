const TOKEN_KEY = 'dxz_worker_token';
let user = null;
let tab = 'claimable';
let current = null;

const api = {
  token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  async request(method, url, body, isForm) {
    const headers = {};
    if (this.token()) headers.Authorization = 'Bearer ' + this.token();
    if (!isForm) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method, headers, body: isForm ? body : (body ? JSON.stringify(body) : undefined) });
    const data = await res.json();
    if (res.status === 401) { logout(); throw new Error('请重新登录'); }
    if (data.code !== 0) throw new Error(data.msg || '请求失败');
    return data.data;
  },
  get(u) { return this.request('GET', u); },
  post(u, b) { return this.request('POST', urlFix(u), b); }
};
function urlFix(u) { return u; }

function show(id) {
  ['loginView', 'appView', 'detailView'].forEach((x) => document.getElementById(x).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

async function login() {
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try {
    const data = await api.request('POST', '/api/auth/login', {
      username: document.getElementById('loginUser').value.trim(),
      password: document.getElementById('loginPass').value
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    user = data.user;
    document.getElementById('who').textContent = user.name + ' · ' + user.role;
    show('appView');
    loadList();
  } catch (e) { err.textContent = e.message; }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  user = null;
  show('loginView');
}

function switchTab(next) {
  tab = next;
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === next));
  loadList();
}

async function loadList() {
  const stats = await api.get('/api/worker/stats');
  document.getElementById('stats').innerHTML = `
    <div class="stat"><b>${stats.claimable || 0}</b><span>待领取</span></div>
    <div class="stat"><b>${stats.doing || 0}</b><span>进行中</span></div>
    <div class="stat"><b>${stats.auditing || 0}</b><span>审核中</span></div>
    <div class="stat"><b>${stats.passed || 0}</b><span>已通过</span></div>`;
  const data = await api.get('/api/worker/tasks?tab=' + tab + '&page_size=50');
  const list = document.getElementById('list');
  if (!data.items.length) {
    list.innerHTML = '<div class="empty">暂无任务</div>';
    return;
  }
  list.innerHTML = data.items.map((item) => `
    <div class="card" onclick="openDetail(${item.id})">
      <h4>${esc(item.movie_name || '未命名')} · ${esc(item.type)}</h4>
      <div class="meta">${esc(item.account_name || '')} · ${esc(item.status)}</div>
    </div>`).join('');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function openDetail(id) {
  let item;
  try {
    item = await api.get('/api/contents/' + id);
  } catch {
    item = null;
  }
  if (!item) return alert('任务不存在');
  current = item;
  const canClaim = item.status === '待领取';
  const canSubmit = ['已领取', '待发布', '已拒绝'].includes(item.status) && item.worker_id === user.id;
  document.getElementById('detailView').innerHTML = `
    <header><button class="ghost" onclick="backList()">← 返回</button><div class="title">任务详情</div><span></span></header>
    <div class="card">
      <h4>${esc(item.movie_name)} · ${esc(item.type)}</h4>
      <div class="meta">账号 ${esc(item.account_name)} · ${esc(item.status)}</div>
      <p class="meta">请自行登录对应豆瓣账号，粘贴下文发布。系统不会代发。</p>
      <div class="copy-box" id="copyText">${esc(item.content || '（待生成）')}</div>
      <div class="row">
        <button class="btn" onclick="copyText()">复制文案</button>
        ${canClaim ? `<button class="primary" onclick="claim(${item.id})">领取任务</button>` : ''}
      </div>
    </div>
    ${canSubmit ? `<div class="card">
      <h4>提交凭证</h4>
      <input id="pubUrl" placeholder="豆瓣发布链接">
      <input id="shot" type="file" accept="image/*">
      <img class="preview hidden" id="shotPreview">
      <button class="primary" onclick="submitCred(${item.id})">上传凭证</button>
    </div>` : ''}
  `;
  show('detailView');
  const file = document.getElementById('shot');
  if (file) file.onchange = () => {
    const f = file.files[0];
    if (!f) return;
    const img = document.getElementById('shotPreview');
    img.src = URL.createObjectURL(f);
    img.classList.remove('hidden');
  };
}

function backList() { show('appView'); loadList(); }

async function claim(id) {
  try {
    await api.post('/api/contents/' + id + '/claim');
    alert('领取成功');
    tab = 'mine';
    show('appView');
    document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === 'mine'));
    await loadList();
    openDetail(id);
  } catch (e) { alert(e.message); }
}

function copyText() {
  const t = document.getElementById('copyText').innerText;
  navigator.clipboard.writeText(t).then(() => alert('已复制，请到豆瓣粘贴发布'));
}

async function submitCred(id) {
  const published_url = document.getElementById('pubUrl').value.trim();
  const file = document.getElementById('shot').files[0];
  if (!published_url || !file) return alert('链接和截图都必填');
  const fd = new FormData();
  fd.append('file', file);
  const up = await api.request('POST', '/api/upload', fd, true);
  await api.post('/api/contents/' + id + '/credential', {
    published_url,
    image_path: up.path
  });
  alert('凭证已提交，等待 AI 预审与管理员终审');
  backList();
}

(async function boot() {
  if (!api.token()) return;
  try {
    user = await api.get('/api/auth/me');
    document.getElementById('who').textContent = user.name;
    show('appView');
    loadList();
  } catch { /* stay on login */ }
})();
