const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = ['חדר 1', 'חדר 2', 'חדר 3', 'חדר 4', 'חדר 5'];
  for (const name of rooms) {
    await prisma.room.upsert({ where: { name }, update: {}, create: { name } });
  }

  const therapists = ['ישראל ישראלי', 'שרה כהן', 'דוד לוי', 'מרים אברהם'];
  for (const name of therapists) {
    await prisma.therapist.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log('Seed completed');
}

main().catch(console.error).finally(() => prisma.$disconnect());
