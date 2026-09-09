const express = require('express');
const { ok, paginate } = require('../db-utils');
const { roles } = require('../middleware/auth');
const router = express.Router();

router.get('/', roles('admin', 'reviewer'), (req, res) => {
  const { action_type, keyword, range } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (action_type) { where.push('action_type = ?'); params.push(action_type); }
  if (keyword) {
    where.push('(description LIKE ? OR user_name LIKE ? OR object_id LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (range === 'today') where.push("date(created_at) = date('now', 'localtime')");
  if (range === 'week') where.push("date(created_at) >= date('now', 'localtime', '-7 days')");
  if (range === 'month') where.push("date(created_at) >= date('now', 'localtime', '-30 days')");
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM operation_logs ${whereClause}`).get(...params).c;
  const items = req.db.prepare(
    `SELECT * FROM operation_logs ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);
  return ok(res, { items, total, page, page_size: pageSize });
});

module.exports = router;
