const API_BASE = '';
const TOKEN_KEY = 'dxz_token';

const state = {
  user: null,
  page: 'home',
  tagsTree: { A: [], B: [], C: [], D: [] },
  wizard: { step: 1, movies: [], accounts: [], types: { 短评: 1, 影评: 1, 讨论: 0, 小组: 0 }, timeSlot: '' },
  calendar: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, selected: null }
};

const TITLES = {
  home: '数据看板', calendar: '任务日历', accounts: '全局账号', tags: '人设库',
  ai: 'AI创作', credentials: '审核凭证', movies: '电影管理', logs: '操作日志',
  analytics: '数据分析', settings: '系统设置'
};

const api = {
  token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  async request(method, url, body, isForm) {
    const headers = {};
    if (this.token()) headers.Authorization = 'Bearer ' + this.token();
    if (!isForm) headers['Content-Type'] = 'application/json';
    const res = await fetch(API_BASE + url, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined)
    });
    const data = await res.json().catch(() => ({ code: 500, msg: '服务器无响应' }));
    if (res.status === 401) {
      logout(true);
      throw new Error(data.msg || '未登录');
    }
    if (data.code !== 0) throw new Error(data.msg || '请求失败');
    return data.data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); }
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusClass(s) {
  if (['活跃', '已通过', '已完成', '启用'].includes(s)) return 'active';
  if (['已拒绝', '异常', '停用'].includes(s)) return 'error';
  if (['待终审', '待AI审核', '待领取', '已领取', '待生成', '待执行', '预警'].includes(s)) return 'inactive';
  return 'info';
}

function toast(msg) { alert(msg); }

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  try {
    const data = await api.post('/api/auth/login', { username, password });
    if (data.user.role === 'worker') {
      err.textContent = '执行者请使用小程序/H5 端';
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    state.user = data.user;
    showApp();
  } catch (e) {
    err.textContent = e.message;
  }
}

function logout(silent) {
  localStorage.removeItem(TOKEN_KEY);
  state.user = null;
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('loginOverlay').classList.remove('hidden');
  if (!silent) location.reload();
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('open');
}

function showApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('appRoot').style.display = 'flex';
  document.getElementById('userAvatar').textContent = (state.user.name || '管').slice(0, 1);
  document.getElementById('userMeta').textContent = `${state.user.name}（${state.user.role}）`;
  switchPage(state.page || 'home');
}

function switchPage(pageId) {
  state.page = pageId;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (!page) return;
  page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  const nav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
  if (nav) nav.classList.add('active');
  document.getElementById('currentPageTitle').textContent = TITLES[pageId] || pageId;
  const loaders = {
    home: renderHome, calendar: renderCalendar, accounts: renderAccounts, tags: renderTags,
    ai: renderAI, credentials: renderCredentials, movies: renderMovies, logs: renderLogs,
    analytics: renderAnalytics, settings: renderSettings
  };
  if (loaders[pageId]) loaders[pageId]();
}

document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

function openModal(html) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal">${html}</div>`;
  root.classList.add('active');
  root.onclick = (e) => { if (e.target === root) closeModal(); };
}
function closeModal() {
  const root = document.getElementById('modalRoot');
  root.classList.remove('active');
  root.innerHTML = '';
}

function pager(total, page, pageSize, onChange) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="pagination"><span>共 ${total} 条</span>
    <div>${page > 1 ? `<button class="btn" data-p="${page - 1}">上一页</button>` : ''}
    <span> ${page} / ${pages} </span>
    ${page < pages ? `<button class="btn" data-p="${page + 1}">下一页</button>` : ''}</div></div>`;
}

async function renderHome() {
  const el = document.getElementById('page-home');
  const d = await api.get('/api/dashboard');
  document.getElementById('badgeAccounts').textContent = d.accounts.total;
  document.getElementById('badgeCreds').textContent = d.credentials.pending;
  const h = d.health;
  const totalAcc = d.accounts.total || 1;
  const pending = d.pending_list.map((item) => `
    <div class="task-item">
      <div class="task-status pending"></div>
      <div class="task-info">
        <div class="task-name">${esc(item.account_name || '')} · ${esc(item.movie_name || '')} · ${esc(item.content_type || item.content_type_full || '')}</div>
        <div class="task-meta">AI预审 ${esc(item.ai_status || '待审')} · ${esc(item.status)}</div>
      </div>
      <button class="task-action" onclick="openCred(${item.id})">审核</button>
    </div>`).join('') || '<div class="empty-hint">暂无待审核凭证</div>';
  const trend = (d.trend || []).map((t, i) => {
    const max = Math.max(...d.trend.map((x) => x.count), 1);
    return `<div class="line-chart-bar" style="flex:1;text-align:center;">
      <div class="line-chart-value">${t.count}</div>
      <div class="line-chart-column" style="height:${Math.max(8, (t.count / max) * 110)}px;background:#52c41a;border-radius:4px;margin:8px auto;width:18px;"></div>
      <div class="line-chart-label">D-${t.date_offset}</div>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="tip-bar">系统运行正常 | 账号 ${d.accounts.total} | 待审核 ${d.credentials.pending} | 发布通过率 ${d.credentials.pass_rate}%</div>
    <div class="stats-grid">
      ${statCard('账号总数', d.accounts.total, `活跃 ${d.accounts.active}`)}
      ${statCard('今日生成', d.contents.today_generated, `待领取 ${d.contents.claimable}`)}
      ${statCard('今日通过', d.contents.today_published, `通过率 ${d.credentials.pass_rate}%`)}
      ${statCard('待审核凭证', d.credentials.pending, '需处理')}
    </div>
    <div class="two-column">
      <div class="card">
        <div class="card-header"><span class="card-title">快速操作</span></div>
        <div class="card-body quick-actions">
          <div class="quick-action-btn" onclick="openTaskWizard()"><div class="quick-action-icon">＋</div><div class="quick-action-text"><h4>创建任务</h4><p>电影 × 账号拆出内容行</p></div></div>
          <div class="quick-action-btn" onclick="switchPage('ai')"><div class="quick-action-icon">✨</div><div class="quick-action-text"><h4>AI 生成</h4><p>写入待领取池</p></div></div>
          <div class="quick-action-btn" onclick="switchPage('credentials')"><div class="quick-action-icon">📋</div><div class="quick-action-text"><h4>去终审</h4><p>AI预审 + 人工</p></div></div>
          <div class="quick-action-btn" onclick="switchPage('accounts')"><div class="quick-action-icon">👤</div><div class="quick-action-text"><h4>账号管理</h4><p>人设与健康度</p></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">待审核凭证</span><span style="font-size:13px;color:#52c41a;cursor:pointer;" onclick="switchPage('credentials')">查看全部 →</span></div>
        <div class="card-body"><div class="task-list">${pending}</div></div>
      </div>
    </div>
    <div class="two-column" style="margin-top:20px;">
      <div class="card">
        <div class="card-header"><span class="card-title">账号健康度</span></div>
        <div class="card-body">
          <div>健康 ${h.healthy}（${((h.healthy / totalAcc) * 100).toFixed(1)}%）</div>
          <div>预警 ${h.warning}　异常 ${h.abnormal}　低健康 ${h.banned}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">近 7 日产出</span></div>
        <div class="card-body" style="display:flex;align-items:flex-end;gap:8px;height:160px;">${trend}</div>
      </div>
    </div>`;
}
function statCard(label, value, trend) {
  return `<div class="stat-card"><div class="stat-header"><span class="stat-label">${label}</span></div>
    <div class="stat-value">${value}</div><div class="stat-trend">${esc(trend)}</div></div>`;
}

async function renderCalendar() {
  const el = document.getElementById('page-calendar');
  const { year, month } = state.calendar;
  const data = await api.get(`/api/tasks/calendar?year=${year}&month=${month}`);
  const byDay = {};
  (data.days || []).forEach((d) => { byDay[d.day] = d; });
  const first = new Date(year, month - 1, 1);
  const startWeek = (first.getDay() + 6) % 7;
  const dim = new Date(year, month, 0).getDate();
  let cells = '';
  for (let i = 0; i < startWeek; i += 1) cells += '<div></div>';
  for (let d = 1; d <= dim; d += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const info = byDay[key] || { total: 0, completed: 0, pending: 0 };
    const sel = state.calendar.selected === key ? 'active' : '';
    const donePct = info.total ? (info.completed / info.total) * 100 : 0;
    const pendPct = info.total ? (info.pending / info.total) * 100 : 0;
    cells += `<div class="cal-cell ${sel}" onclick="selectCalDay('${key}')">
      <div class="d">${d}</div>
      <div style="font-size:11px;color:#999;">${info.total ? info.total + ' 任务' : ''}</div>
      <div class="progress-mini"><div class="done" style="width:${donePct}%"></div><div class="pend" style="width:${pendPct}%"></div></div>
    </div>`;
  }
  const selected = state.calendar.selected;
  const items = (data.items || []).filter((t) => !selected || String(t.created_at).startsWith(selected));
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${year}年${month}月</span>
        <div>
          <button class="btn" onclick="shiftMonth(-1)">‹</button>
          <button class="btn" onclick="shiftMonth(1)">›</button>
          <button class="btn btn-primary" onclick="openTaskWizard()">创建任务</button>
        </div>
      </div>
      <div class="card-body">
        <div class="calendar-grid" style="margin-bottom:8px;color:#999;font-size:12px;">${['一','二','三','四','五','六','日'].map((x)=>`<div>${x}</div>`).join('')}</div>
        <div class="calendar-grid">${cells}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-header"><span class="card-title">任务列表 ${selected || ''}</span>
        <button class="btn" onclick="batchGenerateAll()">生成全部待生成</button></div>
      <div class="table-container"><table><thead><tr>
        <th>任务</th><th>电影</th><th>账号</th><th>状态</th><th>内容</th><th>操作</th>
      </tr></thead><tbody>
        ${items.map((t) => `<tr>
          <td>${esc(t.name)}</td><td>${esc(t.movie_name)}</td><td>${esc(t.account_name)}</td>
          <td><span class="status-badge ${statusClass(t.status)}">${esc(t.status)}</span></td>
          <td>${t.content_done || 0}/${t.content_total || 0}</td>
          <td><button class="action-btn" onclick="generateTask(${t.id})">生成</button>
              <button class="action-btn danger" onclick="delTask(${t.id})">删除</button></td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">暂无任务</td></tr>'}
      </tbody></table></div>
    </div>`;
}
function shiftMonth(delta) {
  let { year, month } = state.calendar;
  month += delta;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  state.calendar = { year, month, selected: null };
  renderCalendar();
}
function selectCalDay(key) {
  state.calendar.selected = key;
  renderCalendar();
}
async function generateTask(id) {
  try {
    const data = await api.post(`/api/tasks/${id}/generate`);
    toast(data && data.count != null ? `已生成 ${data.count} 条` : '生成完成');
    renderCalendar();
  } catch (e) { toast(e.message); }
}
async function delTask(id) {
  if (!confirm('删除任务及下属内容？')) return;
  await api.del('/api/tasks/' + id);
  renderCalendar();
}
async function batchGenerateAll() {
  const data = await api.post('/api/ai/batch-generate', {});
  toast(`已生成 ${data.count} 条`);
  renderCalendar();
}

async function renderAccounts() {
  const el = document.getElementById('page-accounts');
  const keyword = document.getElementById('accKeyword')?.value || '';
  const status = document.getElementById('accStatus')?.value || '';
  const q = new URLSearchParams({ page_size: 100, keyword, status });
  const data = await api.get('/api/accounts?' + q.toString());
  document.getElementById('badgeAccounts').textContent = data.total;
  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box"><span>🔍</span><input id="accKeyword" value="${esc(keyword)}" placeholder="搜索账号" onkeydown="if(event.key==='Enter')renderAccounts()"></div>
        <select class="filter-select" id="accStatus" onchange="renderAccounts()">
          <option value="">全部状态</option>
          ${['活跃','待激活','预警','异常'].map((s) => `<option ${s===status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn" onclick="openBatchAccount()">批量导入</button>
        <button class="btn btn-primary" onclick="openAccountModal()">＋ 新建账号</button>
      </div>
    </div>
    <div class="card"><div class="table-container"><table><thead><tr>
      <th>ID</th><th>名称</th><th>登录账号</th><th>人设</th><th>状态</th><th>内容数</th><th>健康度</th><th>操作</th>
    </tr></thead><tbody>
      ${data.items.map((a) => {
        const tags = [...(a.a_tags||[]), ...(a.b_tags||[]), a.c_tag, a.d_tag].filter(Boolean);
        return `<tr>
          <td>${a.id}</td><td>${esc(a.name)}</td><td>${esc(a.login_account)}</td>
          <td><div class="tag-group">${tags.map((t,i)=>`<span class="tag ${i===0?'highlight':''}">${esc(t)}</span>`).join('')}</div></td>
          <td><span class="status-badge ${statusClass(a.status)}">${esc(a.status)}</span></td>
          <td>${a.content_count}</td><td>${a.health}%</td>
          <td><button class="action-btn" onclick="openAccountModal(${a.id})">编辑</button>
              <button class="action-btn danger" onclick="delAccount(${a.id})">删除</button></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="empty-hint">暂无账号</td></tr>'}
    </tbody></table></div></div>`;
}

async function openAccountModal(id) {
  const tags = await api.get('/api/tags/grouped');
  state.tagsTree = tags.tree;
  const acc = id ? await api.get('/api/accounts/' + id) : {
    name: '', login_account: '', douban_uid: '', remark: '', status: '活跃', a_tags: [], b_tags: [], c_tag: '', d_tag: ''
  };
  const chipGroup = (list, selected, multi, field) => list.map((t) => {
    const sel = multi ? (selected || []).includes(t.name) : selected === t.name;
    return `<span class="chip ${sel ? 'selected' : ''}" data-field="${field}" data-multi="${multi}" data-name="${esc(t.name)}" onclick="toggleChip(this)">${esc(t.name)}</span>`;
  }).join('');
  const aLeaves = tags.tree.A.flatMap((p) => p.children);
  const bLeaves = tags.tree.B.flatMap((p) => p.children);
  const cLeaves = tags.tree.C.flatMap((p) => p.children);
  const dLeaves = tags.tree.D.flatMap((p) => p.children);
  openModal(`
    <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;">
      <span class="modal-title">${id ? '编辑账号' : '新建账号'}</span>
      <div class="modal-close" onclick="closeModal()" style="cursor:pointer;">×</div>
    </div>
    <div class="modal-body" style="padding:20px;">
      <div class="form-grid">
        <div class="form-item"><label class="form-label">账号名称 *</label><input id="accName" class="form-input" value="${esc(acc.name)}"></div>
        <div class="form-item"><label class="form-label">登录邮箱/手机</label><input id="accLogin" class="form-input" value="${esc(acc.login_account)}"></div>
        <div class="form-item"><label class="form-label">豆瓣 UID</label><input id="accUid" class="form-input" value="${esc(acc.douban_uid)}"></div>
        <div class="form-item"><label class="form-label">状态</label>
          <select id="accSt" class="form-select">${['活跃','待激活','预警','异常'].map((s)=>`<option ${acc.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="form-item full"><label class="form-label">A 标签</label><div id="chipsA">${chipGroup(aLeaves, acc.a_tags, true, 'a')}</div></div>
        <div class="form-item full"><label class="form-label">B 标签</label><div id="chipsB">${chipGroup(bLeaves, acc.b_tags, true, 'b')}</div></div>
        <div class="form-item full"><label class="form-label">C 标签</label><div id="chipsC">${chipGroup(cLeaves, acc.c_tag, false, 'c')}</div></div>
        <div class="form-item full"><label class="form-label">D 标签</label><div id="chipsD">${chipGroup(dLeaves, acc.d_tag, false, 'd')}</div></div>
        <div class="form-item full"><label class="form-label">备注</label><textarea id="accRemark" class="form-textarea">${esc(acc.remark)}</textarea></div>
      </div>
    </div>
    <div class="modal-footer" style="padding:16px 20px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveAccount(${id || 'null'})">保存</button>
    </div>`);
}
function toggleChip(el) {
  const multi = el.dataset.multi === 'true';
  if (!multi) {
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
  }
  el.classList.toggle('selected');
}
function selectedChips(field) {
  return [...document.querySelectorAll(`.chip[data-field="${field}"].selected`)].map((c) => c.dataset.name);
}
async function saveAccount(id) {
  const body = {
    name: document.getElementById('accName').value.trim(),
    login_account: document.getElementById('accLogin').value.trim(),
    douban_uid: document.getElementById('accUid').value.trim(),
    status: document.getElementById('accSt').value,
    remark: document.getElementById('accRemark').value,
    a_tags: selectedChips('a'),
    b_tags: selectedChips('b'),
    c_tag: selectedChips('c')[0] || '',
    d_tag: selectedChips('d')[0] || ''
  };
  if (!body.name) return toast('请填写账号名称');
  if (id) await api.put('/api/accounts/' + id, body);
  else await api.post('/api/accounts', body);
  closeModal();
  renderAccounts();
}
async function delAccount(id) {
  if (!confirm('确定删除该账号？')) return;
  await api.del('/api/accounts/' + id);
  renderAccounts();
}
function openBatchAccount() {
  openModal(`
    <div style="padding:20px;">
      <h3>批量导入账号</h3>
      <p style="font-size:13px;color:#999;">每行一个：名称,登录账号,豆瓣UID</p>
      <textarea id="batchAcc" class="form-textarea" style="min-height:180px;" placeholder="小鱼儿,a@x.com,123456"></textarea>
      <div style="margin-top:12px;text-align:right;">
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitBatchAccount()">导入</button>
      </div>
    </div>`);
}
async function submitBatchAccount() {
  const lines = document.getElementById('batchAcc').value.split('\n').map((l) => l.trim()).filter(Boolean);
  const accounts = lines.map((l) => {
    const [name, login_account, douban_uid] = l.split(',').map((x) => (x || '').trim());
    return { name, login_account, douban_uid };
  }).filter((a) => a.name);
  if (!accounts.length) return toast('没有有效行');
  const data = await api.post('/api/accounts/batch', { accounts });
  toast(data.count ? `导入 ${data.count} 个` : '完成');
  closeModal();
  renderAccounts();
}

async function renderMovies() {
  const el = document.getElementById('page-movies');
  const keyword = document.getElementById('mvKeyword')?.value || '';
  const data = await api.get('/api/movies?page_size=100&keyword=' + encodeURIComponent(keyword));
  const grads = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)'
  ];
  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left"><div class="search-box"><span>🔍</span>
        <input id="mvKeyword" value="${esc(keyword)}" placeholder="搜索电影" onkeydown="if(event.key==='Enter')renderMovies()"></div></div>
      <div class="toolbar-right">
        <button class="btn" onclick="openBatchMovie()">批量导入</button>
        <button class="btn btn-primary" onclick="openMovieModal()">＋ 添加电影</button>
        <button class="btn" onclick="openTaskWizard()">从电影创建任务</button>
      </div>
    </div>
    <div class="movie-grid">
      ${data.items.map((m, i) => `
        <div class="movie-card" onclick="openMovieModal(${m.id})">
          <div class="movie-card-poster" style="background:${grads[i % grads.length]}">🎬</div>
          <div class="movie-card-body">
            <div class="movie-card-title">${esc(m.name)}</div>
            <div class="movie-card-meta">${esc(m.type)} · ${esc(m.year)} · ${esc(m.director)}</div>
            <div class="movie-card-footer" style="margin-top:8px;font-size:12px;color:#999;">⭐ ${m.score}　📝 ${m.comments}</div>
          </div>
        </div>`).join('') || '<div class="empty-hint" style="grid-column:1/-1;">暂无电影</div>'}
    </div>`;
}
async function openMovieModal(id) {
  const m = id ? await api.get('/api/movies/' + id) : { name: '', type: '', year: '', director: '', score: 0, comments: 0, tags: [], douban_url: '' };
  openModal(`
    <div style="padding:20px;">
      <h3>${id ? '编辑电影' : '添加电影'}</h3>
      <div class="form-grid">
        <div class="form-item"><label class="form-label">名称 *</label><input id="mvName" class="form-input" value="${esc(m.name)}"></div>
        <div class="form-item"><label class="form-label">类型</label><input id="mvType" class="form-input" value="${esc(m.type)}"></div>
        <div class="form-item"><label class="form-label">年份</label><input id="mvYear" class="form-input" value="${esc(m.year)}"></div>
        <div class="form-item"><label class="form-label">导演</label><input id="mvDir" class="form-input" value="${esc(m.director)}"></div>
        <div class="form-item"><label class="form-label">评分</label><input id="mvScore" class="form-input" value="${esc(m.score)}"></div>
        <div class="form-item"><label class="form-label">评价人数</label><input id="mvComments" class="form-input" value="${esc(m.comments)}"></div>
        <div class="form-item full"><label class="form-label">豆瓣链接</label><input id="mvUrl" class="form-input" value="${esc(m.douban_url)}"></div>
        <div class="form-item full"><label class="form-label">标签（逗号分隔）</label><input id="mvTags" class="form-input" value="${esc((m.tags||[]).join(','))}"></div>
      </div>
      <div style="margin-top:16px;display:flex;justify-content:space-between;">
        ${id ? `<button class="btn btn-danger" onclick="delMovie(${id})">删除</button>` : '<span></span>'}
        <div><button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveMovie(${id || 'null'})">保存</button></div>
      </div>
    </div>`);
}
async function saveMovie(id) {
  const body = {
    name: document.getElementById('mvName').value.trim(),
    type: document.getElementById('mvType').value.trim(),
    year: document.getElementById('mvYear').value.trim(),
    director: document.getElementById('mvDir').value.trim(),
    score: Number(document.getElementById('mvScore').value || 0),
    comments: Number(document.getElementById('mvComments').value || 0),
    douban_url: document.getElementById('mvUrl').value.trim(),
    tags: document.getElementById('mvTags').value.split(',').map((x) => x.trim()).filter(Boolean)
  };
  if (!body.name) return toast('请填写名称');
  if (id) await api.put('/api/movies/' + id, body);
  else await api.post('/api/movies', body);
  closeModal();
  renderMovies();
}
async function delMovie(id) {
  if (!confirm('删除这部电影？')) return;
  await api.del('/api/movies/' + id);
  closeModal();
  renderMovies();
}
function openBatchMovie() {
  openModal(`
    <div style="padding:20px;">
      <h3>批量导入电影</h3>
      <p style="font-size:13px;color:#999;">每行：名称,类型,年份,导演,评分</p>
      <textarea id="batchMv" class="form-textarea" style="min-height:160px;" placeholder="沙丘,科幻,2021,维伦纽瓦,8.1"></textarea>
      <div style="margin-top:12px;text-align:right;">
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitBatchMovie()">导入</button>
      </div>
    </div>`);
}
async function submitBatchMovie() {
  const movies = document.getElementById('batchMv').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, type, year, director, score] = l.split(',').map((x) => (x || '').trim());
    return { name, type, year, director, score: Number(score || 0) };
  }).filter((m) => m.name);
  const data = await api.post('/api/movies/batch', { movies });
  toast(`导入 ${data.count} 部`);
  closeModal();
  renderMovies();
}

async function openTaskWizard() {
  const movies = await api.get('/api/movies?page_size=200');
  const accounts = await api.get('/api/accounts?page_size=200');
  state.wizard = { step: 1, movies: movies.items, accounts: accounts.items, selectedMovies: [], selectedAccounts: [], types: { 短评: 1, 影评: 1, 讨论: 0, 小组: 0 }, timeSlot: '' };
  drawWizard();
}
function drawWizard() {
  const w = state.wizard;
  const steps = ['选电影', '内容类型', '选账号', '确认'];
  const movieCards = w.movies.map((m) => `
    <div class="pick-card ${w.selectedMovies.includes(m.id) ? 'selected' : ''}" onclick="togglePick('selectedMovies', ${m.id})">
      <b>${esc(m.name)}</b><div style="font-size:12px;color:#999;">${esc(m.type)} · ${esc(m.year)}</div>
    </div>`).join('');
  const accCards = w.accounts.map((a) => `
    <div class="pick-card ${w.selectedAccounts.includes(a.id) ? 'selected' : ''}" onclick="togglePick('selectedAccounts', ${a.id})">
      <b>${esc(a.name)}</b><div style="font-size:12px;color:#999;">${esc((a.a_tags||[]).join(' / '))}</div>
    </div>`).join('');
  const typeRows = Object.keys(w.types).map((t) => `
    <div class="count-row"><span>${t}</span><div>
      <button type="button" onclick="adjType('${t}',-1)">-</button>
      <span style="display:inline-block;width:28px;text-align:center;">${w.types[t]}</span>
      <button type="button" onclick="adjType('${t}',1)">+</button>
    </div></div>`).join('');
  const slots = ['早高峰','午休','晚高峰','深夜'];
  let body = '';
  if (w.step === 1) body = `<div class="select-list">${movieCards || '暂无电影'}</div>`;
  if (w.step === 2) body = typeRows + `<div class="form-item" style="margin-top:12px;"><label class="form-label">发布时段（可选）</label>
    ${slots.map((s)=>`<span class="chip ${w.timeSlot===s?'selected':''}" onclick="state.wizard.timeSlot='${s}';drawWizard()">${s}</span>`).join('')}</div>`;
  if (w.step === 3) body = `<div class="select-list">${accCards || '暂无账号'}</div>`;
  if (w.step === 4) {
    const total = w.selectedMovies.length * w.selectedAccounts.length * Object.values(w.types).reduce((a, b) => a + b, 0);
    body = `<p>电影 ${w.selectedMovies.length} × 账号 ${w.selectedAccounts.length} × 内容条数 = <b>${total}</b> 条待生成内容</p>
      <p>时段：${esc(w.timeSlot || '未指定')}</p>`;
  }
  openModal(`
    <div class="modal wide">
      <div style="padding:20px;">
        <h3>创建任务</h3>
        <div class="wizard-steps">${steps.map((s,i)=>`<div class="wizard-step ${w.step===i+1?'active':''}">${i+1}. ${s}</div>`).join('')}</div>
        ${body}
        <div style="margin-top:16px;display:flex;justify-content:space-between;">
          <button class="btn" onclick="wPrev()">上一步</button>
          <div><button class="btn" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="wNext()">${w.step===4?'创建':'下一步'}</button></div>
        </div>
      </div>
    </div>`);
  document.querySelector('#modalRoot .modal')?.classList.add('wide');
}
function togglePick(field, id) {
  const arr = state.wizard[field];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.push(id);
  drawWizard();
}
function adjType(t, d) {
  state.wizard.types[t] = Math.max(0, state.wizard.types[t] + d);
  drawWizard();
}
function wPrev() { if (state.wizard.step > 1) { state.wizard.step -= 1; drawWizard(); } }
async function wNext() {
  const w = state.wizard;
  if (w.step === 1 && !w.selectedMovies.length) return toast('请选择电影');
  if (w.step === 2 && Object.values(w.types).every((n) => n === 0)) return toast('请设置内容类型');
  if (w.step === 3 && !w.selectedAccounts.length) return toast('请选择账号');
  if (w.step < 4) { w.step += 1; drawWizard(); return; }
  const data = await api.post('/api/tasks/from-movie', {
    movie_ids: w.selectedMovies,
    account_ids: w.selectedAccounts,
    content_types: w.types,
    time_slots: w.timeSlot ? [w.timeSlot] : []
  });
  toast(`已创建 ${data.count} 个任务`);
  closeModal();
  switchPage('calendar');
}

async function renderTags() {
  const el = document.getElementById('page-tags');
  const data = await api.get('/api/tags/grouped');
  state.tagsTree = data.tree;
  const cat = state.tagCat || 'A';
  const titles = { A: '核心标签', B: '延伸标签', C: '活跃模式', D: '打分偏好' };
  const sections = (data.tree[cat] || []).map((p) => `
    <div class="tag-section">
      <div class="tag-section-title">${esc(p.code)} ${esc(p.name)}
        <span class="x" onclick="delTag(${p.id})" style="cursor:pointer;color:#ff4d4f;">删除分类</span></div>
      <div class="tag-grid">
        ${(p.children||[]).map((c)=>`<div class="tag-item">${esc(c.name)} <span class="x" onclick="delTag(${c.id})">×</span></div>`).join('')}
        <div class="tag-item" style="cursor:pointer;color:#52c41a;" onclick="openAddTag('${cat}', ${p.id})">+ 添加</div>
      </div>
    </div>`).join('');
  el.innerHTML = `
    <div class="tag-library">
      <div class="tag-sidebar">
        ${['A','B','C','D'].map((c)=>`<div class="tag-category-item ${cat===c?'active':''}" onclick="state.tagCat='${c}';renderTags()"
          style="padding:10px;border-radius:8px;cursor:pointer;${cat===c?'background:#f6ffed;color:#52c41a;':''}">${c} ${titles[c]}</div>`).join('')}
        <button class="btn btn-primary" style="margin-top:16px;width:100%;" onclick="openAddTag('${cat}', null)">＋ 新增分类</button>
      </div>
      <div class="tag-main">${sections || '<div class="empty-hint">暂无标签</div>'}</div>
    </div>`;
}
function openAddTag(category, parentId) {
  openModal(`<div style="padding:20px;"><h3>新增人设</h3>
    <input id="tagName" class="form-input" placeholder="名称">
    <input id="tagCode" class="form-input" placeholder="编码（可选）" style="margin-top:8px;">
    <div style="margin-top:12px;text-align:right;">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveTag('${category}', ${parentId})">保存</button>
    </div></div>`);
}
async function saveTag(category, parentId) {
  const name = document.getElementById('tagName').value.trim();
  const code = document.getElementById('tagCode').value.trim();
  if (!name) return toast('请填写名称');
  await api.post('/api/tags', { category, name, code, parent_id: parentId });
  closeModal();
  renderTags();
}
async function delTag(id) {
  if (!confirm('删除该标签？')) return;
  await api.del('/api/tags/' + id);
  renderTags();
}

async function renderAI() {
  const el = document.getElementById('page-ai');
  const movies = await api.get('/api/movies?page_size=200');
  const accounts = await api.get('/api/accounts?page_size=200');
  const contents = await api.get('/api/contents?page_size=30');
  el.innerHTML = `
    <div class="two-column">
      <div class="card"><div class="card-header"><span class="card-title">内容生成</span></div>
        <div class="card-body">
          <div class="form-item"><label class="form-label">账号</label>
            <select id="aiAcc" class="form-select">${accounts.items.map((a)=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
          <div class="form-item"><label class="form-label">电影</label>
            <select id="aiMv" class="form-select">${movies.items.map((m)=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
          <div class="form-item"><label class="form-label">类型</label>
            <select id="aiType" class="form-select"><option>短评</option><option selected>影评</option><option>讨论</option><option>小组</option></select></div>
          <div class="form-item"><label class="form-label">补充要求</label><input id="aiPrompt" class="form-input" placeholder="可选"></div>
          <button class="btn btn-primary" style="width:100%;" onclick="runGenerate()">✨ 一键生成并下发待领取</button>
          <button class="btn" style="width:100%;margin-top:8px;" onclick="batchGenerateAll()">批量生成所有待生成任务</button>
        </div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">预览</span>
        <button class="btn" onclick="copyPreview()">复制</button></div>
        <div class="card-body"><div class="preview-box" id="aiPreview">生成结果将显示在这里</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="card-header"><span class="card-title">最近内容</span></div>
      <div class="table-container"><table><thead><tr><th>电影</th><th>账号</th><th>类型</th><th>状态</th><th>执行者</th><th>时间</th></tr></thead>
      <tbody>${contents.items.map((c)=>`<tr>
        <td>${esc(c.movie_name)}</td><td>${esc(c.account_name)}</td><td>${esc(c.type)}</td>
        <td><span class="status-badge ${statusClass(c.status)}">${esc(c.status)}</span></td>
        <td>${esc(c.worker_name || '-')}</td><td>${esc(c.created_at)}</td>
      </tr>`).join('')}</tbody></table></div>
    </div>`;
}
async function runGenerate() {
  const data = await api.post('/api/ai/generate', {
    account_id: Number(document.getElementById('aiAcc').value),
    movie_id: Number(document.getElementById('aiMv').value),
    content_type: document.getElementById('aiType').value,
    prompt: document.getElementById('aiPrompt').value,
    save: true
  });
  document.getElementById('aiPreview').textContent = data.content;
  toast('已生成并进入待领取池');
}
function copyPreview() {
  const t = document.getElementById('aiPreview').textContent;
  navigator.clipboard.writeText(t).then(() => toast('已复制'));
}

async function renderCredentials() {
  const el = document.getElementById('page-credentials');
  const status = document.getElementById('credStatus')?.value || '';
  const data = await api.get('/api/credentials?page_size=100' + (status ? '&status=' + encodeURIComponent(status) : ''));
  document.getElementById('badgeCreds').textContent = data.items.filter((x) => ['待终审','待AI审核'].includes(x.status)).length;
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">凭证审核</span>
        <select class="filter-select" id="credStatus" onchange="renderCredentials()">
          <option value="">全部</option>
          ${['待AI审核','待终审','已通过','已拒绝'].map((s)=>`<option ${s===status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="table-container"><table><thead><tr>
        <th>ID</th><th>账号</th><th>电影</th><th>执行者</th><th>AI预审</th><th>状态</th><th>时间</th><th>操作</th>
      </tr></thead><tbody>
        ${data.items.map((c)=>`<tr>
          <td>${c.id}</td><td>${esc(c.account_name)}</td><td>${esc(c.movie_name)}</td><td>${esc(c.worker_name||'-')}</td>
          <td><span class="badge-ai">${esc(c.ai_status || '-')}</span></td>
          <td><span class="status-badge ${statusClass(c.status)}">${esc(c.status)}</span></td>
          <td>${esc(c.created_at)}</td>
          <td><button class="action-btn" onclick="openCred(${c.id})">查看</button></td>
        </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">暂无凭证</td></tr>'}
      </tbody></table></div>
    </div>`;
}
async function openCred(id) {
  const data = await api.get('/api/credentials?page_size=200');
  const c = data.items.find((x) => x.id === id);
  if (!c) return toast('记录不存在');
  openModal(`
    <div class="modal wide"><div style="padding:20px;">
      <h3>凭证 #${c.id}</h3>
      <div class="cred-detail">
        <div>
          <p><b>${esc(c.account_name)}</b> · ${esc(c.movie_name)} · ${esc(c.content_type)}</p>
          <div class="preview-box">${esc(c.content || '')}</div>
          <p>链接：<a href="${esc(c.published_url)}" target="_blank">${esc(c.published_url)}</a></p>
          <p>AI：${esc(c.ai_status)}（${c.ai_confidence || 0}）<br>${esc(c.ai_comment || '')}</p>
        </div>
        <div>${c.image_path ? `<img class="cred-shot" src="${esc(c.image_path)}">` : '无截图'}</div>
      </div>
      <textarea id="auditComment" class="form-textarea" placeholder="终审意见">${esc(c.final_comment || '')}</textarea>
      <div style="margin-top:12px;text-align:right;">
        <button class="btn" onclick="closeModal()">关闭</button>
        <button class="btn" onclick="aiAudit(${c.id})">重跑AI预审</button>
        <button class="btn btn-danger" onclick="finalAudit(${c.id},'reject')">驳回</button>
        <button class="btn btn-primary" onclick="finalAudit(${c.id},'approve')">通过</button>
      </div>
    </div></div>`);
}
async function aiAudit(id) {
  await api.post(`/api/credentials/${id}/ai-audit`);
  toast('AI预审完成');
  closeModal();
  renderCredentials();
}
async function finalAudit(id, action) {
  const comment = document.getElementById('auditComment')?.value || '';
  await api.put(`/api/credentials/${id}/audit`, { action, comment });
  toast(action === 'approve' ? '已通过' : '已驳回');
  closeModal();
  renderCredentials();
  if (state.page === 'home') renderHome();
}

async function renderLogs() {
  const el = document.getElementById('page-logs');
  const type = document.getElementById('logType')?.value || '';
  const range = document.getElementById('logRange')?.value || '';
  const q = new URLSearchParams({ page_size: 50, action_type: type, range });
  const data = await api.get('/api/logs?' + q.toString());
  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select class="filter-select" id="logType" onchange="renderLogs()">
          <option value="">全部类型</option>
          ${['account','task','content','audit','system'].map((s)=>`<option value="${s}" ${s===type?'selected':''}>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="logRange" onchange="renderLogs()">
          <option value="">全部时间</option>
          <option value="today" ${range==='today'?'selected':''}>今天</option>
          <option value="week" ${range==='week'?'selected':''}>近7天</option>
          <option value="month" ${range==='month'?'selected':''}>近30天</option>
        </select>
      </div>
    </div>
    <div class="card"><div class="table-container"><table><thead><tr>
      <th>时间</th><th>类型</th><th>对象</th><th>描述</th><th>操作人</th><th>状态</th>
    </tr></thead><tbody>
      ${data.items.map((l)=>`<tr>
        <td>${esc(l.created_at)}</td><td>${esc(l.action_type)}</td>
        <td>${esc(l.object_type)} ${esc(l.object_id)}</td>
        <td>${esc(l.description)}</td><td>${esc(l.user_name)}</td>
        <td>${esc(l.before_status)} → ${esc(l.after_status)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">暂无日志</td></tr>'}
    </tbody></table></div>
    ${pager(data.total, data.page, data.page_size)}
    </div>`;
}

async function renderAnalytics() {
  const el = document.getElementById('page-analytics');
  const d = await api.get('/api/dashboard');
  const maxW = Math.max(...(d.workers || []).map((w) => w.passed || 0), 1);
  el.innerHTML = `
    <div class="analytics-grid">
      <div class="card"><div class="card-header"><span class="card-title">审核通过率</span></div>
        <div class="card-body">
          <div class="stat-value">${d.credentials.pass_rate}%</div>
          <p>通过 ${d.credentials.passed} / 驳回 ${d.credentials.rejected}</p>
        </div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">任务概况</span></div>
        <div class="card-body">
          <p>总任务 ${d.tasks.total}　完成 ${d.tasks.completed}　执行中 ${d.tasks.running}　待执行 ${d.tasks.pending}</p>
        </div>
      </div>
      <div class="card" style="grid-column:1/-1;">
        <div class="card-header"><span class="card-title">执行者产能</span></div>
        <div class="card-body">
          ${(d.workers||[]).map((w)=>`<div class="bar-row"><span style="width:120px;">${esc(w.name)}</span>
            <div class="bar" style="width:${((w.passed||0)/maxW)*60}%"></div>
            <span>通过 ${w.passed || 0} / 共 ${w.total || 0}</span></div>`).join('') || '<div class="empty-hint">暂无执行者数据</div>'}
        </div>
      </div>
    </div>`;
}

async function renderSettings() {
  const el = document.getElementById('page-settings');
  const s = await api.get('/api/settings');
  const users = state.user.role === 'admin' ? await api.get('/api/auth/users') : { items: [] };
  el.innerHTML = `
    <div class="card"><div class="card-header"><span class="card-title">生成与调度</span></div>
      <div class="card-body form-grid">
        <div class="form-item"><label class="form-label">AI 提供方</label>
          <select id="stProvider" class="form-select">
            <option value="mock" ${s.ai_provider==='mock'?'selected':''}>本地模板（无 Key 可跑通）</option>
            <option value="volcano" ${s.ai_provider==='volcano'?'selected':''}>火山引擎</option>
          </select>
          <div class="settings-form-hint" style="font-size:12px;color:#999;margin-top:4px;">火山 Key 已配置：${s.volcengine_key_configured ? '是' : '否（请设环境变量 VOLCENGINE_API_KEY）'}</div>
        </div>
        <div class="form-item"><label class="form-label">模型名</label><input id="stModel" class="form-input" value="${esc(s.volcengine_model)}"></div>
        <div class="form-item"><label class="form-label">每日任务上限</label><input id="stDaily" class="form-input" value="${esc(s.daily_task_limit)}"></div>
        <div class="form-item"><label class="form-label">领取超时（小时）</label><input id="stTimeout" class="form-input" value="${esc(s.claim_timeout_hours)}"></div>
        <div class="form-item"><label class="form-label">账号并发上限</label><input id="stConc" class="form-input" value="${esc(s.account_concurrency)}"></div>
        <div class="form-item"><label class="form-label">AI 预审阈值</label><input id="stTh" class="form-input" value="${esc(s.ai_audit_threshold)}"></div>
        <div class="form-item full"><label class="form-label">短评 Prompt</label><textarea id="stP1" class="form-textarea">${esc(s.prompt_short)}</textarea></div>
        <div class="form-item full"><label class="form-label">影评 Prompt</label><textarea id="stP2" class="form-textarea">${esc(s.prompt_review)}</textarea></div>
        <div class="form-item full"><label class="form-label">讨论 Prompt</label><textarea id="stP3" class="form-textarea">${esc(s.prompt_discuss)}</textarea></div>
      </div>
      ${state.user.role==='admin'?`<div style="text-align:right;"><button class="btn btn-primary" onclick="saveSettings()">保存设置</button></div>`:''}
    </div>
    ${state.user.role==='admin'?`
    <div class="card"><div class="card-header"><span class="card-title">用户</span>
      <button class="btn btn-primary" onclick="openUserModal()">＋ 新建用户</button></div>
      <div class="table-container"><table><thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>角色</th><th>状态</th></tr></thead>
      <tbody>${users.items.map((u)=>`<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.status)}</td></tr>`).join('')}</tbody></table></div>
    </div>`:''}`;
}
async function saveSettings() {
  await api.put('/api/settings', {
    ai_provider: document.getElementById('stProvider').value,
    volcengine_model: document.getElementById('stModel').value,
    daily_task_limit: document.getElementById('stDaily').value,
    claim_timeout_hours: document.getElementById('stTimeout').value,
    account_concurrency: document.getElementById('stConc').value,
    ai_audit_threshold: document.getElementById('stTh').value,
    prompt_short: document.getElementById('stP1').value,
    prompt_review: document.getElementById('stP2').value,
    prompt_discuss: document.getElementById('stP3').value
  });
  toast('设置已保存');
}
function openUserModal() {
  openModal(`<div style="padding:20px;"><h3>新建用户</h3>
    <input id="uName" class="form-input" placeholder="用户名">
    <input id="uDisp" class="form-input" placeholder="姓名" style="margin-top:8px;">
    <input id="uPass" class="form-input" placeholder="密码" style="margin-top:8px;">
    <select id="uRole" class="form-select" style="margin-top:8px;"><option value="worker">执行者</option><option value="reviewer">审核员</option><option value="admin">管理员</option></select>
    <div style="margin-top:12px;text-align:right;"><button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveUser()">创建</button></div></div>`);
}
async function saveUser() {
  await api.post('/api/auth/users', {
    username: document.getElementById('uName').value.trim(),
    name: document.getElementById('uDisp').value.trim(),
    password: document.getElementById('uPass').value,
    role: document.getElementById('uRole').value
  });
  closeModal();
  renderSettings();
}

document.getElementById('loginPass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

(async function boot() {
  const token = api.token();
  if (!token) return;
  try {
    const user = await api.get('/api/auth/me');
    if (user.role === 'worker') {
      location.href = '/worker/';
      return;
    }
    state.user = user;
    showApp();
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
})();
