import "server-only";

import type { PrismaClient } from "@prisma/client";
import { getPrisma, type DbRow } from "@/lib/db";

let directPrisma: PrismaClient | null = null;

/**
 * Class registration capacity, holds, and enrollment use Postgres advisory locks and
 * real transactions. When DATABASE_URL is set (Coolify production), use Prisma
 * directly instead of the PostgREST compat layer.
 */
export type ServiceBookingPersistenceDb = DbRow & Pick<PrismaClient, "$transaction">;

export function getClassRegistrationDb(): ServiceBookingPersistenceDb {
  if (process.env.DATABASE_URL) {
    if (!directPrisma) {
      const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
      directPrisma = new PrismaClient();
    }
    return directPrisma as DbRow & Pick<PrismaClient, "$transaction">;
  }
  return getPrisma() as ServiceBookingPersistenceDb;
}

/** Shared Postgres-backed persistence for AR service booking (capacity, fulfillment, packages). */
export const getServiceBookingPersistenceDb = getClassRegistrationDb;
