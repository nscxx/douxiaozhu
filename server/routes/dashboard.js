const express = require('express');
const router = express.Router();

// 首页仪表盘数据
router.get('/', (req, res) => {
  const db = req.db;
  
  // 账号统计
  const accountTotal = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  const accountActive = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = '活跃'").get().count;
  
  // 健康度分布
  const healthDistribution = {
    healthy: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 90').get().count,
    warning: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 70 AND health < 90').get().count,
    abnormal: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health >= 50 AND health < 70').get().count,
    banned: db.prepare('SELECT COUNT(*) as count FROM accounts WHERE health < 50').get().count,
  };
  
  // 任务统计
  const taskTotal = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const taskCompleted = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '已完成'").get().count;
  const taskPending = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '待执行'").get().count;
  const taskRunning = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = '执行中'").get().count;
  
  // 今日内容统计
  const todayGenerated = db.prepare(`
    SELECT COUNT(*) as count FROM contents WHERE date(created_at) = date('now', 'localtime')
  `).get().count;
  
  const todayPublished = db.prepare(`
    SELECT COUNT(*) as count FROM contents 
    WHERE date(created_at) = date('now', 'localtime') AND status = '已发布'
  `).get().count;
  
  // 待审核凭证数
  const pendingCredentials = db.prepare("SELECT COUNT(*) as count FROM credentials WHERE status = '待审核'").get().count;
  
  // 最近7天产出趋势
  const trendData = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = `date('now', 'localtime', '-${i} days')`;
    const count = db.prepare(`SELECT COUNT(*) as count FROM contents WHERE date(created_at) = ${dateStr}`).get().count;
    trendData.push({ date_offset: i, count });
  }
  
  // 最近任务
  const recentTasks = db.prepare(`
    SELECT t.*, m.name as movie_name, a.name as account_name
    FROM tasks t
    LEFT JOIN movies m ON t.movie_id = m.id
    LEFT JOIN accounts a ON t.account_id = a.id
    ORDER BY t.created_at DESC
    LIMIT 10
  `).all().map(t => ({
    ...t,
    content_types: JSON.parse(t.content_types || '[]'),
    time_slots: JSON.parse(t.time_slots || '[]')
  }));
  
  res.json({
    code: 0,
    data: {
      accounts: { total: accountTotal, active: accountActive },
      health: healthDistribution,
      tasks: { total: taskTotal, completed: taskCompleted, pending: taskPending, running: taskRunning },
      contents: { today_generated: todayGenerated, today_published: todayPublished },
      credentials: { pending: pendingCredentials },
      trend: trendData,
      recent_tasks: recentTasks
    }
  });
});

module.exports = router;
