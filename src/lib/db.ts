/**
 * Prisma client accessor. Requires `npx prisma generate` and a valid DATABASE_URL.
 * UI pages use mock data and do not require a live database.
 */
import type { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Configure Postgres and run `npx prisma migrate dev` to enable the database layer.",
    );
  }

  if (!globalForPrisma.prisma) {
    // Lazy require so the app can boot before `prisma generate` when using mock UI data.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
    globalForPrisma.prisma = new Client({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}

/** @deprecated Prefer getPrisma() — kept for call sites that expect a singleton. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
