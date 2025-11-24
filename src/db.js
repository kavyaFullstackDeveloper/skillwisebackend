// backend/src/db.js
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data.sqlite');

const db = new Database(DB_FILE);

// enable foreign keys
db.pragma('foreign_keys = ON');

// helper wrappers that return promises (keeps your route code mostly unchanged)
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(Array.isArray(params) ? params : [params]));
      resolve({ id: info.lastInsertRowid || info.lastInsertRowid === 0 ? info.lastInsertRowid : info.lastInsertROWID, changes: info.changes });
    } catch (err) {
      reject(err);
    }
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(Array.isArray(params) ? params : [params]));
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...(Array.isArray(params) ? params : [params]));
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  db,
  runAsync,
  allAsync,
  getAsync
};
