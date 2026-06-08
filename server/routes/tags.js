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
  const { category } = req.query;
  const db = req.db;
  
  let sql = 'SELECT * FROM tags';
  let params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY category, id';
  
  const items = execToObjects(db, sql, params);
  res.json({ code: 0, data: { items } });
});

// 按分类分组
router.get('/grouped', (req, res) => {
  const db = req.db;
  const items = execToObjects(db, 'SELECT * FROM tags ORDER BY category, id');
  
  const grouped = { A: [], B: [], C: [], D: [] };
  for (const item of items) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }
  
  res.json({ code: 0, data: grouped });
});

// 创建
router.post('/', (req, res) => {
  const db = req.db;
  const { category, name } = req.body;
  
  if (!category || !name) return res.json({ code: 400, msg: '分类和名称不能为空' });
  if (!['A', 'B', 'C', 'D'].includes(category)) return res.json({ code: 400, msg: '分类只能是A/B/C/D' });
  
  const existing = execOne(db, 'SELECT id FROM tags WHERE category = ? AND name = ?', [category, name]);
  if (existing) return res.json({ code: 400, msg: '该标签已存在' });
  
  const result = db.run('INSERT INTO tags (category, name) VALUES (?, ?)', [category, name]);
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 批量创建
router.post('/batch', (req, res) => {
  const db = req.db;
  const { tags } = req.body;
  
  if (!Array.isArray(tags) || tags.length === 0) return res.json({ code: 400, msg: '标签数据不能为空' });
  
  let count = 0;
  for (const item of tags) {
    if (item.category && item.name && ['A', 'B', 'C', 'D'].includes(item.category)) {
      const existing = execOne(db, 'SELECT id FROM tags WHERE category = ? AND name = ?', [item.category, item.name]);
      if (!existing) {
        const result = db.run('INSERT INTO tags (category, name) VALUES (?, ?)', [item.category, item.name]);
        count++;
      }
    }
  }
  
  res.json({ code: 0, data: { count }, msg: `成功添加${count}个标签` });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
