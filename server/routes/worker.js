const express = require('express');
const { ok, fail, paginate } = require('../db-utils');
const { roles } = require('../middleware/auth');
const router = express.Router();

router.use(roles('worker', 'admin', 'reviewer'));

router.get('/tasks', (req, res) => {
  const { tab = 'claimable' } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  let where = '';
  const params = [];
  if (tab === 'mine' || tab === 'claimed') {
    where = `c.worker_id = ? AND c.status IN ('已领取','待发布','待AI审核','待终审')`;
    params.push(req.user.id);
  } else if (tab === 'done') {
    where = `c.worker_id = ? AND c.status IN ('已通过','已拒绝')`;
    params.push(req.user.id);
  } else {
    where = `c.status = '待领取'`;
  }
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM contents c WHERE ${where}`).get(...params).c;
  const items = req.db.prepare(`
    SELECT c.*, a.name as account_name, m.name as movie_name, m.year as movie_year, t.name as task_name,
           t.time_slots
    FROM contents c
    LEFT JOIN accounts a ON c.account_id = a.id
    LEFT JOIN movies m ON c.movie_id = m.id
    LEFT JOIN tasks t ON c.task_id = t.id
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.get('/stats', (req, res) => {
  const mine = req.db.prepare(`
    SELECT
      SUM(CASE WHEN status IN ('已领取','待发布') THEN 1 ELSE 0 END) as doing,
      SUM(CASE WHEN status IN ('待AI审核','待终审') THEN 1 ELSE 0 END) as auditing,
      SUM(CASE WHEN status = '已通过' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN status = '已拒绝' THEN 1 ELSE 0 END) as rejected
    FROM contents WHERE worker_id = ?
  `).get(req.user.id);
  const claimable = req.db.prepare("SELECT COUNT(*) as c FROM contents WHERE status = '待领取'").get().c;
  return ok(res, { ...mine, claimable });
});

module.exports = router;
