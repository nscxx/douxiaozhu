const path = require('path');
const { initDB } = require('../db');
const { backupDatabase } = require('../scheduler');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'douxiaozhu.db');
initDB(dbPath);
const dest = backupDatabase(dbPath);
console.log(dest);
