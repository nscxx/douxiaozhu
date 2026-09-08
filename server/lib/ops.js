function writeLog(db, req, payload) {
  const user = req.user || {};
  db.prepare(
    `INSERT INTO operation_logs
      (user_id, user_name, action_type, object_type, object_id, description, before_status, after_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id || null,
    user.name || user.username || '系统',
    payload.action_type || '',
    payload.object_type || '',
    payload.object_id != null ? String(payload.object_id) : '',
    payload.description || '',
    payload.before_status || '',
    payload.after_status || ''
  );
}

function syncTaskStatus(db, taskId) {
  if (!taskId) return;
  const rows = db.prepare('SELECT status FROM contents WHERE task_id = ?').all(taskId);
  if (!rows.length) {
    db.prepare(`UPDATE tasks SET status = '待执行', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(taskId);
    return;
  }
  const statuses = rows.map((r) => r.status);
  const allDone = statuses.every((s) => s === '已通过');
  const anyFailed = statuses.some((s) => s === '已拒绝');
  const allPendingGen = statuses.every((s) => s === '待生成');
  const anyActive = statuses.some((s) =>
    ['待领取', '已领取', '待发布', '待AI审核', '待终审'].includes(s)
  );
  let status = '执行中';
  if (allPendingGen) status = '待执行';
  else if (allDone) status = '已完成';
  else if (anyFailed && !anyActive && statuses.some((s) => s === '已通过')) status = '部分失败';
  else if (anyFailed && !anyActive && !statuses.some((s) => s === '已通过')) status = '部分失败';
  db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(status, taskId);
}

function applyHealthOnAudit(db, accountId, passed) {
  if (!accountId) return;
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return;
  let health = Number(account.health || 100);
  let contentCount = Number(account.content_count || 0);
  let status = account.status;
  if (passed) {
    health = Math.min(100, health + 1);
    contentCount += 1;
    if (health >= 70 && status === '异常') status = '活跃';
  } else {
    health = Math.max(0, health - 5);
    if (health < 50) status = '异常';
    else if (health < 70 && status === '活跃') status = '预警';
  }
  db.prepare(
    `UPDATE accounts
     SET health = ?, content_count = ?, status = ?, last_active_at = datetime('now', 'localtime'),
         updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(health, contentCount, status, accountId);
}

module.exports = { writeLog, syncTaskStatus, applyHealthOnAudit };
