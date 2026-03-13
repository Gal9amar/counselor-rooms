const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const adminAuth = require('../middleware/adminAuth');

const prisma = new PrismaClient();

// GET /api/therapists
router.get('/', async (req, res) => {
  try {
    const therapists = await prisma.therapist.findMany({ orderBy: { name: 'asc' } });
    res.json(therapists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/therapists (admin)
router.post('/', adminAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'שם מטפל נדרש' });
  try {
    const therapist = await prisma.therapist.create({ data: { name } });
    res.status(201).json(therapist);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'מטפל עם שם זה כבר קיים' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/therapists/:id (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.therapist.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
