/**
 * Probe: can the platform send a plain SMS to the AR cert customer?
 * Clears suppression rows first, then sends via the same AR platform path as reminders.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-cert-probe-outbound-sms.ts
 */
import { execFileSync } from "node:child_process";
import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CUSTOMER_E164 = process.env.AR_LIVE_CUSTOMER_E164?.trim() || "+15714073615";

function hydrateTelnyxApiKey(): void {
  if (process.env.TELNYX_API_KEY?.trim()) return;
  const remote = [
    "set -euo pipefail",
    "cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1)",
    'if [ -z "$cid" ]; then exit 2; fi',
    "val=$(docker exec \"$cid\" printenv TELNYX_API_KEY 2>/dev/null || true)",
    'if [ -n "$val" ]; then printf "%s" "$val"; fi',
  ].join("; ");
  try {
    const key = execFileSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "coolify-server", "bash", "-lc", remote],
      { encoding: "utf8", maxBuffer: 16_000 },
    ).trim();
    if (key && !key.includes("BASH=")) process.env.TELNYX_API_KEY = key;
  } catch {
    /* optional */
  }
}

async function clearSuppression(prisma: ReturnType<typeof getPrisma>) {
  const { mctbCallerE164Variants, normalizeMctbCallerE164 } = await import(
    "@/lib/mctb/messaging/caller-e164"
  );
  const phoneVariants = mctbCallerE164Variants(CUSTOMER_E164);
  const normalized = normalizeMctbCallerE164(CUSTOMER_E164);
  const before = await prisma.suppression.count({
    where: {
      OR: [
        { phone: { in: phoneVariants } },
        { suppressionKey: { contains: normalized } },
        ...phoneVariants.map((p) => ({ suppressionKey: { contains: p } })),
      ],
    },
  });
  const removed = await prisma.suppression.deleteMany({
    where: {
      OR: [
        { phone: { in: phoneVariants } },
        { suppressionKey: { contains: normalized } },
        ...phoneVariants.map((p) => ({ suppressionKey: { contains: p } })),
      ],
    },
  });
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: { in: phoneVariants } },
    select: { id: true, status: true },
  });
  if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED", consentSource: "manual" },
    });
  }
  return { suppressionRowsBefore: before, suppressionDeleted: removed.count, contactStatus: contact?.status ?? null };
}

async function telnyxMessageStatus(messageId: string): Promise<unknown> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) return null;
  const res = await fetch(`https://api.telnyx.com/v2/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok ? await res.json() : { httpStatus: res.status, body: await res.text() };
}

async function main() {
  requireIsolatedArTestDatabase();
  hydrateProdTestEnvFromCoolify();
  hydrateTelnyxApiKey();
  const prisma = getPrisma();

  const cleared = await clearSuppression(prisma);
  console.log("[probe] suppression check:", cleared);

  const { listArEligiblePlatformSenders } = await import(
    "@/lib/appointment-reminders/messaging/ar-platform-sender-pool"
  );
  const senders = await listArEligiblePlatformSenders();
  if (!senders.length) {
    console.error("FAIL — no AR-eligible platform sender configured");
    process.exit(1);
  }
  const sender = senders[0];
  const body = `Transovo AR probe ${new Date().toISOString().slice(11, 19)} UTC — reply OK if you see this.`;
  console.log("[probe] sending via AR platform path", {
    from: sender.e164,
    to: CUSTOMER_E164,
    workspaceId: WORKSPACE_ID,
  });

  try {
    const { sendAppointmentSmsViaPlatformSender } = await import(
      "@/lib/appointment-reminders/messaging/send-via-assigned-sender"
    );
    const result = await sendAppointmentSmsViaPlatformSender({
      workspaceId: WORKSPACE_ID,
      customerWorkspaceId: WORKSPACE_ID,
      to: CUSTOMER_E164,
      body,
      platformPhoneNumberId: sender.phoneNumberId,
      fromE164: sender.e164,
      provider: sender.provider,
      idempotencyKey: `ar-probe:${Date.now()}`,
    });
    const providerId =
      typeof result.sid === "string" && !result.sid.startsWith("idem:")
        ? result.sid
        : result.messageId;
    console.log("[probe] sendQuickSms OK", {
      status: result.status,
      messageId: result.messageId,
      providerId,
    });
    if (providerId) {
      await new Promise((r) => setTimeout(r, 3000));
      const telnyx = await telnyxMessageStatus(providerId);
      console.log("[probe] telnyx message record:", JSON.stringify(telnyx, null, 2).slice(0, 2000));
    }
    console.log("\nPASS probe — API accepted send (check your phone for the text).");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const extra =
      err && typeof err === "object" && "body" in err
        ? JSON.stringify((err as { body?: unknown }).body).slice(0, 800)
        : "";
    console.error("FAIL probe — send rejected:", msg, extra);
    if (/suppressed|UNSUBSCRIBED|STOP/i.test(msg)) {
      console.error("→ This is the block list (suppression), not Telnyx.");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
