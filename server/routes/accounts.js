const express = require('express');
const router = express.Router();

// 辅助：将sql.js exec结果转为对象数组
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
  const rows = execToObjects(db, sql, params);
  return rows[0] || null;
}

// 列表
router.get('/', (req, res) => {
  const { status, keyword, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  
  if (status) { where.push('status = ?'); params.push(status); }
  if (keyword) { where.push('name LIKE ?'); params.push(`%${keyword}%`); }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  
  const totalRow = execOne(db, `SELECT COUNT(*) as total FROM accounts ${whereClause}`, params);
  const total = totalRow ? totalRow.total : 0;
  
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const list = execToObjects(db, `SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(page_size), offset]);
  
  const items = list.map(item => ({
    ...item,
    a_tags: JSON.parse(item.a_tags || '[]'),
    b_tags: JSON.parse(item.b_tags || '[]')
  }));
  
  res.json({ code: 0, data: { items, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

// 单个查询
router.get('/:id', (req, res) => {
  const db = req.db;
  const item = execOne(db, 'SELECT * FROM accounts WHERE id = ?', [req.params.id]);
  if (!item) return res.json({ code: 404, msg: '账号不存在' });
  item.a_tags = JSON.parse(item.a_tags || '[]');
  item.b_tags = JSON.parse(item.b_tags || '[]');
  res.json({ code: 0, data: item });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { name, a_tags = [], b_tags = [], c_tag = '', d_tag = '', status = '活跃' } = req.body;
  
  if (!name) return res.json({ code: 400, msg: '账号名称不能为空' });
  
  const result = db.run(`INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, JSON.stringify(a_tags), JSON.stringify(b_tags), c_tag, d_tag, status]);
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 批量导入
router.post('/batch', (req, res) => {
  const db = req.db;
  const { accounts } = req.body;
  
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.json({ code: 400, msg: '导入数据不能为空' });
  }
  
  const results = [];
  for (const item of accounts) {
    const result = db.run(`INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [item.name || '', JSON.stringify(item.a_tags || []), JSON.stringify(item.b_tags || []), item.c_tag || '', item.d_tag || '', item.status || '活跃']);
    results.push({ id: result.lastInsertRowid, name: item.name });
  }
  
  res.json({ code: 0, data: { count: results.length, items: results }, msg: `成功导入${results.length}个账号` });
});

// 更新
router.put('/:id', (req, res) => {
  const db = req.db;
  const { name, a_tags, b_tags, c_tag, d_tag, status, content_count, health, last_active_at } = req.body;
  
  const fields = [];
  const params = [];
  
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (a_tags !== undefined) { fields.push('a_tags = ?'); params.push(JSON.stringify(a_tags)); }
  if (b_tags !== undefined) { fields.push('b_tags = ?'); params.push(JSON.stringify(b_tags)); }
  if (c_tag !== undefined) { fields.push('c_tag = ?'); params.push(c_tag); }
  if (d_tag !== undefined) { fields.push('d_tag = ?'); params.push(d_tag); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (content_count !== undefined) { fields.push('content_count = ?'); params.push(content_count); }
  if (health !== undefined) { fields.push('health = ?'); params.push(health); }
  if (last_active_at !== undefined) { fields.push('last_active_at = ?'); params.push(last_active_at); }
  
  if (fields.length === 0) return res.json({ code: 400, msg: '没有更新字段' });
  
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  
  const result = db.run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.run('DELETE FROM accounts WHERE id = ?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
