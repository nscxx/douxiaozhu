const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function initDB(dbPath) {
  // 确保数据目录存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // 开启WAL模式，提升并发性能
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 建表
  db.exec(`
    -- 账号表
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
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

    -- 电影表
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT '',
      year TEXT DEFAULT '',
      director TEXT DEFAULT '',
      score REAL DEFAULT 0,
      comments INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 任务表
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

    -- 标签表
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 内容表
    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      account_id INTEGER,
      movie_id INTEGER,
      type TEXT DEFAULT '',
      content TEXT DEFAULT '',
      status TEXT DEFAULT '待发布',
      published_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (movie_id) REFERENCES movies(id)
    );

    -- 凭证审核表
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      content_type TEXT DEFAULT '',
      status TEXT DEFAULT '待审核',
      ai_result TEXT DEFAULT '',
      audit_comment TEXT DEFAULT '',
      audit_time TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_movie ON tasks(movie_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
    CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
    CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
    CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);
  `);

  // 初始化默认标签数据
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get();
  if (tagCount.count === 0) {
    const insertTag = db.prepare('INSERT INTO tags (category, name) VALUES (?, ?)');
    const defaults = {
      A: ['文艺', '悬疑', '爱情', '科幻', '动作', '喜剧', '动画', '纪录片', '恐怖', '战争'],
      B: ['经典', '热门', '冷门', '获奖', '独立'],
      C: ['国产', '欧美', '日韩', '东南亚'],
      D: ['高评分', '话题性', '长尾', '时效性']
    };
    const insertMany = db.transaction((tags) => {
      for (const [category, names] of Object.entries(tags)) {
        for (const name of names) {
          insertTag.run(category, name);
        }
      }
    });
    insertMany(defaults);
    console.log('✅ 默认标签数据已初始化');
  }

  console.log('✅ 数据库初始化完成');
  return db;
}

module.exports = { initDB };
