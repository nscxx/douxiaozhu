const express = require('express');
const { ok, fail, parseTags } = require('../db-utils');
const { generateContent } = require('../lib/ai');
const { syncTaskStatus } = require('../lib/ops');
const { writeLog } = require('../lib/ops');
const { roles } = require('../middleware/auth');
const router = express.Router();

router.post('/generate', roles('admin', 'reviewer'), async (req, res) => {
  const { movie_id, account_id, content_type, prompt, save = true } = req.body || {};
  if (!movie_id || !account_id) return fail(res, 400, '请选择电影和账号');
  const movie = parseTags(req.db.prepare('SELECT * FROM movies WHERE id = ?').get(movie_id));
  const account = parseTags(req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id));
  if (!movie || !account) return fail(res, 404, '电影或账号不存在');
  const type = content_type || '影评';
  const content = await generateContent(req.db, { movie, account, type, extraPrompt: prompt });
  let id = null;
  if (save) {
    const result = req.db.prepare(
      `INSERT INTO contents (account_id, movie_id, type, content, status)
       VALUES (?, ?, ?, ?, '待领取')`
    ).run(account_id, movie_id, type, content);
    id = result.lastInsertRowid;
    writeLog(req.db, req, {
      action_type: 'content', object_type: 'content', object_id: id,
      description: `AI生成 ${type}《${movie.name}》`, after_status: '待领取'
    });
  }
  return ok(res, { id, content, status: '待领取' });
});

router.post('/batch-generate', roles('admin', 'reviewer'), async (req, res) => {
  const { task_id, content_ids } = req.body || {};
  let rows = [];
  if (task_id) {
    rows = req.db.prepare(`SELECT * FROM contents WHERE task_id = ? AND status = '待生成'`).all(task_id);
  } else if (Array.isArray(content_ids) && content_ids.length) {
    const placeholders = content_ids.map(() => '?').join(',');
    rows = req.db.prepare(`SELECT * FROM contents WHERE id IN (${placeholders}) AND status = '待生成'`).all(...content_ids);
  } else {
    rows = req.db.prepare(`SELECT * FROM contents WHERE status = '待生成' LIMIT 50`).all();
  }
  const results = [];
  for (const row of rows) {
    const movie = parseTags(req.db.prepare('SELECT * FROM movies WHERE id = ?').get(row.movie_id) || {});
    const account = parseTags(req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(row.account_id) || {});
    try {
      const text = await generateContent(req.db, { movie, account, type: row.type });
      req.db.prepare(
        `UPDATE contents SET content = ?, status = '待领取', updated_at = datetime('now', 'localtime') WHERE id = ?`
      ).run(text, row.id);
      if (row.task_id) syncTaskStatus(req.db, row.task_id);
      results.push({ id: row.id, ok: true });
    } catch (err) {
      results.push({ id: row.id, ok: false, error: err.message });
    }
  }
  return ok(res, { count: results.filter((r) => r.ok).length, results });
});

module.exports = router;
