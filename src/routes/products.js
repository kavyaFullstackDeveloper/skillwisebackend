// backend/src/routes/products.js
const express = require('express');
const multer = require('multer');
const { streamToJsonArray } = require('../utils/csvHelpers');
const { runAsync, allAsync, getAsync, db } = require('../db');
const csv = require('fast-csv');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

// apply migrations on boot (synchronously)
try {
  const migrations = fs.readFileSync(path.join(__dirname, '..', 'migrations.sql'), 'utf8');
  db.exec(migrations);
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration error:', err);
}

/**
 * Helper: build where clause and params from query filters
 */
function buildFilters(query) {
  const where = [];
  const params = [];
  if (query.category) {
    where.push('category = ?');
    params.push(query.category);
  }
  if (query.status) {
    where.push('status = ?');
    params.push(query.status);
  }
  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  return { whereClause, params };
}

/**
 * GET /api/products
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const { whereClause, params } = buildFilters(req.query);

    let orderBy = 'id DESC';
    if (req.query.sort) {
      const s = req.query.sort;
      if (s === 'stock_asc') orderBy = 'stock ASC';
      else if (s === 'stock_desc') orderBy = 'stock DESC';
      else if (s === 'name_asc') orderBy = 'name ASC';
      else if (s === 'name_desc') orderBy = 'name DESC';
    }

    const totalRow = await getAsync(`SELECT COUNT(*) as count FROM products ${whereClause}`, params);
    const total = totalRow?.count || 0;

    const rows = await allAsync(
      `SELECT * FROM products ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data: rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/products/search
 */
router.get('/search', async (req, res) => {
  try {
    const q = req.query.name || '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const totalRow = await getAsync(
      `SELECT COUNT(*) as count FROM products WHERE name LIKE ? COLLATE NOCASE`,
      [`%${q}%`]
    );
    const total = totalRow?.count || 0;

    const rows = await allAsync(
      `SELECT * FROM products WHERE name LIKE ? COLLATE NOCASE ORDER BY id DESC LIMIT ? OFFSET ?`,
      [`%${q}%`, limit, offset]
    );
    res.json({ data: rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/products/export
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const rows = await allAsync('SELECT name,unit,category,brand,stock,status,image FROM products ORDER BY id ASC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');

    const csvStream = csv.format({ headers: true });
    csvStream.pipe(res);
    rows.forEach(r => csvStream.write(r));
    csvStream.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * POST /api/products/import
 */
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file required' });
    const bufferStream = require('stream').Readable.from(req.file.buffer);
    const records = await streamToJsonArray(bufferStream);

    let added = 0, skipped = 0;
    const duplicates = [];

    for (const rec of records) {
      const name = (rec.name || '').trim();
      if (!name) { skipped++; continue; }
      const unit = (rec.unit || '').trim() || 'pcs';
      const category = (rec.category || '').trim() || 'Uncategorized';
      const brand = (rec.brand || '').trim() || null;
      let stock = parseInt(rec.stock || '0', 10);
      if (isNaN(stock) || stock < 0) stock = 0;
      let status = (rec.status || '').trim();
      if (!status) status = stock > 0 ? 'In Stock' : 'Out of Stock';

      const existing = await getAsync('SELECT id, name FROM products WHERE name = ? COLLATE NOCASE', [name]);
      if (existing) {
        duplicates.push({ name, existingId: existing.id });
        skipped++;
        continue;
      }

      await runAsync(
        `INSERT INTO products (name, unit, category, brand, stock, status, image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [name, unit, category, brand, stock, status, (rec.image || null)]
      );
      added++;
    }

    res.json({ added, skipped, duplicates });
  } catch (err) {
    console.error('Import error', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, unit, category, brand, stock, status, image, changedBy } = req.body;

    if (!name || !unit || !category) return res.status(400).json({ error: 'name, unit, category required' });

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0) return res.status(400).json({ error: 'stock must be >= 0' });

    const other = await getAsync('SELECT id FROM products WHERE name = ? COLLATE NOCASE AND id != ?', [name, id]);
    if (other) return res.status(400).json({ error: 'name must be unique' });

    const existing = await getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    await runAsync(
      `UPDATE products SET name = ?, unit = ?, category = ?, brand = ?, stock = ?, status = ?, image = ?, updated_at = datetime('now') WHERE id = ?`,
      [name, unit, category, brand, stockNum, status, image, id]
    );

    if (existing.stock !== stockNum) {
      await runAsync(
        `INSERT INTO inventory_logs (product_id, old_stock, new_stock, changed_by, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
        [id, existing.stock, stockNum, changedBy || req.user?.email || req.user?.username || 'admin']
      );
    }

    const updated = await getAsync('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * GET /api/products/:id/history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const logs = await allAsync(
      `SELECT id, product_id as productId, old_stock as oldStock, new_stock as newStock, changed_by as changedBy, timestamp
       FROM inventory_logs WHERE product_id = ? ORDER BY timestamp DESC`,
      [id]
    );
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await runAsync('DELETE FROM products WHERE id = ?', [id]);
    res.json({ deleted: r.changes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
