/**
 * Cert-only: set ws_1 MCTB outbound to PLATFORM (Twilio TFN +18885046264).
 * Does not bulk-enable other workspaces. Idempotent.
 *
 *   WORKSPACE_ID=ws_1 npx tsx scripts/enable-ws1-mctb-platform-sender-mode.ts
 *   DRY_RUN=1 — preview only
 */
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { requireMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim() || requireMctbPlatformOwnerWorkspaceId();
  const dryRun = process.env.DRY_RUN === "1";

  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) {
    throw new Error(
      "Canonical platform MCTB sender not found — run setup-mctb-platform-sender.ts first",
    );
  }

  const prisma = getPrisma();
  const row = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId },
    select: { id: true, senderMode: true, workspaceId: true },
  });
  if (!row) {
    throw new Error(`No MissedCallTextConfig for workspace ${workspaceId}`);
  }

  const before = row.senderMode || "WORKSPACE";
  if (before === "PLATFORM") {
    const cfg = await loadMissedCallTextConfig(workspaceId);
    const route = cfg
      ? await resolveMctbOutboundSmsRoute({ workspaceId, config: cfg })
      : null;
    console.log(
      JSON.stringify({
        ok: true,
        action: "already_platform",
        workspaceId,
        platformSender: platform,
        outboundRoute: route,
      }),
    );
    return;
  }

  if (dryRun) {
    console.log(
      JSON.stringify({
        ok: true,
        action: "dry_run",
        workspaceId,
        wouldSet: "PLATFORM",
        fromE164: platform.e164,
        phoneNumberId: platform.phoneNumberId,
        previousSenderMode: before,
      }),
    );
    return;
  }

  await prisma.missedCallTextConfig.update({
    where: { id: row.id },
    data: { senderMode: "PLATFORM" },
  });

  const cfg = await loadMissedCallTextConfig(workspaceId);
  const route = cfg
    ? await resolveMctbOutboundSmsRoute({ workspaceId, config: cfg })
    : null;

  console.log(
    JSON.stringify({
      ok: true,
      action: "updated",
      workspaceId,
      previousSenderMode: before,
      senderMode: "PLATFORM",
      platformSender: platform,
      outboundRoute: route,
      nextStep:
        "Place another forwarded missed call + press 1; SMS From should be +18885046264",
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
