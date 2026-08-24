#!/usr/bin/env npx tsx
/**
 * Audit Smart Routing provisioning for a workspace number.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/sr-provision-audit.ts --e164 +12025551234
 *   npx tsx scripts/sr-provision-audit.ts --phone-number-id <id>
 */
import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  readCallHandlingMode,
  snapshotCallHandlingMode,
} from "@/lib/numbers/call-handling-mode-shared";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getActiveMediaBackend } from "@/lib/voice/media-backend";

type Row = { check: string; result: "PASS" | "FAIL" | "WARN" | "INFO"; detail: string };

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const e164 = arg("--e164");
  const phoneNumberId = arg("--phone-number-id");
  const workspaceId = arg("--workspace-id");
  if (!e164 && !phoneNumberId) {
    console.error("Provide --e164 or --phone-number-id");
    process.exit(1);
  }

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: phoneNumberId
      ? { id: phoneNumberId, ...(workspaceId ? { workspaceId } : {}) }
      : { e164, ...(workspaceId ? { workspaceId } : {}) },
  });
  if (!row) {
    console.error("Phone number not found");
    process.exit(1);
  }

  const rows: Row[] = [];
  const push = (check: string, result: Row["result"], detail: string) =>
    rows.push({ check, result, detail });

  const modeSnap = snapshotCallHandlingMode(row.settingsJson);
  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? (row.settingsJson as Record<string, unknown>)
      : {};

  push("phoneNumberId", "INFO", row.id);
  push("workspaceId", "INFO", row.workspaceId);
  push("e164", "INFO", row.e164);
  push("provider", "INFO", row.provider);
  push("providerNumberId", row.providerNumberId ? "PASS" : "FAIL", row.providerNumberId || "missing");
  push("callHandlingMode", modeSnap.mode === "smart_routing" ? "PASS" : "WARN", modeSnap.mode);
  push(
    "not_mctb_platform_demo",
    row.e164 === MCTB_PLATFORM_DEMO_E164 ? "FAIL" : "PASS",
    row.e164,
  );
  push(
    "mctb_sip_ingress_disabled",
    modeSnap.mctbSipIngress ? "FAIL" : "PASS",
    String(modeSnap.mctbSipIngress),
  );
  push(
    "routing_owner",
    modeSnap.routingOwner === "smart_routing" ? "PASS" : "WARN",
    modeSnap.routingOwner || "none",
  );

  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? (settings.telephony as Record<string, unknown>)
      : {};
  push("telephony.routingMode", "INFO", String(telephony.routingMode || "unset"));
  push("media_backend", "INFO", getActiveMediaBackend());

  const wsSettings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: row.workspaceId },
  });
  push(
    "sr_assigned_routing_number",
    wsSettings?.assignedPhoneNumberId === row.id ? "PASS" : "WARN",
    wsSettings?.assignedPhoneNumberId || "not assigned",
  );

  const flows = await prisma.smartRoutingFlow.findMany({
    where: { workspaceId: row.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      status: true,
      assignedPhoneNumberId: true,
      draftConfigJson: true,
    },
  });
  const activeFlow = flows.find((f) => f.status === "active");
  push("active_flow", activeFlow ? "PASS" : "WARN", activeFlow?.name || "none");

  if (row.provider === "telnyx" && row.providerNumberId) {
    try {
      const tel = await telnyxRequest<{
        data?: {
          connection_id?: string;
          messaging_profile_id?: string;
          status?: string;
        };
      }>(`/phone_numbers/${row.providerNumberId}`);
      const connectionId = tel.data?.connection_id || "unset";
      push("telnyx_connection_id", connectionId ? "PASS" : "FAIL", connectionId);
      push("telnyx_status", "INFO", tel.data?.status || "unknown");
      push(
        "telnyx_messaging_profile",
        tel.data?.messaging_profile_id ? "PASS" : "WARN",
        tel.data?.messaging_profile_id || "unset",
      );
    } catch (err) {
      push("telnyx_lookup", "FAIL", err instanceof Error ? err.message : String(err));
    }
  }

  const staleTrunk = "ST_9v6jM2L5ktzr";
  const trunkId = String(telephony.livekitInboundTrunkId || settings.livekitInboundTrunkId || "");
  if (trunkId) {
    push(
      "no_stale_trunk_id",
      trunkId === staleTrunk ? "FAIL" : "PASS",
      trunkId,
    );
  }

  console.log(JSON.stringify({ number: row.e164, mode: readCallHandlingMode(row.settingsJson), rows }, null, 2));
  const failed = rows.some((r) => r.result === "FAIL");
  process.exit(failed ? 1 : 0);
}

void main();
