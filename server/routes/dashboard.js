const express = require('express');
const { ok } = require('../db-utils');
const router = express.Router();

router.get('/', (req, res) => {
  const db = req.db;
  const accountTotal = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  const accountActive = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = '活跃'").get().count;
  const healthDistribution = {
    healthy: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 90').get().count,
    warning: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 70 AND health < 90').get().count,
    abnormal: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 50 AND health < 70').get().count,
    banned: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health < 50').get().count
  };
  const taskTotal = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const taskCompleted = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '已完成'").get().count;
  const taskPending = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '待执行'").get().count;
  const taskRunning = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '执行中'").get().count;
  const todayGenerated = db.prepare(`
    SELECT COUNT(*) as count FROM contents WHERE date(created_at) = date('now', 'localtime')
  `).get().count;
  const todayPublished = db.prepare(`
    SELECT COUNT(*) as count FROM contents
    WHERE date(updated_at) = date('now', 'localtime') AND status = '已通过'
  `).get().count;
  const pendingCredentials = db.prepare(
    "SELECT COUNT(*) as count FROM credentials WHERE status IN ('待AI审核','待终审')"
  ).get().count;
  const claimable = db.prepare("SELECT COUNT(*) as count FROM contents WHERE status = '待领取'").get().count;

  const passed = db.prepare("SELECT COUNT(*) as c FROM credentials WHERE status = '已通过'").get().c;
  const rejected = db.prepare("SELECT COUNT(*) as c FROM credentials WHERE status = '已拒绝'").get().c;
  const audited = passed + rejected;
  const passRate = audited ? Math.round((passed / audited) * 1000) / 10 : 0;

  const trendData = [];
  for (let i = 6; i >= 0; i -= 1) {
    const count = db.prepare(
      `SELECT COUNT(*) as count FROM contents WHERE date(created_at) = date('now', 'localtime', '-' || ? || ' days')`
    ).get(i).count;
    const published = db.prepare(
      `SELECT COUNT(*) as count FROM contents WHERE status = '已通过' AND date(updated_at) = date('now', 'localtime', '-' || ? || ' days')`
    ).get(i).count;
    trendData.push({ date_offset: i, count, published });
  }

  const recentTasks = db.prepare(`
    SELECT t.*, m.name as movie_name, a.name as account_name
    FROM tasks t
    LEFT JOIN movies m ON t.movie_id = m.id
    LEFT JOIN accounts a ON t.account_id = a.id
    ORDER BY t.created_at DESC
    LIMIT 10
  `).all().map((t) => ({
    ...t,
    content_types: JSON.parse(t.content_types || '[]'),
    time_slots: JSON.parse(t.time_slots || '[]')
  }));

  const pendingList = db.prepare(`
    SELECT cr.*, a.name as account_name, c.type as content_type, m.name as movie_name
    FROM credentials cr
    LEFT JOIN accounts a ON cr.account_id = a.id
    LEFT JOIN contents c ON cr.content_id = c.id
    LEFT JOIN movies m ON c.movie_id = m.id
    WHERE cr.status IN ('待AI审核','待终审')
    ORDER BY cr.created_at DESC
    LIMIT 8
  `).all();

  const workerStats = db.prepare(`
    SELECT u.id, u.name,
      SUM(CASE WHEN c.status = '已通过' THEN 1 ELSE 0 END) as passed,
      COUNT(c.id) as total
    FROM users u
    LEFT JOIN contents c ON c.worker_id = u.id
    WHERE u.role = 'worker'
    GROUP BY u.id
    ORDER BY passed DESC
    LIMIT 10
  `).all();

  return ok(res, {
    accounts: { total: accountTotal, active: accountActive },
    health: healthDistribution,
    tasks: { total: taskTotal, completed: taskCompleted, pending: taskPending, running: taskRunning },
    contents: { today_generated: todayGenerated, today_published: todayPublished, claimable },
    credentials: { pending: pendingCredentials, passed, rejected, pass_rate: passRate },
    trend: trendData,
    recent_tasks: recentTasks,
    pending_list: pendingList,
    workers: workerStats
  });
});

module.exports = router;
