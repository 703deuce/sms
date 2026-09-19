#!/usr/bin/env npx tsx
/**
 * Read-only: verify ws_1 (+15717491060) published Voice V3 config for callback PSTN cert.
 */
import fs from "node:fs";
import { getPrisma } from "../src/lib/db";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { ensureCallbackRequiredCollectFieldIds } from "../src/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const OUT = process.env.OUT?.trim() || "/opt/cursor/artifacts/ws1-callback-production-config.json";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: {
      phoneNumber: { select: { e164: true } },
    },
  });
  if (!agent?.publishedVersionId) throw new Error("Agent or published version missing");
  const publishedVersion = await prisma.voiceAgentVersion.findUnique({
    where: { id: agent.publishedVersionId },
    select: { id: true, version: true, createdAt: true },
  });
  if (!publishedVersion) throw new Error("Published version row missing");

  const loaded = await loadAppointmentReceptionistSetup(WORKSPACE_ID, { agentId: AGENT_ID });
  const wizard = loaded?.state as AppointmentReceptionistWizardState | undefined;
  if (!wizard) throw new Error("Wizard state missing");

  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    publishedVersionId: publishedVersion.id,
  });

  const toolNames = listVoiceV3AstraToolNamesForConfig(v3);
  const callbackEnabled = wizard.callbackRequestsEnabled === true;
  const callbackRequiredIds = ensureCallbackRequiredCollectFieldIds(wizard);

  const report = {
    ok: true,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneE164: agent.phoneNumber?.e164,
    publishedVersion: publishedVersion.version,
    publishedAt: publishedVersion.createdAt,
    bookingStrategy: wizard.bookingBehavior?.bookingStrategy ?? wizard.bookingStrategy,
    callbackRequestsEnabled: callbackEnabled,
    callbackRequiredCollectFieldIds: callbackRequiredIds,
    operationRequirementsRequestCallback: v3.operationRequirements?.request_callback ?? null,
    operationRequirementsBookAppointment: v3.operationRequirements?.book_appointment ?? null,
    astraToolNames: toolNames,
    requestCallbackInCatalog: toolNames.includes("request_callback"),
    sendBookingLinkInCatalog: toolNames.includes("send_booking_link"),
    certReady:
      callbackEnabled &&
      toolNames.includes("request_callback") &&
      (v3.operationRequirements?.request_callback?.length ?? 0) > 0,
  };

  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("WS1_CALLBACK_PRODUCTION_CONFIG", JSON.stringify(report, null, 2));

  if (!report.certReady) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
