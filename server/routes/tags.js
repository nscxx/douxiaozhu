const express = require('express');
const { ok, fail } = require('../db-utils');
const router = express.Router();

router.get('/', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM tags';
  const params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY category, id';
  const items = req.db.prepare(sql).all(...params);
  return ok(res, { items });
});

router.get('/grouped', (req, res) => {
  const items = req.db.prepare('SELECT * FROM tags ORDER BY category, id').all();
  const grouped = { A: [], B: [], C: [], D: [] };
  for (const item of items) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }
  const tree = {};
  for (const cat of ['A', 'B', 'C', 'D']) {
    const all = grouped[cat];
    const parents = all.filter((t) => !t.parent_id);
    tree[cat] = parents.map((p) => ({
      ...p,
      children: all.filter((c) => c.parent_id === p.id)
    }));
  }
  return ok(res, { grouped, tree, items });
});

router.post('/', (req, res) => {
  const { category, name, code = '', parent_id = null } = req.body || {};
  if (!category || !name) return fail(res, 400, '分类和名称不能为空');
  if (!['A', 'B', 'C', 'D'].includes(category)) return fail(res, 400, '分类只能是A/B/C/D');
  const existing = req.db.prepare('SELECT id FROM tags WHERE category = ? AND name = ? AND ifnull(parent_id,0) = ifnull(?,0)').get(category, name, parent_id);
  if (existing) return fail(res, 400, '该标签已存在');
  const result = req.db.prepare('INSERT INTO tags (category, code, name, parent_id) VALUES (?, ?, ?, ?)').run(category, code, name, parent_id);
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.post('/batch', (req, res) => {
  const { tags } = req.body || {};
  if (!Array.isArray(tags) || !tags.length) return fail(res, 400, '标签数据不能为空');
  let count = 0;
  const insert = req.db.prepare('INSERT INTO tags (category, code, name, parent_id) VALUES (?, ?, ?, ?)');
  for (const item of tags) {
    if (!item.category || !item.name || !['A', 'B', 'C', 'D'].includes(item.category)) continue;
    const existing = req.db.prepare('SELECT id FROM tags WHERE category = ? AND name = ?').get(item.category, item.name);
    if (!existing) {
      insert.run(item.category, item.code || '', item.name, item.parent_id || null);
      count += 1;
    }
  }
  return ok(res, { count }, `成功添加${count}个标签`);
});

router.delete('/:id', (req, res) => {
  req.db.prepare('DELETE FROM tags WHERE parent_id = ?').run(req.params.id);
  req.db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  return ok(res, {}, '删除成功');
});

module.exports = router;
