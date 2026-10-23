// Canonical schema is generated at repo root (`prisma generate`); new-app must not use a stale nested client.
import { PrismaClient } from "../../../node_modules/@prisma/client";

export type DbRow = Record<string, unknown>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
