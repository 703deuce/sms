#!/usr/bin/env npx tsx
/**
 * Production ops: switch appointment-receptionist cert agent to SEND_LINK and publish.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   AGENT_ID=... WORKSPACE_ID=ws_1 BOOKING_LINK_URL=https://... \
 *   npx tsx scripts/switch-cert-agent-booking-to-send-link.ts
 *
 * DRY_RUN=1 — preview only, no DB writes.
 */
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { isSendBookingLinkAuthorized } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID =
  process.env.AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const DIALED = process.env.PHONE_E164?.trim() || "+15717491060";
const DRY_RUN = process.env.DRY_RUN === "1";
const BOOKING_LINK_URL =
  process.env.BOOKING_LINK_URL?.trim() ||
  process.env.CERT_BOOKING_LINK_URL?.trim() ||
  "";

function wizardFromDraft(draft: Record<string, unknown>): AppointmentReceptionistWizardState | null {
  const advanced = (draft.advanced || {}) as Record<string, unknown>;
  const w = advanced.appointmentReceptionistWizard;
  if (!w || typeof w !== "object") return null;
  return w as AppointmentReceptionistWizardState;
}

function patchWizardForSendLink(
  wizard: AppointmentReceptionistWizardState,
  linkUrl: string,
): AppointmentReceptionistWizardState {
  const appointmentTypes = (wizard.appointmentTypes || []).map((t) => {
    if (t.enabled === false) return t;
    return {
      ...t,
      bookingPermission: "send_booking_link" as const,
    };
  });
  return {
    ...wizard,
    bookingStrategy: "SEND_LINK",
    bookingLinkUrl: linkUrl,
    bookingLinkLabel: wizard.bookingLinkLabel?.trim() || "Book your appointment",
    sendLinkConsentRequired: wizard.sendLinkConsentRequired !== false,
    appointmentTypes: appointmentTypes.length ? appointmentTypes : wizard.appointmentTypes,
    capabilities: wizard.capabilities?.includes("book_appointments")
      ? wizard.capabilities
      : [...(wizard.capabilities || []), "book_appointments"],
    outboundSmsMode: wizard.outboundSmsMode || "explicit_number",
  };
}

async function main() {
  const prisma = getPrisma();

  const routing = await resolveAgentByCalledNumber(DIALED);
  if (routing && routing.agentId !== AGENT_ID) {
    console.warn("ROUTING_AGENT_MISMATCH", {
      dialed: DIALED,
      routedAgentId: routing.agentId,
      scriptAgentId: AGENT_ID,
    });
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent not found ${AGENT_ID} in ${WORKSPACE_ID}`);

  const draft = (agent.draftConfig || {}) as Record<string, unknown>;
  let wizard = wizardFromDraft(draft);
  if (!wizard) {
    throw new Error("No appointmentReceptionistWizard on draftConfig — open wizard in UI first");
  }

  const priorStrategy = wizard.bookingStrategy;
  const priorLink = wizard.bookingLinkUrl;
  const linkUrl =
    BOOKING_LINK_URL ||
    String(wizard.bookingLinkUrl || "").trim() ||
    String(
      (parseVoiceAgentConfig(agent.draftConfig).advanced as Record<string, unknown>)
        ?.bookingLink || "",
    ).trim();

  if (!linkUrl) {
    throw new Error(
      "Set BOOKING_LINK_URL (https booking page) — wizard has no bookingLinkUrl",
    );
  }
  if (!linkUrl.startsWith("https://")) {
    throw new Error(`BOOKING_LINK_URL must be https — got ${linkUrl}`);
  }

  const nextWizard = patchWizardForSendLink(wizard, linkUrl);
  const nextDraft = buildWizardAgentConfig(nextWizard);

  const previewConfig = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });
  console.log("BEFORE", {
    agentId: AGENT_ID,
    status: agent.status,
    publishedVersionId: agent.publishedVersionId,
    priorStrategy,
    priorLink,
    priorV3Strategy: previewConfig.scheduling?.bookingStrategy,
    sendLinkAuthorized: isSendBookingLinkAuthorized(previewConfig),
    v3Tools: listVoiceV3AstraToolNamesForConfig(previewConfig).filter((n) =>
      ["book_appointment", "find_availability", "send_booking_link"].includes(n),
    ),
  });

  console.log("AFTER_PATCH_PREVIEW", {
    bookingStrategy: nextWizard.bookingStrategy,
    bookingLinkUrl: nextWizard.bookingLinkUrl,
    appointmentPermissions: nextWizard.appointmentTypes
      ?.filter((t) => t.enabled)
      .map((t) => ({ name: t.name, bookingPermission: t.bookingPermission })),
    advancedBookingStrategy: (nextDraft.advanced as Record<string, unknown>)
      ?.bookingStrategy,
  });

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — no writes");
    return;
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, {
    draftConfig: nextDraft,
    status: agent.status === "ACTIVE" ? "ACTIVE" : undefined,
  });

  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AGENT_ID,
    "cloud-agent-send-link-switch",
  );

  const afterConfig = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });

  console.log("PUBLISHED", {
    versionId: published.version.id,
    versionNumber: published.version.version,
    status: published.agent.status,
    v3BookingStrategy: afterConfig.scheduling?.bookingStrategy,
    bookingLinkUrl: afterConfig.bookingStrategyDetail?.bookingLinkUrl,
    sendLinkAuthorized: isSendBookingLinkAuthorized(afterConfig),
    v3Tools: listVoiceV3AstraToolNamesForConfig(afterConfig).filter((n) =>
      [
        "book_appointment",
        "find_availability",
        "set_scheduling_preference",
        "send_booking_link",
      ].includes(n),
    ),
  });

  const setup = await prisma.solutionSetup.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      externalKey: AGENT_ID,
      solutionType: "appointment-receptionist",
    },
  });
  if (setup?.configJson) {
    const cfg = setup.configJson as Record<string, unknown>;
    await prisma.solutionSetup.update({
      where: { id: setup.id },
      data: {
        configJson: {
          ...cfg,
          wizard: { ...(cfg.wizard as object), ...nextWizard },
        },
      },
    });
    console.log("SOLUTION_SETUP_WIZARD_SYNCED", { setupId: setup.id });
  }

  console.log(
    "READY — place a new call to",
    DIALED,
    "and ask to book; expect send_booking_link flow (not Microsoft find/book).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
