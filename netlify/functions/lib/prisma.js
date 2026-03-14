const { PrismaClient } = require('@prisma/client');

// Reuse client across warm invocations (serverless best practice)
let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}

prisma = global.__prisma;

module.exports = prisma;
