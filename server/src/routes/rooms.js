const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const adminAuth = require('../middleware/adminAuth');

const prisma = new PrismaClient();

// GET /api/rooms - all rooms with active shift
router.get('/', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' },
      include: {
        shifts: {
          where: { endTime: null },
          include: { therapist: true },
          take: 1,
        },
      },
    });

    const result = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      activeShift: room.shifts[0]
        ? {
            id: room.shifts[0].id,
            therapist: room.shifts[0].therapist,
            startTime: room.shifts[0].startTime,
          }
        : null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms - add room (admin)
router.post('/', adminAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'שם חדר נדרש' });
  try {
    const room = await prisma.room.create({ data: { name } });
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'חדר עם שם זה כבר קיים' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rooms/:id - remove room (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.room.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
