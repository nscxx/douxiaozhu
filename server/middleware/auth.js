const jwt = require('jsonwebtoken');
const { fail } = require('../db-utils');

const JWT_SECRET = process.env.JWT_SECRET || 'douxiaozhu-dev-secret-change-me';
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail(res, 401, '未登录', 401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return fail(res, 401, '登录已过期，请重新登录', 401);
  }
}

function roles(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return fail(res, 403, '没有权限', 403);
    }
    next();
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status
  };
}

module.exports = { signToken, authRequired, roles, publicUser, JWT_SECRET };
