const { PrismaClient } = require('./prisma-pkg'); // same package copy as the shared client, see prisma-pkg.js

// Reuse client across warm invocations (serverless best practice)
let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}

prisma = global.__prisma;

module.exports = prisma;
