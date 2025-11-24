const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Example single user (for assignment/demo). You may replace with DB-backed users.
// Password is hashed for demonstration: plain password: "password123"
const demoUser = {
  id: 1,
  username: 'admin',
  // hashed password for "password123"
  passwordHash: bcrypt.hashSync('password123', 8),
  email: 'admin@example.com'
};

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username & password required' });

    if (username !== demoUser.username) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = bcrypt.compareSync(password, demoUser.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: demoUser.id, username: demoUser.username, email: demoUser.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: demoUser.id, username: demoUser.username, email: demoUser.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
