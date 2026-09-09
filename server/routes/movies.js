const express = require('express');
const { ok, fail, paginate, parseTags } = require('../db-utils');
const { writeLog } = require('../lib/ops');
const router = express.Router();

router.get('/', (req, res) => {
  const { keyword } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (keyword) { where.push('(name LIKE ? OR director LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM movies ${whereClause}`).get(...params).c;
  const items = req.db.prepare(
    `SELECT * FROM movies ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset).map(parseTags);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.get('/:id', (req, res) => {
  const item = req.db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!item) return fail(res, 404, '电影不存在');
  return ok(res, parseTags(item));
});

router.post('/', (req, res) => {
  const { name, type = '', year = '', director = '', score = 0, comments = 0, tags = [], douban_url = '' } = req.body || {};
  if (!name) return fail(res, 400, '电影名称不能为空');
  const result = req.db.prepare(
    'INSERT INTO movies (name, type, year, director, score, comments, tags, douban_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, type, year, director, score, comments, JSON.stringify(tags), douban_url);
  writeLog(req.db, req, {
    action_type: 'content', object_type: 'movie', object_id: result.lastInsertRowid,
    description: `添加电影 ${name}`, after_status: '已入库'
  });
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.post('/batch', (req, res) => {
  const { movies } = req.body || {};
  if (!Array.isArray(movies) || !movies.length) return fail(res, 400, '导入数据不能为空');
  const stmt = req.db.prepare(
    'INSERT INTO movies (name, type, year, director, score, comments, tags, douban_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const items = [];
  const tx = req.db.transaction((rows) => {
    for (const item of rows) {
      const result = stmt.run(
        item.name || '', item.type || '', item.year || '', item.director || '',
        item.score || 0, item.comments || 0, JSON.stringify(item.tags || []), item.douban_url || ''
      );
      items.push({ id: result.lastInsertRowid, name: item.name });
    }
  });
  tx(movies);
  return ok(res, { count: items.length, items }, `成功导入${items.length}部电影`);
});

router.put('/:id', (req, res) => {
  const { name, type, year, director, score, comments, tags, douban_url } = req.body || {};
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (type !== undefined) { fields.push('type = ?'); params.push(type); }
  if (year !== undefined) { fields.push('year = ?'); params.push(year); }
  if (director !== undefined) { fields.push('director = ?'); params.push(director); }
  if (score !== undefined) { fields.push('score = ?'); params.push(score); }
  if (comments !== undefined) { fields.push('comments = ?'); params.push(comments); }
  if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
  if (douban_url !== undefined) { fields.push('douban_url = ?'); params.push(douban_url); }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  req.db.prepare(`UPDATE movies SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return ok(res, {}, '更新成功');
});

router.delete('/:id', (req, res) => {
  req.db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  return ok(res, {}, '删除成功');
});

module.exports = router;
