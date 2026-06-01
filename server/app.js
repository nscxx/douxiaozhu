const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

// 路由模块
const accountRoutes = require('./routes/accounts');
const movieRoutes = require('./routes/movies');
const taskRoutes = require('./routes/tasks');
const tagRoutes = require('./routes/tags');
const contentRoutes = require('./routes/contents');
const credentialRoutes = require('./routes/credentials');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// 初始化数据库
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'douxiaozhu.db');
const db = initDB(dbPath);

// 把db挂到req上
app.use((req, res, next) => {
  req.db = db;
  next();
});

// API路由
app.use('/api/accounts', accountRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/contents', contentRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, msg: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, msg: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🦀 豆小助后端服务已启动: http://localhost:${PORT}`);
  console.log(`📦 数据库: ${dbPath}`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  db.close();
  process.exit(0);
});
