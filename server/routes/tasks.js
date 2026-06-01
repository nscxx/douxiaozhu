const express = require('express');
const router = express.Router();

// 列表
router.get('/', (req, res) => {
  const { status, movie_id, account_id, create_method, page = 1, page_size = 100 } = req.query;
  const db = req.db;
  
  let where = [];
  let params = [];
  
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (movie_id) {
    where.push('t.movie_id = ?');
    params.push(movie_id);
  }
  if (account_id) {
    where.push('t.account_id = ?');
    params.push(account_id);
  }
  if (create_method) {
    where.push('t.create_method = ?');
    params.push(create_method);
  }
  
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  
  const countSql = `SELECT COUNT(*) as total FROM tasks t ${whereClause}`;
  const { total } = db.prepare(countSql).get(...params);
  
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const listSql = `
    SELECT t.*, 
      m.name as movie_name, m.type as movie_type,
      a.name as account_name
    FROM tasks t
    LEFT JOIN movies m ON t.movie_id = m.id
    LEFT JOIN accounts a ON t.account_id = a.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const list = db.prepare(listSql).all(...params, parseInt(page_size), offset);
  
  const items = list.map(item => ({
    ...item,
    content_types: JSON.parse(item.content_types || '[]'),
    time_slots: JSON.parse(item.time_slots || '[]')
  }));
  
  res.json({ code: 0, data: { items, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

// 创建（从电影）
router.post('/from-movie', (req, res) => {
  const db = req.db;
  const { movie_ids, account_ids, content_types = [], time_slots = [] } = req.body;
  
  if (!Array.isArray(movie_ids) || movie_ids.length === 0) {
    return res.json({ code: 400, msg: '请选择电影' });
  }
  if (!Array.isArray(account_ids) || account_ids.length === 0) {
    return res.json({ code: 400, msg: '请选择账号' });
  }
  
  const insert = db.prepare(`
    INSERT INTO tasks (name, content_types, status, create_method, movie_id, account_id, time_slots, start_time)
    VALUES (?, ?, '待执行', '从电影创建', ?, ?, ?, datetime('now', 'localtime'))
  `);
  
  const insertMany = db.transaction((mIds, aIds, types, slots) => {
    const results = [];
    for (const movieId of mIds) {
      for (const accountId of aIds) {
        const taskName = `任务_MOVIE-${movieId}-${Date.now()}`;
        const result = insert.run(taskName, JSON.stringify(types), movieId, accountId, JSON.stringify(slots));
        results.push({ id: result.lastInsertRowid, movie_id: movieId, account_id: accountId });
      }
    }
    return results;
  });
  
  const results = insertMany(movie_ids, account_ids, content_types, time_slots);
  res.json({ code: 0, data: { count: results.length, items: results }, msg: `成功创建${results.length}个任务` });
});

// 创建（从时间）
router.post('/from-time', (req, res) => {
  const db = req.db;
  const { time_slot, movie_ids, account_ids, content_types = ['短评', '影评'] } = req.body;
  
  if (!time_slot) return res.json({ code: 400, msg: '请选择发布时段' });
  if (!Array.isArray(movie_ids) || movie_ids.length === 0) {
    return res.json({ code: 400, msg: '请选择电影' });
  }
  if (!Array.isArray(account_ids) || account_ids.length === 0) {
    return res.json({ code: 400, msg: '请选择账号' });
  }
  
  const insert = db.prepare(`
    INSERT INTO tasks (name, content_types, status, create_method, movie_id, account_id, time_slots, start_time)
    VALUES (?, ?, '待执行', '从时间创建', ?, ?, ?, datetime('now', 'localtime'))
  `);
  
  const insertMany = db.transaction((mIds, aIds, types, slot) => {
    const results = [];
    for (const movieId of mIds) {
      for (const accountId of aIds) {
        const taskName = `任务_TIME-${slot}-${Date.now()}`;
        const result = insert.run(taskName, JSON.stringify(types), movieId, accountId, JSON.stringify([slot]));
        results.push({ id: result.lastInsertRowid, movie_id: movieId, account_id: accountId });
      }
    }
    return results;
  });
  
  const results = insertMany(movie_ids, account_ids, content_types, time_slot);
  res.json({ code: 0, data: { count: results.length, items: results }, msg: `成功创建${results.length}个任务` });
});

// 创建（通用）
router.post('/', (req, res) => {
  const db = req.db;
  const { name, content_types = [], status = '待执行', create_method = '', movie_id, account_id, time_slots = [], start_time } = req.body;
  
  if (!name) return res.json({ code: 400, msg: '任务名称不能为空' });
  
  const result = db.prepare(`
    INSERT INTO tasks (name, content_types, status, create_method, movie_id, account_id, time_slots, start_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, JSON.stringify(content_types), status, create_method, movie_id || null, account_id || null, JSON.stringify(time_slots), start_time || null);
  
  res.json({ code: 0, data: { id: result.lastInsertRowid }, msg: '创建成功' });
});

// 更新状态
router.put('/:id', (req, res) => {
  const db = req.db;
  const { status, content_types, time_slots, published_url } = req.body;
  
  const fields = [];
  const params = [];
  
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (content_types !== undefined) { fields.push('content_types = ?'); params.push(JSON.stringify(content_types)); }
  if (time_slots !== undefined) { fields.push('time_slots = ?'); params.push(JSON.stringify(time_slots)); }
  if (published_url !== undefined) { fields.push('published_url = ?'); params.push(published_url); }
  
  if (fields.length === 0) return res.json({ code: 400, msg: '没有更新字段' });
  
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  
  const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...params);
  
  if (result.changes === 0) return res.json({ code: 404, msg: '任务不存在' });
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.json({ code: 404, msg: '任务不存在' });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
