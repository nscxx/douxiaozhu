const express = require('express');
const { ok, fail } = require('../db-utils');
const { roles } = require('../middleware/auth');
const { setSetting, DEFAULT_SETTINGS } = require('../db');
const router = express.Router();

const PUBLIC_KEYS = [
  'daily_task_limit', 'account_concurrency', 'publish_interval_min',
  'claim_timeout_hours', 'ai_audit_threshold', 'ai_provider', 'volcengine_model',
  'prompt_short', 'prompt_review', 'prompt_discuss', 'notify_audit', 'notify_alert'
];

router.get('/', (req, res) => {
  const rows = req.db.prepare('SELECT key, value FROM settings').all();
  const data = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (PUBLIC_KEYS.includes(row.key) || row.key in data) data[row.key] = row.value;
  }
  data.volcengine_key_configured = Boolean(process.env.VOLCENGINE_API_KEY);
  return ok(res, data);
});

router.put('/', roles('admin'), (req, res) => {
  const body = req.body || {};
  for (const key of PUBLIC_KEYS) {
    if (body[key] !== undefined) setSetting(req.db, key, body[key]);
  }
  return ok(res, {}, '设置已保存');
});

module.exports = router;
