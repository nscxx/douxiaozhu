const express = require('express');
const router = express.Router();

function execToObjects(db, sql, params) {
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function execOne(db, sql, params) {
  return execToObjects(db, sql, params)[0] || null;
}

// 列表
router.get('/', (req, res) => {
  const { status, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  if (status) { where.push('cr.status = ?'); params.push(status); }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const totalRow = execOne(db, `SELECT COUNT(*) as total FROM credentials cr ${whereClause}`, params);
  const total = totalRow ? totalRow.total : 0;
  
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const items = execToObjects(db, `
    SELECT cr.*, a.name as account_name
    FROM credentials cr
    LEFT JOIN accounts a ON cr.account_id = a.id
    ${whereClause}
    ORDER BY cr.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, parseInt(page_size), offset]);
  
  res.json({ code: 0, data: { items, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { account_id, content_type = '', status = '待审核', ai_result = '' } = req.body;
  
  const result = db.run(`INSERT INTO credentials (account_id, content_type, status, ai_result) VALUES (?, ?, ?, ?)`,
    [account_id || null, content_type, status, ai_result]);
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 审核
router.put('/:id/audit', (req, res) => {
  const db = req.db;
  const { action, comment = '' } = req.body;
  
  if (!action || !['approve', 'reject'].includes(action)) {
    return res.json({ code: 400, msg: '审核动作只能是approve或reject' });
  }
  
  const newStatus = action === 'approve' ? '已通过' : '已拒绝';
  const result = db.run(`UPDATE credentials SET status = ?, audit_comment = ?, audit_time = datetime('now', 'localtime') WHERE id = ?`,
    [newStatus, comment, req.params.id]);
  
  res.json({ code: 0, msg: `凭证审核${action === 'approve' ? '通过' : '驳回'}成功` });
});

// 更新
router.put('/:id', (req, res) => {
  const db = req.db;
  const { status, ai_result, audit_comment } = req.body;
  
  const fields = [];
  const params = [];
  
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (ai_result !== undefined) { fields.push('ai_result = ?'); params.push(ai_result); }
  if (audit_comment !== undefined) { fields.push('audit_comment = ?'); params.push(audit_comment); }
  
  if (fields.length === 0) return res.json({ code: 400, msg: '没有更新字段' });
  
  params.push(req.params.id);
  const result = db.run(`UPDATE credentials SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.run('DELETE FROM credentials WHERE id = ?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
