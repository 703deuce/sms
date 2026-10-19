/**
 * esbuild bundle alias target for monolith `@/lib/db` imports.
 * Voice V3 runtime uses the same Prisma schema as new-app.
 */
import { getPrisma } from "@/lib/server/db";

export { getPrisma };

/** Monolith code expects a `prisma` proxy — forward to getPrisma(). */
export const prisma = new Proxy({} as ReturnType<typeof getPrisma>, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
