// The @prisma/client package, cached on `global` exactly like the client instance in ./prisma.js.
//
// Why: the Netlify bundler gives every function its own copy of @prisma/client, and `netlify dev` runs all functions in ONE Node
// process. The shared client (global.__prisma) is created by whichever function loads first, so a function that imported
// `Prisma` from ITS OWN copy built `Prisma.sql` fragments of a different `Sql` class: `prisma.$queryRaw` then treated nested
// fragments as bound values ("syntax error at or near $2"). Taking the namespace from the same cached package as the client
// removes that class mismatch (in production each function is its own process, where this is a no-op).
if (!global.__prismaPkg) {
  global.__prismaPkg = require('@prisma/client');
}
module.exports = global.__prismaPkg;
