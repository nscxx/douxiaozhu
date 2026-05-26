// Coze工作流API代理
const COZE_ENDPOINTS = {
  task: 'https://dxztask.coze.site',
  aigc: 'https://dxzaigc.coze.site',
  audit: 'https://dxzaudit.coze.site',
  health: 'https://dxzhealth.coze.site'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { workflow } = req.query;
    const endpoint = COZE_ENDPOINTS[workflow];
    if (!endpoint) {
      return res.status(400).json({ error: 'Unknown workflow: ' + workflow + '. Available: task, aigc, audit, health' });
    }

    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const data = await result.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Coze API Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
