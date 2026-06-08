const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function initDB(dbPath) {
  // 确保数据目录存在
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  let db;
  
  // 如果数据库文件已存在则加载
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 保存函数 - 每次写操作后持久化到文件
  const saveDB = () => {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  };

  // 包装run方法，自动保存，返回lastInsertRowid
  const originalRun = db.run.bind(db);
  db.run = function(sql, params) {
    originalRun(sql, params);
    // 获取自增ID
    const idResult = db.exec('SELECT last_insert_rowid() as id');
    const lastId = idResult[0] ? idResult[0].values[0][0] : 0;
    saveDB();
    return { lastInsertRowid: lastId };
  };

  // 建表
  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
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
    )
  `);

  db.run(`
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
    )
  `);

  // 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_movie ON tasks(movie_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status)');

  // 初始化默认标签
  const tagResult = db.exec('SELECT COUNT(*) as count FROM tags');
  const tagCount = tagResult[0] ? tagResult[0].values[0][0] : 0;
  
  if (tagCount === 0) {
    const defaults = {
      A: ['文艺', '悬疑', '爱情', '科幻', '动作', '喜剧', '动画', '纪录片', '恐怖', '战争'],
      B: ['经典', '热门', '冷门', '获奖', '独立'],
      C: ['国产', '欧美', '日韩', '东南亚'],
      D: ['高评分', '话题性', '长尾', '时效性']
    };
    for (const [category, names] of Object.entries(defaults)) {
      for (const name of names) {
        db.run('INSERT INTO tags (category, name) VALUES (?, ?)', [category, name]);
      }
    }
    console.log('✅ 默认标签数据已初始化');
  }

  console.log('✅ 数据库初始化完成');
  return db;
}

module.exports = { initDB };
