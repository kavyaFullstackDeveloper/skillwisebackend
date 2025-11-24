const express = require('express');
const cors = require('cors');
const { initDB } = require('./src/db');

const productsRouter = require('./src/routes/products');
const authRouter = require('./src/routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

initDB().then(() => {
  console.log("SQLite connected.");
}).catch(err => {
  console.error("DB init error:", err);
});

// Routers
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
