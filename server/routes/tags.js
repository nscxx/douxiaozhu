const express = require('express');
const router = express.Router();

// 列表（按分类）
router.get('/', (req, res) => {
  const { category } = req.query;
  const db = req.db;
  
  let sql = 'SELECT * FROM tags';
  let params = [];
  
  if (category) {
    sql += ' WHERE category = ?';
    params.push(category);
  }
  sql += ' ORDER BY category, id';
  
  const items = db.prepare(sql).all(...params);
  res.json({ code: 0, data: { items } });
});

// 按分类分组返回
router.get('/grouped', (req, res) => {
  const db = req.db;
  const items = db.prepare('SELECT * FROM tags ORDER BY category, id').all();
  
  const grouped = { A: [], B: [], C: [], D: [] };
  for (const item of items) {
    if (grouped[item.category]) {
      grouped[item.category].push(item);
    }
  }
  
  res.json({ code: 0, data: grouped });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { category, name } = req.body;
  
  if (!category || !name) return res.json({ code: 400, msg: '分类和名称不能为空' });
  if (!['A', 'B', 'C', 'D'].includes(category)) return res.json({ code: 400, msg: '分类只能是A/B/C/D' });
  
  // 检查重复
  const existing = db.prepare('SELECT id FROM tags WHERE category = ? AND name = ?').get(category, name);
  if (existing) return res.json({ code: 400, msg: '该标签已存在' });
  
  const result = db.prepare('INSERT INTO tags (category, name) VALUES (?, ?)').run(category, name);
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 批量创建
router.post('/batch', (req, res) => {
  const db = req.db;
  const { tags } = req.body;
  
  if (!Array.isArray(tags) || tags.length === 0) {
    return res.json({ code: 400, msg: '标签数据不能为空' });
  }
  
  const insert = db.prepare('INSERT OR IGNORE INTO tags (category, name) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    let count = 0;
    for (const item of items) {
      if (item.category && item.name && ['A', 'B', 'C', 'D'].includes(item.category)) {
        const result = insert.run(item.category, item.name);
        if (result.changes > 0) count++;
      }
    }
    return count;
  });
  
  const count = insertMany(tags);
  res.json({ code: 0, data: { count }, msg: `成功添加${count}个标签` });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.json({ code: 404, msg: '标签不存在' });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
