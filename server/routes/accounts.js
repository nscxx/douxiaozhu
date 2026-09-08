const express = require('express');
const { ok, fail, paginate, parseTags } = require('../db-utils');
const { writeLog } = require('../lib/ops');
const router = express.Router();

router.get('/', (req, res) => {
  const { status, keyword } = req.query;
  const { page, pageSize, offset } = paginate(req.query);
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (keyword) {
    where.push('(name LIKE ? OR login_account LIKE ? OR douban_uid LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as c FROM accounts ${whereClause}`).get(...params).c;
  const items = req.db.prepare(
    `SELECT * FROM accounts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset).map(parseTags);
  return ok(res, { items, total, page, page_size: pageSize });
});

router.get('/:id', (req, res) => {
  const item = req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!item) return fail(res, 404, '账号不存在');
  return ok(res, parseTags(item));
});

router.post('/', (req, res) => {
  const {
    name, a_tags = [], b_tags = [], c_tag = '', d_tag = '',
    status = '活跃', login_account = '', douban_uid = '', remark = ''
  } = req.body || {};
  if (!name) return fail(res, 400, '账号名称不能为空');
  const result = req.db.prepare(
    `INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status, login_account, douban_uid, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, JSON.stringify(a_tags), JSON.stringify(b_tags), c_tag, d_tag, status, login_account, douban_uid, remark);
  writeLog(req.db, req, {
    action_type: 'account', object_type: 'account', object_id: result.lastInsertRowid,
    description: `新建账号 ${name}`, after_status: status
  });
  return ok(res, { id: result.lastInsertRowid }, '创建成功');
});

router.post('/batch', (req, res) => {
  const { accounts } = req.body || {};
  if (!Array.isArray(accounts) || !accounts.length) return fail(res, 400, '导入数据不能为空');
  const stmt = req.db.prepare(
    `INSERT INTO accounts (name, a_tags, b_tags, c_tag, d_tag, status, login_account, douban_uid, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const items = [];
  const tx = req.db.transaction((rows) => {
    for (const item of rows) {
      const result = stmt.run(
        item.name || '', JSON.stringify(item.a_tags || []), JSON.stringify(item.b_tags || []),
        item.c_tag || '', item.d_tag || '', item.status || '活跃',
        item.login_account || '', item.douban_uid || '', item.remark || ''
      );
      items.push({ id: result.lastInsertRowid, name: item.name });
    }
  });
  tx(accounts);
  writeLog(req.db, req, {
    action_type: 'account', object_type: 'account',
    description: `批量导入${items.length}个账号`, after_status: '活跃'
  });
  return ok(res, { count: items.length, items }, `成功导入${items.length}个账号`);
});

router.put('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 404, '账号不存在');
  const body = req.body || {};
  const map = {
    name: body.name,
    a_tags: body.a_tags !== undefined ? JSON.stringify(body.a_tags) : undefined,
    b_tags: body.b_tags !== undefined ? JSON.stringify(body.b_tags) : undefined,
    c_tag: body.c_tag,
    d_tag: body.d_tag,
    status: body.status,
    content_count: body.content_count,
    health: body.health,
    last_active_at: body.last_active_at,
    login_account: body.login_account,
    douban_uid: body.douban_uid,
    remark: body.remark
  };
  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) { fields.push(`${k} = ?`); params.push(v); }
  }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  req.db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  writeLog(req.db, req, {
    action_type: 'account', object_type: 'account', object_id: req.params.id,
    description: `更新账号 ${existing.name}`,
    before_status: existing.status, after_status: body.status || existing.status
  });
  return ok(res, {}, '更新成功');
});

router.delete('/:id', (req, res) => {
  const existing = req.db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  req.db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  writeLog(req.db, req, {
    action_type: 'account', object_type: 'account', object_id: req.params.id,
    description: `删除账号 ${existing ? existing.name : req.params.id}`,
    before_status: existing ? existing.status : '', after_status: '已删除'
  });
  return ok(res, {}, '删除成功');
});

module.exports = router;
