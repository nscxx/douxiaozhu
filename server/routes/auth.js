const express = require('express');
const bcrypt = require('bcryptjs');
const { ok, fail } = require('../db-utils');
const { signToken, publicUser, authRequired, roles } = require('../middleware/auth');
const { writeLog } = require('../lib/ops');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, '请输入用户名和密码');
  const user = req.db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || user.status !== '启用') return fail(res, 401, '用户名或密码错误');
  if (!bcrypt.compareSync(password, user.password_hash)) return fail(res, 401, '用户名或密码错误');
  const token = signToken(user);
  writeLog(req.db, { user }, {
    action_type: 'system',
    object_type: 'user',
    object_id: user.id,
    description: '登录系统',
    after_status: '已登录'
  });
  return ok(res, { token, user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return fail(res, 401, '用户不存在', 401);
  return ok(res, publicUser(user));
});

router.get('/users', authRequired, roles('admin'), (req, res) => {
  const items = req.db.prepare('SELECT id, username, name, role, status, created_at FROM users ORDER BY id').all();
  return ok(res, { items });
});

router.post('/users', authRequired, roles('admin'), (req, res) => {
  const { username, password, name, role = 'worker' } = req.body || {};
  if (!username || !password || !name) return fail(res, 400, '用户名、密码、姓名不能为空');
  if (!['admin', 'reviewer', 'worker'].includes(role)) return fail(res, 400, '角色无效');
  try {
    const result = req.db.prepare(
      'INSERT INTO users (username, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)'
    ).run(username.trim(), bcrypt.hashSync(password, 10), name.trim(), role, '启用');
    writeLog(req.db, req, {
      action_type: 'account',
      object_type: 'user',
      object_id: result.lastInsertRowid,
      description: `创建用户 ${username}（${role}）`,
      after_status: '启用'
    });
    return ok(res, { id: result.lastInsertRowid }, '创建成功');
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return fail(res, 400, '用户名已存在');
    throw err;
  }
});

router.put('/users/:id', authRequired, roles('admin'), (req, res) => {
  const user = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 404, '用户不存在');
  const { name, role, status, password } = req.body || {};
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (role !== undefined) { fields.push('role = ?'); params.push(role); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (password) { fields.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }
  if (!fields.length) return fail(res, 400, '没有更新字段');
  fields.push("updated_at = datetime('now', 'localtime')");
  params.push(req.params.id);
  req.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return ok(res, {}, '更新成功');
});

module.exports = router;
