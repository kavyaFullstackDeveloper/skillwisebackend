const express = require('express');
const cors = require('cors');
const productsRouter = require('./src/routes/products');
const authRouter = require('./src/routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Routers
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);

// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
