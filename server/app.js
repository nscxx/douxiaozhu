const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const { authRequired } = require('./middleware/auth');
const { startScheduler } = require('./scheduler');

const accountRoutes = require('./routes/accounts');
const movieRoutes = require('./routes/movies');
const taskRoutes = require('./routes/tasks');
const tagRoutes = require('./routes/tags');
const contentRoutes = require('./routes/contents');
const credentialRoutes = require('./routes/credentials');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const logRoutes = require('./routes/logs');
const workerRoutes = require('./routes/worker');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;
const rootDir = path.join(__dirname, '..');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'douxiaozhu.db');
const db = initDB(dbPath);

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', authRequired, uploadRoutes);
app.use('/api/accounts', authRequired, accountRoutes);
app.use('/api/movies', authRequired, movieRoutes);
app.use('/api/tasks', authRequired, taskRoutes);
app.use('/api/tags', authRequired, tagRoutes);
app.use('/api/contents', authRequired, contentRoutes);
app.use('/api/credentials', authRequired, credentialRoutes);
app.use('/api/dashboard', authRequired, dashboardRoutes);
app.use('/api/ai', authRequired, aiRoutes);
app.use('/api/settings', authRequired, settingsRoutes);
app.use('/api/logs', authRequired, logRoutes);
app.use('/api/worker', authRequired, workerRoutes);

app.use('/uploads', express.static(uploadDir));
app.use('/public', express.static(path.join(rootDir, 'public')));
app.use('/worker', express.static(path.join(rootDir, 'public', 'worker')));

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, msg: '接口不存在' });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, msg: err.message || '服务器内部错误' });
});

const server = app.listen(PORT, () => {
  console.log(`豆小助后端已启动: http://localhost:${PORT}`);
  console.log(`数据库: ${dbPath}`);
  console.log(`管理后台: http://localhost:${PORT}/`);
  console.log(`执行者端: http://localhost:${PORT}/worker/`);
  startScheduler(db, dbPath);
});

function shutdown() {
  console.log('正在关闭服务...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
