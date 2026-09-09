const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const TAG_SEED = [
  { category: 'A', code: 'A1', name: '国产大剧/大档期', parent_code: null },
  { category: 'A', code: 'A1-1', name: '春节档', parent_code: 'A1' },
  { category: 'A', code: 'A1-2', name: '国庆档', parent_code: 'A1' },
  { category: 'A', code: 'A1-3', name: '合家欢喜剧', parent_code: 'A1' },
  { category: 'A', code: 'A1-4', name: '大流量剧', parent_code: 'A1' },
  { category: 'A', code: 'A1-5', name: '大IP', parent_code: 'A1' },
  { category: 'A', code: 'A2', name: '港剧/港片', parent_code: null },
  { category: 'A', code: 'A2-1', name: 'TVB', parent_code: 'A2' },
  { category: 'A', code: 'A2-2', name: '港产片', parent_code: 'A2' },
  { category: 'A', code: 'A2-3', name: '粤语剧', parent_code: 'A2' },
  { category: 'A', code: 'A2-4', name: '警匪片', parent_code: 'A2' },
  { category: 'A', code: 'A2-5', name: '宫斗剧', parent_code: 'A2' },
  { category: 'A', code: 'A2-6', name: '家族商战', parent_code: 'A2' },
  { category: 'A', code: 'A3', name: '文艺片', parent_code: null },
  { category: 'A', code: 'A3-1', name: '高分佳片', parent_code: 'A3' },
  { category: 'A', code: 'A3-2', name: '作者电影', parent_code: 'A3' },
  { category: 'A', code: 'A3-3', name: '日影', parent_code: 'A3' },
  { category: 'A', code: 'A3-4', name: '台影', parent_code: 'A3' },
  { category: 'A', code: 'A3-5', name: '欧陆文艺片', parent_code: 'A3' },
  { category: 'A', code: 'A3-6', name: '治愈系', parent_code: 'A3' },
  { category: 'A', code: 'A3-7', name: '电影节', parent_code: 'A3' },
  { category: 'A', code: 'A4', name: '韩日泰影视', parent_code: null },
  { category: 'A', code: 'A4-1', name: 'K-剧', parent_code: 'A4' },
  { category: 'A', code: 'A4-2', name: 'J-剧', parent_code: 'A4' },
  { category: 'A', code: 'A4-3', name: '韩国电影', parent_code: 'A4' },
  { category: 'A', code: 'A4-4', name: '日本动画', parent_code: 'A4' },
  { category: 'A', code: 'A4-5', name: '漫改剧', parent_code: 'A4' },
  { category: 'A', code: 'A4-6', name: '泰腐', parent_code: 'A4' },
  { category: 'A', code: 'A5', name: '欧美大片/特效', parent_code: null },
  { category: 'A', code: 'A5-1', name: '漫威', parent_code: 'A5' },
  { category: 'A', code: 'A5-2', name: 'DC', parent_code: 'A5' },
  { category: 'A', code: 'A5-3', name: '迪士尼', parent_code: 'A5' },
  { category: 'A', code: 'A5-4', name: '皮克斯', parent_code: 'A5' },
  { category: 'A', code: 'A5-5', name: '科幻大片', parent_code: 'A5' },
  { category: 'A', code: 'A5-6', name: '战争片', parent_code: 'A5' },
  { category: 'B', code: 'B1', name: '语言偏好', parent_code: null },
  { category: 'B', code: 'B1-1', name: '粤语学习', parent_code: 'B1' },
  { category: 'B', code: 'B1-2', name: '韩语学习', parent_code: 'B1' },
  { category: 'B', code: 'B1-3', name: '日语学习', parent_code: 'B1' },
  { category: 'B', code: 'B1-4', name: '英语学习', parent_code: 'B1' },
  { category: 'B', code: 'B2', name: '生活偏好', parent_code: null },
  { category: 'B', code: 'B2-1', name: '美食', parent_code: 'B2' },
  { category: 'B', code: 'B2-2', name: '旅行', parent_code: 'B2' },
  { category: 'B', code: 'B2-3', name: '摄影', parent_code: 'B2' },
  { category: 'B', code: 'B2-4', name: '健身', parent_code: 'B2' },
  { category: 'B', code: 'B2-5', name: '阅读', parent_code: 'B2' },
  { category: 'B', code: 'B2-6', name: '音乐', parent_code: 'B2' },
  { category: 'B', code: 'B3', name: '兴趣圈层', parent_code: null },
  { category: 'B', code: 'B3-1', name: '追星', parent_code: 'B3' },
  { category: 'B', code: 'B3-2', name: '二次元', parent_code: 'B3' },
  { category: 'B', code: 'B3-3', name: '电竞', parent_code: 'B3' },
  { category: 'B', code: 'B3-4', name: '宠物', parent_code: 'B3' },
  { category: 'B', code: 'B3-5', name: '时尚', parent_code: 'B3' },
  { category: 'C', code: 'C1', name: '上线时间', parent_code: null },
  { category: 'C', code: 'C1-1', name: '早高峰(7-9点)', parent_code: 'C1' },
  { category: 'C', code: 'C1-2', name: '午休(12-14点)', parent_code: 'C1' },
  { category: 'C', code: 'C1-3', name: '晚高峰(18-22点)', parent_code: 'C1' },
  { category: 'C', code: 'C1-4', name: '深夜(22-2点)', parent_code: 'C1' },
  { category: 'C', code: 'C2', name: '活跃频率', parent_code: null },
  { category: 'C', code: 'C2-1', name: '日活', parent_code: 'C2' },
  { category: 'C', code: 'C2-2', name: '隔日活', parent_code: 'C2' },
  { category: 'C', code: 'C2-3', name: '周活', parent_code: 'C2' },
  { category: 'C', code: 'C3', name: '浏览时长', parent_code: null },
  { category: 'C', code: 'C3-1', name: '快刷型(<30分钟)', parent_code: 'C3' },
  { category: 'C', code: 'C3-2', name: '沉浸型(30-120分钟)', parent_code: 'C3' },
  { category: 'C', code: 'C3-3', name: '重度型(>120分钟)', parent_code: 'C3' },
  { category: 'D', code: 'D1', name: '评分习惯', parent_code: null },
  { category: 'D', code: 'D1-1', name: '严格型(多打1-2星)', parent_code: 'D1' },
  { category: 'D', code: 'D1-2', name: '宽容型(多打4-5星)', parent_code: 'D1' },
  { category: 'D', code: 'D1-3', name: '中间型', parent_code: 'D1' },
  { category: 'D', code: 'D2', name: '评论文风', parent_code: null },
  { category: 'D', code: 'D2-1', name: '讨论型', parent_code: 'D2' },
  { category: 'D', code: 'D2-2', name: '短评型', parent_code: 'D2' },
  { category: 'D', code: 'D2-3', name: '情绪型', parent_code: 'D2' },
  { category: 'D', code: 'D2-4', name: '理性分析型', parent_code: 'D2' }
];

const DEFAULT_SETTINGS = {
  daily_task_limit: '500',
  account_concurrency: '5',
  publish_interval_min: '30',
  claim_timeout_hours: '24',
  ai_audit_threshold: '0.8',
  ai_provider: 'mock',
  volcengine_model: process.env.VOLCENGINE_MODEL || 'doubao-pro-32k',
  prompt_short: '你是一位豆瓣用户，人设为：{persona}。请为电影《{movie_name}》（{year}，{director}，{type}）写一条50字以内的短评，口语自然，不要标题，不要表情符号堆砌。',
  prompt_review: '你是一位豆瓣用户，人设为：{persona}。请为电影《{movie_name}》（{year}，{director}，{type}，评分{score}）写一篇100-200字影评，有观点、有细节，符合人设口吻。',
  prompt_discuss: '你是一位豆瓣用户，人设为：{persona}。请为电影《{movie_name}》写一段300字以上的讨论帖，提出一个可讨论的观点，不要剧透关键结局。',
  notify_audit: '0',
  notify_alert: '0'
};

function ensureColumn(db, table, column, defSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${defSql}`);
  }
}

function initDB(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker',
      status TEXT DEFAULT '启用',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      login_account TEXT DEFAULT '',
      douban_uid TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      a_tags TEXT DEFAULT '[]',
      b_tags TEXT DEFAULT '[]',
      c_tag TEXT DEFAULT '',
      d_tag TEXT DEFAULT '',
      status TEXT DEFAULT '活跃',
      content_count INTEGER DEFAULT 0,
      health REAL DEFAULT 100,
      last_active_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT '',
      year TEXT DEFAULT '',
      director TEXT DEFAULT '',
      score REAL DEFAULT 0,
      comments INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      douban_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content_types TEXT DEFAULT '[]',
      status TEXT DEFAULT '待执行',
      create_method TEXT DEFAULT '',
      movie_id INTEGER,
      account_id INTEGER,
      time_slots TEXT DEFAULT '[]',
      start_time TEXT,
      published_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (movie_id) REFERENCES movies(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      code TEXT DEFAULT '',
      name TEXT NOT NULL,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      account_id INTEGER,
      movie_id INTEGER,
      type TEXT DEFAULT '',
      content TEXT DEFAULT '',
      status TEXT DEFAULT '待生成',
      worker_id INTEGER,
      claimed_at TEXT,
      published_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (movie_id) REFERENCES movies(id),
      FOREIGN KEY (worker_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      content_id INTEGER,
      task_id INTEGER,
      content_type TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      published_url TEXT DEFAULT '',
      status TEXT DEFAULT '待AI审核',
      ai_status TEXT DEFAULT '',
      ai_result TEXT DEFAULT '',
      ai_comment TEXT DEFAULT '',
      ai_confidence REAL DEFAULT 0,
      audit_comment TEXT DEFAULT '',
      audit_time TEXT,
      final_status TEXT DEFAULT '',
      final_comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (content_id) REFERENCES contents(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT DEFAULT '',
      action_type TEXT DEFAULT '',
      object_type TEXT DEFAULT '',
      object_id TEXT DEFAULT '',
      description TEXT DEFAULT '',
      before_status TEXT DEFAULT '',
      after_status TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_movie ON tasks(movie_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
    CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
    CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
    CREATE INDEX IF NOT EXISTS idx_contents_worker ON contents(worker_id);
    CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);
  `);

  ensureColumn(db, 'accounts', 'login_account', "TEXT DEFAULT ''");
  ensureColumn(db, 'accounts', 'douban_uid', "TEXT DEFAULT ''");
  ensureColumn(db, 'accounts', 'remark', "TEXT DEFAULT ''");
  ensureColumn(db, 'movies', 'douban_url', "TEXT DEFAULT ''");
  ensureColumn(db, 'contents', 'worker_id', 'INTEGER');
  ensureColumn(db, 'contents', 'claimed_at', 'TEXT');
  ensureColumn(db, 'contents', 'published_url', "TEXT DEFAULT ''");
  ensureColumn(db, 'tags', 'code', "TEXT DEFAULT ''");
  ensureColumn(db, 'tags', 'parent_id', 'INTEGER');
  ensureColumn(db, 'credentials', 'content_id', 'INTEGER');
  ensureColumn(db, 'credentials', 'task_id', 'INTEGER');
  ensureColumn(db, 'credentials', 'image_path', "TEXT DEFAULT ''");
  ensureColumn(db, 'credentials', 'published_url', "TEXT DEFAULT ''");
  ensureColumn(db, 'credentials', 'ai_status', "TEXT DEFAULT ''");
  ensureColumn(db, 'credentials', 'ai_confidence', 'REAL DEFAULT 0');
  ensureColumn(db, 'credentials', 'final_status', "TEXT DEFAULT ''");
  ensureColumn(db, 'credentials', 'final_comment', "TEXT DEFAULT ''");

  seedUsers(db);
  seedTags(db);
  seedSettings(db);
  seedMovies(db);
  seedAccounts(db);

  console.log('数据库初始化完成');
  return db;
}

function seedUsers(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)'
  );
  const defaults = [
    ['admin', 'admin123', '系统管理员', 'admin'],
    ['reviewer', 'reviewer123', '审核员', 'reviewer'],
    ['worker', 'worker123', '执行者', 'worker']
  ];
  for (const [username, password, name, role] of defaults) {
    insert.run(username, bcrypt.hashSync(password, 10), name, role, '启用');
  }
  console.log('默认用户已初始化: admin / reviewer / worker（初始密码见 README）');
}

function seedTags(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM tags').get().c;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO tags (category, code, name, parent_id) VALUES (?, ?, ?, ?)'
  );
  const idByCode = {};
  for (const tag of TAG_SEED) {
    const parentId = tag.parent_code ? idByCode[tag.parent_code] || null : null;
    const result = insert.run(tag.category, tag.code, tag.name, parentId);
    idByCode[tag.code] = result.lastInsertRowid;
  }
  console.log('默认人设标签已初始化');
}

function seedSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, value);
  }
}

function seedAccounts(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
  if (count > 0) return;
  db.prepare(
    `INSERT INTO accounts (name, login_account, a_tags, b_tags, c_tag, d_tag, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    '小鱼儿爱看电影',
    'demo@example.com',
    JSON.stringify(['文艺片', '高分佳片']),
    JSON.stringify(['阅读', '摄影']),
    '晚高峰(18-22点)',
    '理性分析型',
    '活跃'
  );
}

function seedMovies(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM movies').get().c;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO movies (name, type, year, director, score, comments, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const samples = [
    ['花样年华', '爱情', '2000', '王家卫', 8.6, 890000, ['文艺', '港片']],
    ['繁花', '剧情', '2024', '王家卫', 7.8, 420000, ['国产', '年代']],
    ['周处除三害', '犯罪', '2023', '黄精甫', 8.1, 310000, ['港片', '动作']],
    ['沙丘2', '科幻', '2024', '丹尼斯·维伦纽瓦', 8.0, 280000, ['欧美', '科幻']]
  ];
  for (const [name, type, year, director, score, comments, tags] of samples) {
    insert.run(name, type, year, director, score, comments, JSON.stringify(tags));
  }
}

function getSetting(db, key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

module.exports = { initDB, getSetting, setSetting, parseJson, DEFAULT_SETTINGS };
