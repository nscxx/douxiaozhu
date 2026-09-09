const express = require('express');
const { ok, fail, paginate } = require('../db-utils');
const { writeLog, syncTaskStatus } = require('../lib/ops');
const { auditCredential } = require('../lib/ai');
const router = express.Router();

function contentRow(db, id) {
  return db.prepare(`
    SELECT c.*, t.name as task_name, a.name as account_name, m.name as movie_name,
           u.name as worker_name
    FROM contents c
    LEFT JOIN tasks t ON c.task_id = t.id
    LEFT JOIN accounts a ON c.account_id = a.id
    LEFT JOIN movies m ON c.movie_id = m.id
    LEFT JOIN users u ON c.worker_id = u.id
    WHERE c.id = ?
  `).get(id);
}

router.get('/', (req, res) => {
  const { status, task_id, account_id, movie_id, worker_id, keyword } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (task_id) { where.push('c.task_id = ?'); params.push(task_id); }
  if (account_id) { where.push('c.account_id = ?'); params.push(account_id); }
  if (movie_id) { where.push('c.movie_id = ?'); params.push(movie_id); }
  if (worker_id) { where.push('c.worker_id = ?'); params.push(worker_id); }
  if (keyword) {
    where.push('(c.content LIKE ? OR m.name LIKE ? OR a.name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM contents c LEFT JOIN movies m ON c.movie_id = m.id LEFT JOIN accounts a ON c.account_id = a.id ${whereClause}`).get(...params).c;
  const items = req.db.prepare(`
    SELECT c.*, t.name as task_name, a.name as account_name, m.name as movie_name, u.name as worker_name
    FROM contents c
    LEFT JOIN tasks t ON c.task_id = t.id
    LEFT JOIN accounts a ON c.account_id = a.id
    LEFT JOIN movies m ON c.movie_id = m.id
    LEFT JOIN users u ON c.worker_id = u.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.get('/:id', (req, res) => {
  const item = contentRow(req.db, req.params.id);
  if (!item) return fail(res, 404, '内容不存在');
  return ok(res, item);
});

router.post('/', (req, res) => {
  const { task_id, account_id, movie_id, type = '', content = '', status = '待生成', published_url = '' } = req.body || {};
  const result = req.db.prepare(
    `INSERT INTO contents (task_id, account_id, movie_id, type, content, status, published_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(task_id || null, account_id || null, movie_id || null, type, content, status, published_url);
  if (task_id) syncTaskStatus(req.db, task_id);
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.put('/:id', (req, res) => {
  const { type, content, status, published_url } = req.body || {};
  const fields = [];
  const params = [];
  if (type !== undefined) { fields.push('type = ?'); params.push(type); }
  if (content !== undefined) { fields.push('content = ?'); params.push(content); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (published_url !== undefined) { fields.push('published_url = ?'); params.push(published_url); }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  const existing = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  req.db.prepare(`UPDATE contents SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  if (existing) syncTaskStatus(req.db, existing.task_id);
  return ok(res, {}, '更新成功');
});

router.delete('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  req.db.prepare('DELETE FROM contents WHERE id = ?').run(req.params.id);
  if (existing) syncTaskStatus(req.db, existing.task_id);
  return ok(res, {}, '删除成功');
});

router.post('/:id/claim', (req, res) => {
  const row = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  if (!row) return fail(res, 404, '内容不存在');
  if (row.status !== '待领取') return fail(res, 400, '该内容当前不可领取');
  const result = req.db.prepare(
    `UPDATE contents SET status = '已领取', worker_id = ?, claimed_at = datetime('now', 'localtime'),
     updated_at = datetime('now', 'localtime')
     WHERE id = ? AND status = '待领取'`
  ).run(req.user.id, req.params.id);
  if (result.changes !== 1) return fail(res, 409, '已被他人领取');
  syncTaskStatus(req.db, row.task_id);
  writeLog(req.db, req, {
    action_type: 'task', object_type: 'content', object_id: row.id,
    description: `领取任务 ${row.id}`, before_status: '待领取', after_status: '已领取'
  });
  return ok(res, contentRow(req.db, row.id), '领取成功');
});

router.post('/:id/release', (req, res) => {
  const row = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  if (!row) return fail(res, 404, '内容不存在');
  const isOwner = row.worker_id === req.user.id;
  const isAdmin = ['admin', 'reviewer'].includes(req.user.role);
  if (!isOwner && !isAdmin) return fail(res, 403, '没有权限', 403);
  req.db.prepare(
    `UPDATE contents SET status = '待领取', worker_id = NULL, claimed_at = NULL, updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(row.id);
  syncTaskStatus(req.db, row.task_id);
  return ok(res, {}, '已释放');
});

router.post('/:id/credential', async (req, res) => {
  const row = req.db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  if (!row) return fail(res, 404, '内容不存在');
  if (!['已领取', '待发布', '已拒绝'].includes(row.status)) {
    return fail(res, 400, '当前状态不能提交凭证');
  }
  if (req.user.role === 'worker' && row.worker_id !== req.user.id) {
    return fail(res, 403, '只能提交自己领取的任务', 403);
  }
  const { published_url = '', image_path = '' } = req.body || {};
  if (!published_url || !image_path) return fail(res, 400, '发布链接和截图都必填');

  req.db.prepare(
    `UPDATE contents SET status = '待AI审核', published_url = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(published_url, row.id);

  const cred = req.db.prepare(
    `INSERT INTO credentials (account_id, content_id, task_id, content_type, image_path, published_url, status)
     VALUES (?, ?, ?, ?, ?, ?, '待AI审核')`
  ).run(row.account_id, row.id, row.task_id, row.type, image_path, published_url);

  writeLog(req.db, req, {
    action_type: 'audit', object_type: 'credential', object_id: cred.lastInsertRowid,
    description: `提交凭证 content#${row.id}`, after_status: '待AI审核'
  });

  try {
    const imageUrl = image_path.startsWith('http') ? image_path : undefined;
    const result = await auditCredential(req.db, {
      content: row.content,
      publishedUrl: published_url,
      hasImage: Boolean(image_path),
      imageUrl
    });
    req.db.prepare(
      `UPDATE credentials SET ai_status = ?, ai_comment = ?, ai_confidence = ?, ai_result = ?, status = '待终审'
       WHERE id = ?`
    ).run(result.ai_status, result.ai_comment, result.ai_confidence, result.ai_status, cred.lastInsertRowid);
    req.db.prepare(
      `UPDATE contents SET status = '待终审', updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(row.id);
  } catch (err) {
    req.db.prepare(
      `UPDATE credentials SET ai_status = '存疑', ai_comment = ?, status = '待终审' WHERE id = ?`
    ).run(`预审异常：${err.message}`, cred.lastInsertRowid);
    req.db.prepare(`UPDATE contents SET status = '待终审', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(row.id);
  }
  syncTaskStatus(req.db, row.task_id);
  return ok(res, { credential_id: cred.lastInsertRowid }, '凭证已提交，等待审核');
});

module.exports = router;
