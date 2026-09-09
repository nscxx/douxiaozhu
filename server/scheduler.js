const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { getSetting } = require('./db');
const { syncTaskStatus } = require('./lib/ops');
const { auditCredential } = require('./lib/ai');

function backupDatabase(dbPath) {
  const dir = path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dest = path.join(dir, `douxiaozhu_${stamp}.db`);
  fs.copyFileSync(dbPath, dest);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
  while (files.length > 14) {
    const old = files.shift();
    fs.unlinkSync(path.join(dir, old));
  }
  console.log('数据库备份完成:', dest);
  return dest;
}

function releaseExpiredClaims(db) {
  const hours = parseFloat(getSetting(db, 'claim_timeout_hours', '24')) || 24;
  const rows = db.prepare(`
    SELECT id, task_id FROM contents
    WHERE status IN ('已领取','待发布')
      AND claimed_at IS NOT NULL
      AND datetime(claimed_at, '+' || ? || ' hours') < datetime('now', 'localtime')
  `).all(hours);
  const update = db.prepare(`
    UPDATE contents SET status = '待领取', worker_id = NULL, claimed_at = NULL,
      updated_at = datetime('now', 'localtime') WHERE id = ?
  `);
  for (const row of rows) {
    update.run(row.id);
    syncTaskStatus(db, row.task_id);
  }
  if (rows.length) console.log(`已释放超时领取 ${rows.length} 条`);
  return rows.length;
}

async function processPendingAiAudits(db) {
  const pending = db.prepare(`
    SELECT cr.*, c.content FROM credentials cr
    LEFT JOIN contents c ON cr.content_id = c.id
    WHERE cr.status = '待AI审核'
    LIMIT 20
  `).all();
  for (const cred of pending) {
    try {
      const result = await auditCredential(db, {
        content: cred.content,
        publishedUrl: cred.published_url,
        hasImage: Boolean(cred.image_path)
      });
      db.prepare(
        `UPDATE credentials SET ai_status = ?, ai_comment = ?, ai_confidence = ?, ai_result = ?, status = '待终审' WHERE id = ?`
      ).run(result.ai_status, result.ai_comment, result.ai_confidence, result.ai_status, cred.id);
      if (cred.content_id) {
        db.prepare(`UPDATE contents SET status = '待终审', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(cred.content_id);
      }
    } catch (err) {
      db.prepare(
        `UPDATE credentials SET ai_status = '存疑', ai_comment = ?, status = '待终审' WHERE id = ?`
      ).run(`预审异常：${err.message}`, cred.id);
    }
  }
  return pending.length;
}

function startScheduler(db, dbPath) {
  cron.schedule('*/5 * * * *', () => {
    try { releaseExpiredClaims(db); } catch (err) { console.error('释放超时任务失败', err); }
  });
  cron.schedule('* * * * *', () => {
    processPendingAiAudits(db).catch((err) => console.error('AI预审队列失败', err));
  });
  cron.schedule('15 3 * * *', () => {
    try { backupDatabase(dbPath); } catch (err) { console.error('备份失败', err); }
  });
  console.log('调度已启动：超时释放 / AI预审补跑 / 每日备份');
}

module.exports = { startScheduler, backupDatabase, releaseExpiredClaims, processPendingAiAudits };
