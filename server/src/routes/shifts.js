const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// POST /api/shifts/start
router.post('/start', async (req, res) => {
  const { therapistId, roomId } = req.body;
  if (!therapistId || !roomId) return res.status(400).json({ error: 'therapistId ו-roomId נדרשים' });

  try {
    // Check therapist doesn't have active shift
    const existingShift = await prisma.shift.findFirst({
      where: { therapistId, endTime: null },
      include: { room: true },
    });
    if (existingShift) {
      return res.status(400).json({
        error: `המטפל כבר נמצא ב${existingShift.room.name}`,
        activeShift: existingShift,
      });
    }

    // Check room is not occupied
    const roomOccupied = await prisma.shift.findFirst({
      where: { roomId, endTime: null },
      include: { therapist: true },
    });
    if (roomOccupied) {
      return res.status(400).json({
        error: `החדר תפוס על ידי ${roomOccupied.therapist.name}`,
      });
    }

    const shift = await prisma.shift.create({
      data: { therapistId, roomId },
      include: { therapist: true, room: true },
    });

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/end
router.post('/end', async (req, res) => {
  const { therapistId } = req.body;
  if (!therapistId) return res.status(400).json({ error: 'therapistId נדרש' });

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { therapistId, endTime: null },
    });

    if (!activeShift) {
      return res.status(400).json({ error: 'אין משמרת פעילה למטפל זה' });
    }

    const shift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: { endTime: new Date() },
      include: { therapist: true, room: true },
    });

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/active/:therapistId
router.get('/active/:therapistId', async (req, res) => {
  const therapistId = parseInt(req.params.therapistId);
  try {
    const shift = await prisma.shift.findFirst({
      where: { therapistId, endTime: null },
      include: { therapist: true, room: true },
    });
    res.json(shift || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/history
router.get('/history', async (req, res) => {
  const { therapistId } = req.query;
  try {
    const shifts = await prisma.shift.findMany({
      where: {
        ...(therapistId ? { therapistId: parseInt(therapistId) } : {}),
        endTime: { not: null },
      },
      include: { therapist: true, room: true },
      orderBy: { startTime: 'desc' },
      take: 200,
    });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
