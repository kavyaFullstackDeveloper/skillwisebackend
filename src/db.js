const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
  db = await open({
    filename: path.join(__dirname, '..', 'data.sqlite'),
    driver: sqlite3.Database
  });
  return db;
}

async function runAsync(sql, params = []) {
  const database = db || await initDB();
  return database.run(sql, params);
}

async function allAsync(sql, params = []) {
  const database = db || await initDB();
  return database.all(sql, params);
}

async function getAsync(sql, params = []) {
  const database = db || await initDB();
  return database.get(sql, params);
}

module.exports = {
  initDB,
  runAsync,
  allAsync,
  getAsync,
};
