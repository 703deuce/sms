/**
 * Expire active AR reply sessions for a customer (ops — unblock new reminder send).
 * PHONE=+1... WORKSPACE_ID=ws_1 npx tsx scripts/ar-prod-expire-consumer-ar-sessions.ts
 */
import { getPrisma } from "../src/lib/db";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "../src/lib/mctb/messaging/caller-e164";
import { AR_REPLY_ELIGIBLE_STATES } from "../src/lib/appointment-reminders/messaging/ar-platform-sender-pool";

const phone = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");
const workspaceId = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(phone);
  const result = await prisma.arSmsReplySession.updateMany({
    where: {
      workspaceId,
      consumerE164: { in: variants },
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    data: {
      lifecycleState: "EXPIRED",
      completedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
  console.log("expired_sessions", result.count, { phone, workspaceId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
