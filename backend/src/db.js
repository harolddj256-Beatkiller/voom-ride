'use strict';
const { PrismaClient } = require('@prisma/client');

// Reuse a single client across invocations in serverless environments.
const globalRef = globalThis;
const prisma = globalRef.__voomPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalRef.__voomPrisma = prisma;

module.exports = { prisma };
