// Coze工作流API代理 - Cloudflare Pages Function
const COZE_ENDPOINTS = {
  task: 'https://dxztask.coze.site',
  aigc: 'https://dxzaigc.coze.site',
  audit: 'https://dxzaudit.coze.site',
  health: 'https://dxzhealth.coze.site'
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const workflow = url.searchParams.get('workflow');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const endpoint = COZE_ENDPOINTS[workflow];
    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Unknown workflow: ' + workflow + '. Available: task, aigc, audit, health' }), { status: 400, headers });
    }

    const body = await request.json().catch(() => ({}));
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await result.json();
    return new Response(JSON.stringify(data), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
