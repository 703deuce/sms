import { createReputationDbClient } from "@/lib/reputation/db/reputation-db";

/**
 * Transovo reputation data access (Prisma/Postgres).
 * Legacy import path retained for ported Reviews modules.
 */
export function createServiceClient() {
  return createReputationDbClient();
}

/** Browser realtime client — not used for Reviews product data. */
export function createBrowserClient() {
  const channel = {
    on: () => channel,
    subscribe: () => ({ data: { subscription: {} } }),
  };
  return {
    channel: () => channel,
    removeChannel: async () => ({ error: null }),
  };
}
