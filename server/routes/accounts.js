const express = require('express');
const router = express.Router();

// 列表
router.get('/', (req, res) => {
  const { status, keyword, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (keyword) {
    where.push('name LIKE ?');
    params.push(`%${keyword}%`);
  }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  
  // 总数
  const countSql = `SELECT COUNT(*) as total FROM accounts ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);
  
  // 分页
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const listSql = `SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const list = db.prepare(listSql).all(...params, parseInt(page_size), offset);
  
  // 解析JSON字段
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
  const item = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
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
  
  const result = db.prepare(`
    INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, JSON.stringify(a_tags), JSON.stringify(b_tags), c_tag, d_tag, status);
  
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 批量导入
router.post('/batch', (req, res) => {
  const db = req.db;
  const { accounts } = req.body;
  
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.json({ code: 400, msg: '导入数据不能为空' });
  }
  
  const insert = db.prepare(`
    INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((items) => {
    const results = [];
    for (const item of items) {
      const result = insert.run(
        item.name || '',
        JSON.stringify(item.a_tags || []),
        JSON.stringify(item.b_tags || []),
        item.c_tag || '',
        item.d_tag || '',
        item.status || '活跃'
      );
      results.push({ id: result.lastInsertRowid, name: item.name });
    }
    return results;
  });
  
  const results = insertMany(accounts);
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
  
  const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...params);
  
  if (result.changes === 0) return res.json({ code: 404, msg: '账号不存在' });
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.json({ code: 404, msg: '账号不存在' });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
