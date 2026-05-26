// 飞书API代理 - Cloudflare Pages Function
const FEISHU_APP_ID = 'cli_a9772f3dc8bbdcd3';
const FEISHU_APP_SECRET = 'lKW60OqnJhpMbhJvuHmrLdGrhJz6OhgJ';
const FEISHU_BASE_TOKEN = 'GeAgbUEIBaosECsdNhNcaYY4nQc';

// 字段类型定义
const TABLE_FIELDS = {
  'tbldOBRBj31yDJnL': {
    '账号名称': 1, '健康度': 2, 'C标签': 3, '账号状态': 3, '内容数': 2,
    'D标签': 3, '备注': 1, '最后活跃时间': 5, '豆瓣UID': 1, '登录邮箱': 1,
    'A标签': 4, 'B标签': 4
  },
  'tbliHdwihKDPTgwl': {
    '豆瓣ID': 1, '英文名': 1, '评价人数': 2, '豆瓣评分': 2, '电影名称': 1,
    '导演': 1, '豆瓣链接': 1, '简介': 1, '推荐标签': 4, '上映年份': 2, '电影类型': 4, '主演': 1
  },
  'tbl6fIAMP8OlILSu': {
    '失败原因': 1, '创建时间': 5, '任务名称': 1, '备注': 1, '关联账号': 1,
    '开始执行时间': 5, '创建方式': 3, '发布时段': 4, '内容类型及条数': 1,
    '任务状态': 3, '完成时间': 5, '关联电影': 1
  },
  'tblWoqAqGIuv1G6U': {
    '内容标题': 1, '任务ID': 1, '驳回原因': 1, '发布时间': 5, '发布链接': 1,
    '电影ID': 1, '生成内容文本': 1, '账号ID': 1, '内容类型': 3,
    '创建时间': 5, '建议打分': 2, '内容状态': 3
  },
  'tblHuV7K2yr8qtjw': {
    '人工审核备注': 1, '人工审核状态': 3, '内容ID': 1, '提交时间': 5,
    'AI预审结果': 3, '审核完成时间': 5, '提交链接': 1, 'AI预审置信度': 2,
    '账号ID': 1, 'AI预审备注': 1
  }
};

function fixFields(tableId, fields) {
  const fieldTypes = TABLE_FIELDS[tableId] || {};
  const fixed = {};
  for (const [key, value] of Object.entries(fields)) {
    const type = fieldTypes[key];
    if (type === 4) {
      if (typeof value === 'string') fixed[key] = value ? [value] : [];
      else if (Array.isArray(value)) fixed[key] = value.map(String);
      else fixed[key] = [];
    } else if (type === 3) {
      if (Array.isArray(value)) fixed[key] = value.length > 0 ? String(value[0]) : '';
      else fixed[key] = value != null ? String(value) : '';
    } else if (type === 5) {
      if (typeof value === 'string') fixed[key] = new Date(value).getTime() || Date.now();
      else if (typeof value === 'number') fixed[key] = value;
      else fixed[key] = Date.now();
    } else {
      fixed[key] = value;
    }
  }
  return fixed;
}

async function getToken(env) {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await res.json();
  if (data.code === 0) return data.tenant_access_token;
  throw new Error('Failed to get token: ' + data.msg);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const token = await getToken();
    const { action, table_id, record_id } = params;

    if (!action || !table_id) {
      return new Response(JSON.stringify({ error: 'Missing action or table_id' }), { status: 400, headers });
    }

    if (action === 'list') {
      const pageSize = params.page_size || 100;
      const filter = params.filter || '';
      let feishuUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${table_id}/records?page_size=${pageSize}`;
      if (filter) feishuUrl += `&filter=${encodeURIComponent(filter)}`;
      const result = await fetch(feishuUrl, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await result.json();
      return new Response(JSON.stringify(data), { headers });
    }

    if (action === 'create') {
      const body = await request.json();
      if (body.records && Array.isArray(body.records)) {
        body.records = body.records.map(r => ({ ...r, fields: fixFields(table_id, r.fields || {}) }));
      }
      const result = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${table_id}/records/batch_create`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await result.json();
      return new Response(JSON.stringify(data), { headers });
    }

    if (action === 'update') {
      if (!record_id) return new Response(JSON.stringify({ error: 'Missing record_id' }), { status: 400, headers });
      const body = await request.json();
      if (body.fields) body.fields = fixFields(table_id, body.fields);
      const result = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${table_id}/records/${record_id}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await result.json();
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
