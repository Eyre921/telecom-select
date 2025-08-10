import { PrismaClient } from '@prisma/client';

// This is a common pattern to prevent creating too many PrismaClient instances
// during development due to Next.js hot-reloading.

// Declare a global variable to hold the PrismaClient instance.
declare global {
    var prisma: PrismaClient | undefined;
}

// Check if we are in production or if a prisma instance already exists.
// If not, create a new one. Otherwise, reuse the existing one.
const client = globalThis.prisma || new PrismaClient();

// In development, assign the new client to the global variable.
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = client;
}

// Export the single, shared PrismaClient instance.
export default client;
