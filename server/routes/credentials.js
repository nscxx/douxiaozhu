const express = require('express');
const { ok, fail, paginate } = require('../db-utils');
const { writeLog, syncTaskStatus, applyHealthOnAudit } = require('../lib/ops');
const { auditCredential } = require('../lib/ai');
const { roles } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const { status, ai_status } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (status) { where.push('cr.status = ?'); params.push(status); }
  if (ai_status) { where.push('cr.ai_status = ?'); params.push(ai_status); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM credentials cr ${whereClause}`).get(...params).c;
  const items = req.db.prepare(`
    SELECT cr.*, a.name as account_name, c.content, c.type as content_type_full,
           m.name as movie_name, u.name as worker_name, t.name as task_name
    FROM credentials cr
    LEFT JOIN accounts a ON cr.account_id = a.id
    LEFT JOIN contents c ON cr.content_id = c.id
    LEFT JOIN movies m ON c.movie_id = m.id
    LEFT JOIN users u ON c.worker_id = u.id
    LEFT JOIN tasks t ON cr.task_id = t.id
    ${whereClause}
    ORDER BY cr.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.post('/', (req, res) => {
  const { account_id, content_id, task_id, content_type = '', status = '待AI审核', ai_result = '', published_url = '', image_path = '' } = req.body || {};
  const result = req.db.prepare(
    `INSERT INTO credentials (account_id, content_id, task_id, content_type, status, ai_result, published_url, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(account_id || null, content_id || null, task_id || null, content_type, status, ai_result, published_url, image_path);
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.post('/:id/ai-audit', roles('admin', 'reviewer'), async (req, res) => {
  const cred = req.db.prepare(`
    SELECT cr.*, c.content FROM credentials cr LEFT JOIN contents c ON cr.content_id = c.id WHERE cr.id = ?
  `).get(req.params.id);
  if (!cred) return fail(res, 404, '凭证不存在');
  const result = await auditCredential(req.db, {
    content: cred.content,
    publishedUrl: cred.published_url,
    hasImage: Boolean(cred.image_path)
  });
  req.db.prepare(
    `UPDATE credentials SET ai_status = ?, ai_comment = ?, ai_confidence = ?, ai_result = ?, status = '待终审' WHERE id = ?`
  ).run(result.ai_status, result.ai_comment, result.ai_confidence, result.ai_status, cred.id);
  if (cred.content_id) {
    req.db.prepare(`UPDATE contents SET status = '待终审', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(cred.content_id);
  }
  return ok(res, result, 'AI预审完成');
});

router.put('/:id/audit', roles('admin', 'reviewer'), (req, res) => {
  const { action, comment = '' } = req.body || {};
  if (!action || !['approve', 'reject'].includes(action)) {
    return fail(res, 400, '审核动作只能是approve或reject');
  }
  const cred = req.db.prepare('SELECT * FROM credentials WHERE id = ?').get(req.params.id);
  if (!cred) return fail(res, 404, '凭证不存在');
  const newStatus = action === 'approve' ? '已通过' : '已拒绝';
  req.db.prepare(
    `UPDATE credentials SET status = ?, final_status = ?, final_comment = ?, audit_comment = ?,
     audit_time = datetime('now', 'localtime') WHERE id = ?`
  ).run(newStatus, newStatus, comment, comment, cred.id);

  if (cred.content_id) {
    const contentStatus = action === 'approve' ? '已通过' : '已拒绝';
    const content = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(cred.content_id);
    req.db.prepare(
      `UPDATE contents SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(contentStatus, cred.content_id);
    if (content) {
      if (action === 'reject') {
        req.db.prepare(
          `UPDATE contents SET status = '已领取', updated_at = datetime('now', 'localtime') WHERE id = ?`
        ).run(cred.content_id);
      }
      syncTaskStatus(req.db, content.task_id);
      applyHealthOnAudit(req.db, content.account_id, action === 'approve');
    }
  }

  writeLog(req.db, req, {
    action_type: 'audit', object_type: 'credential', object_id: cred.id,
    description: `终审${action === 'approve' ? '通过' : '驳回'}凭证`,
    before_status: cred.status, after_status: newStatus
  });
  return ok(res, {}, `凭证审核${action === 'approve' ? '通过' : '驳回'}成功`);
});

router.put('/:id', (req, res) => {
  const { status, ai_result, audit_comment } = req.body || {};
  const fields = [];
  const params = [];
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (ai_result !== undefined) { fields.push('ai_result = ?'); params.push(ai_result); }
  if (audit_comment !== undefined) { fields.push('audit_comment = ?'); params.push(audit_comment); }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  params.push(req.params.id);
  req.db.prepare(`UPDATE credentials SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return ok(res, {}, '更新成功');
});

router.delete('/:id', roles('admin'), (req, res) => {
  req.db.prepare('DELETE FROM credentials WHERE id = ?').run(req.params.id);
  return ok(res, {}, '删除成功');
});

module.exports = router;
