/**
 * Atomic appointment slot acquisition — prevents double-booking under concurrency.
 */
import "server-only";

import { getPrisma } from "@/lib/db";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import { SlotTakenError } from "@/lib/appointments/slot-errors";
import { createHash } from "crypto";

export { SlotTakenError } from "@/lib/appointments/slot-errors";

function advisoryLockId(workspaceId: string, serviceName: string, startsAt: string): bigint {
  const hash = createHash("sha256")
    .update(`${workspaceId}|${serviceName}|${startsAt}`)
    .digest();
  return hash.readBigInt64BE(0);
}

/** Run slot validation + booking callback inside a single DB transaction with advisory lock. */
export async function withAtomicSlotBooking<T>(
  workspaceId: string,
  input: { serviceName: string; startsAt: string; excludeAppointmentId?: string },
  book: () => Promise<T>,
): Promise<T> {
  const prisma = getPrisma();
  const lock = advisoryLockId(workspaceId, input.serviceName, input.startsAt);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lock})`;
      await assertSlotAvailableForBooking(workspaceId, input, tx);
      return book();
    });
  } catch (err) {
    if (err instanceof SlotTakenError) throw err;
    if (err instanceof Error && /no longer available|just taken|slot/i.test(err.message)) {
      throw new SlotTakenError();
    }
    throw err;
  }
}
