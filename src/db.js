const Database = require("better-sqlite3");
const path = require("path");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data.sqlite");

const db = new Database(DB_FILE);

// Helpers
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const info = stmt.run(params);
      resolve(info);
    } catch (err) {
      reject(err);
    }
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
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
      const row = stmt.get(params);
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
  getAsync,
};
