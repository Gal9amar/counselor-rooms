const express = require('express');
const router = express.Router();

// POST /api/admin/verify
router.post('/verify', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'סיסמה שגויה' });
  }
});

module.exports = router;
