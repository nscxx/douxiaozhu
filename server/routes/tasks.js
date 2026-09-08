const express = require('express');
const { ok, fail, paginate, parseTags, parseJson } = require('../db-utils');
const { writeLog, syncTaskStatus } = require('../lib/ops');
const router = express.Router();

function normalizeTypes(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => {
      if (typeof item === 'string') return { type: item, count: 1 };
      return { type: item.type || item.name, count: Math.max(1, parseInt(item.count, 10) || 1) };
    }).filter((x) => x.type);
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, count]) => Number(count) > 0)
      .map(([type, count]) => ({ type, count: Number(count) }));
  }
  return [];
}

function createContentsForTask(db, { taskId, movieId, accountId, types }) {
  const stmt = db.prepare(
    `INSERT INTO contents (task_id, account_id, movie_id, type, content, status)
     VALUES (?, ?, ?, ?, '', '待生成')`
  );
  let count = 0;
  for (const { type, count: n } of types) {
    for (let i = 0; i < n; i += 1) {
      stmt.run(taskId, accountId, movieId, type);
      count += 1;
    }
  }
  return count;
}

router.get('/', (req, res) => {
  const { status, movie_id, account_id, create_method } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (movie_id) { where.push('t.movie_id = ?'); params.push(movie_id); }
  if (account_id) { where.push('t.account_id = ?'); params.push(account_id); }
  if (create_method) { where.push('t.create_method = ?'); params.push(create_method); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM tasks t ${whereClause}`).get(...params).c;
  const items = req.db.prepare(`
    SELECT t.*, m.name as movie_name, m.type as movie_type, a.name as account_name,
      (SELECT COUNT(*) FROM contents c WHERE c.task_id = t.id) as content_total,
      (SELECT COUNT(*) FROM contents c WHERE c.task_id = t.id AND c.status = '已通过') as content_done
    FROM tasks t
    LEFT JOIN movies m ON t.movie_id = m.id
    LEFT JOIN accounts a ON t.account_id = a.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset).map(parseTags);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.get('/calendar', (req, res) => {
  const { year, month } = req.query;
  const now = new Date();
  const y = parseInt(year, 10) || now.getFullYear();
  const m = parseInt(month, 10) || (now.getMonth() + 1);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  const rows = req.db.prepare(`
    SELECT date(created_at) as day,
      COUNT(*) as total,
      SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status IN ('待执行','执行中') THEN 1 ELSE 0 END) as pending
    FROM tasks
    WHERE created_at >= ? AND created_at < ?
    GROUP BY date(created_at)
  `).all(start, end);
  const items = req.db.prepare(`
    SELECT t.*, m.name as movie_name, a.name as account_name
    FROM tasks t
    LEFT JOIN movies m ON t.movie_id = m.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.created_at >= ? AND t.created_at < ?
    ORDER BY t.created_at DESC
  `).all(start, end).map(parseTags);
  return ok(res, { year: y, month: m, days: rows, items });
});

function createPairTasks(db, { movieIds, accountIds, types, timeSlots, method, startTime }) {
  const results = [];
  const insert = db.prepare(
    `INSERT INTO tasks (name, content_types, status, create_method, movie_id, account_id, time_slots, start_time)
     VALUES (?, ?, '待执行', ?, ?, ?, ?, ?)`
  );
  for (const movieId of movieIds) {
    for (const accountId of accountIds) {
      const movie = db.prepare('SELECT name FROM movies WHERE id = ?').get(movieId);
      const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(accountId);
      const taskName = `${movie ? movie.name : '电影'} × ${account ? account.name : '账号'} · ${method}`;
      const result = insert.run(
        taskName, JSON.stringify(types), method, movieId, accountId,
        JSON.stringify(timeSlots), startTime || null
      );
      const n = createContentsForTask(db, { taskId: result.lastInsertRowid, movieId, accountId, types });
      results.push({ id: result.lastInsertRowid, movie_id: movieId, account_id: accountId, content_count: n });
    }
  }
  return results;
}

router.post('/from-movie', (req, res) => {
  const { movie_ids, account_ids, content_types, time_slots = [] } = req.body || {};
  if (!Array.isArray(movie_ids) || !movie_ids.length) return fail(res, 400, '请选择电影');
  if (!Array.isArray(account_ids) || !account_ids.length) return fail(res, 400, '请选择账号');
  const types = normalizeTypes(content_types);
  if (!types.length) return fail(res, 400, '请至少设置一种内容类型');
  const results = createPairTasks(req.db, {
    movieIds: movie_ids, accountIds: account_ids, types, timeSlots: time_slots,
    method: '从电影创建', startTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  });
  writeLog(req.db, req, {
    action_type: 'task', object_type: 'task',
    description: `从电影创建${results.length}个任务`, after_status: '待执行'
  });
  return ok(res, { count: results.length, items: results }, `成功创建${results.length}个任务`);
});

router.post('/from-time', (req, res) => {
  const { time_slot, movie_ids, account_ids, content_types } = req.body || {};
  if (!time_slot) return fail(res, 400, '请选择发布时段');
  if (!Array.isArray(movie_ids) || !movie_ids.length) return fail(res, 400, '请选择电影');
  if (!Array.isArray(account_ids) || !account_ids.length) return fail(res, 400, '请选择账号');
  const types = normalizeTypes(content_types && Object.keys(content_types).length ? content_types : ['短评', '影评']);
  const results = createPairTasks(req.db, {
    movieIds: movie_ids, accountIds: account_ids, types, timeSlots: [time_slot],
    method: '从时间创建'
  });
  writeLog(req.db, req, {
    action_type: 'task', object_type: 'task',
    description: `从时间创建${results.length}个任务（${time_slot}）`, after_status: '待执行'
  });
  return ok(res, { count: results.length, items: results }, `成功创建${results.length}个任务`);
});

router.post('/from-account', (req, res) => {
  const { account_ids, movie_ids, content_types, time_slot } = req.body || {};
  if (!Array.isArray(account_ids) || !account_ids.length) return fail(res, 400, '请选择账号');
  if (!Array.isArray(movie_ids) || !movie_ids.length) return fail(res, 400, '请选择电影');
  const types = normalizeTypes(content_types);
  if (!types.length) return fail(res, 400, '请至少设置一种内容类型');
  const results = createPairTasks(req.db, {
    movieIds: movie_ids, accountIds: account_ids, types,
    timeSlots: time_slot ? [time_slot] : [], method: '从账号创建'
  });
  return ok(res, { count: results.length, items: results }, `成功创建${results.length}个任务`);
});

router.post('/', (req, res) => {
  const { name, content_types = [], status = '待执行', create_method = '', movie_id, account_id, time_slots = [], start_time } = req.body || {};
  if (!name) return fail(res, 400, '任务名称不能为空');
  const types = normalizeTypes(content_types);
  const result = req.db.prepare(
    `INSERT INTO tasks (name, content_types, status, create_method, movie_id, account_id, time_slots, start_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, JSON.stringify(types), status, create_method, movie_id || null, account_id || null, JSON.stringify(time_slots), start_time || null);
  if (movie_id && account_id && types.length) {
    createContentsForTask(req.db, { taskId: result.lastInsertRowid, movieId: movie_id, accountId: account_id, types });
  }
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.put('/:id', (req, res) => {
  const { status, content_types, time_slots, published_url } = req.body || {};
  const fields = [];
  const params = [];
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (content_types !== undefined) { fields.push('content_types = ?'); params.push(JSON.stringify(content_types)); }
  if (time_slots !== undefined) { fields.push('time_slots = ?'); params.push(JSON.stringify(time_slots)); }
  if (published_url !== undefined) { fields.push('published_url = ?'); params.push(published_url); }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  req.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return ok(res, {}, '更新成功');
});

router.delete('/:id', (req, res) => {
  req.db.prepare('DELETE FROM contents WHERE task_id = ?').run(req.params.id);
  req.db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  return ok(res, {}, '删除成功');
});

router.post('/:id/generate', async (req, res) => {
  const task = req.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return fail(res, 404, '任务不存在');
  const { generateContent } = require('../lib/ai');
  const pending = req.db.prepare(`SELECT * FROM contents WHERE task_id = ? AND status = '待生成'`).all(req.params.id);
  let count = 0;
  for (const row of pending) {
    const movie = parseTags(req.db.prepare('SELECT * FROM movies WHERE id = ?').get(row.movie_id) || {});
    const account = parseTags(req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(row.account_id) || {});
    try {
      const text = await generateContent(req.db, { movie, account, type: row.type });
      req.db.prepare(
        `UPDATE contents SET content = ?, status = '待领取', updated_at = datetime('now', 'localtime') WHERE id = ?`
      ).run(text, row.id);
      count += 1;
    } catch (err) {
      req.db.prepare(
        `UPDATE contents SET content = ?, status = '待生成', updated_at = datetime('now', 'localtime') WHERE id = ?`
      ).run(`[生成失败] ${err.message}`, row.id);
    }
  }
  syncTaskStatus(req.db, task.id);
  writeLog(req.db, req, {
    action_type: 'content', object_type: 'task', object_id: task.id,
    description: `任务批量生成 ${count} 条内容`, after_status: '待领取'
  });
  return ok(res, { count }, `已生成${count}条内容`);
});

module.exports = router;
