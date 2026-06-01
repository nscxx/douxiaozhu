const express = require('express');
const router = express.Router();

// 列表
router.get('/', (req, res) => {
  const { keyword, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  
  if (keyword) {
    where.push('name LIKE ?');
    params.push(`%${keyword}%`);
  }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  
  const countSql = `SELECT COUNT(*) as total FROM movies ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);
  
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const listSql = `SELECT * FROM movies ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const list = db.prepare(listSql).all(...params, parseInt(page_size), offset);
  
  const items = list.map(item => ({
    ...item,
    tags: JSON.parse(item.tags || '[]')
  }));
  
  res.json({ code: 0, data: { items, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

// 单个查询
router.get('/:id', (req, res) => {
  const db = req.db;
  const item = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!item) return res.json({ code: 404, msg: '电影不存在' });
  item.tags = JSON.parse(item.tags || '[]');
  res.json({ code: 0, data: item });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { name, type = '', year = '', director = '', score = 0, comments = 0, tags = [] } = req.body;
  
  if (!name) return res.json({ code: 400, msg: '电影名称不能为空' });
  
  const result = db.prepare(`
    INSERT INTO movies (name, type, year, director, score, comments, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, year, director, score, comments, JSON.stringify(tags));
  
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 批量导入
router.post('/batch', (req, res) => {
  const db = req.db;
  const { movies } = req.body;
  
  if (!Array.isArray(movies) || movies.length === 0) {
    return res.json({ code: 400, msg: '导入数据不能为空' });
  }
  
  const insert = db.prepare(`
    INSERT INTO movies (name, type, year, director, score, comments, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((items) => {
    const results = [];
    for (const item of items) {
      const result = insert.run(
        item.name || '',
        item.type || '',
        item.year || '',
        item.director || '',
        item.score || 0,
        item.comments || 0,
        JSON.stringify(item.tags || [])
      );
      results.push({ id: result.lastInsertRowid, name: item.name });
    }
    return results;
  });
  
  const results = insertMany(movies);
  res.json({ code: 0, data: { count: results.length, items: results }, msg: `成功导入${results.length}部电影` });
});

// 更新
router.put('/:id', (req, res) => {
  const db = req.db;
  const { name, type, year, director, score, comments, tags } = req.body;
  
  const fields = [];
  const params = [];
  
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (type !== undefined) { fields.push('type = ?'); params.push(type); }
  if (year !== undefined) { fields.push('year = ?'); params.push(year); }
  if (director !== undefined) { fields.push('director = ?'); params.push(director); }
  if (score !== undefined) { fields.push('score = ?'); params.push(score); }
  if (comments !== undefined) { fields.push('comments = ?'); params.push(comments); }
  if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
  
  if (fields.length === 0) return res.json({ code: 400, msg: '没有更新字段' });
  
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  
  const sql = `UPDATE movies SET ${fields.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...params);
  
  if (result.changes === 0) return res.json({ code: 404, msg: '电影不存在' });
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.json({ code: 404, msg: '电影不存在' });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
