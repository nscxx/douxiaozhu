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
  const { status, task_id, account_id, movie_id, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (task_id) { where.push('c.task_id = ?'); params.push(task_id); }
  if (account_id) { where.push('c.account_id = ?'); params.push(account_id); }
  if (movie_id) { where.push('c.movie_id = ?'); params.push(movie_id); }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const totalRow = execOne(db, `SELECT COUNT(*) as total FROM contents c ${whereClause}`, params);
  const total = totalRow ? totalRow.total : 0;
  
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const items = execToObjects(db, `
    SELECT c.*, t.name as task_name, a.name as account_name, m.name as movie_name
    FROM contents c
    LEFT JOIN tasks t ON c.task_id = t.id
    LEFT JOIN accounts a ON c.account_id = a.id
    LEFT JOIN movies m ON c.movie_id = m.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, parseInt(page_size), offset]);
  
  res.json({ code: 0, data: { items, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { task_id, account_id, movie_id, type = '', content = '', status = '待发布', published_url = '' } = req.body;
  
  const result = db.run(`INSERT INTO contents (task_id, account_id, movie_id, type, content, status, published_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [task_id || null, account_id || null, movie_id || null, type, content, status, published_url]);
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 更新
router.put('/:id', (req, res) => {
  const db = req.db;
  const { type, content, status, published_url } = req.body;
  
  const fields = [];
  const params = [];
  
  if (type !== undefined) { fields.push('type = ?'); params.push(type); }
  if (content !== undefined) { fields.push('content = ?'); params.push(content); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (published_url !== undefined) { fields.push('published_url = ?'); params.push(published_url); }
  
  if (fields.length === 0) return res.json({ code: 400, msg: '没有更新字段' });
  
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  
  const result = db.run(`UPDATE contents SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.run('DELETE FROM contents WHERE id = ?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
