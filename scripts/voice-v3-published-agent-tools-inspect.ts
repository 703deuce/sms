#!/usr/bin/env npx tsx
/**
 * Production proof helper: resolve published wizard → VoiceV3AgentConfig → Astra tool list.
 *
 * Run where DATABASE_URL is set (prod container or local with tunnel):
 *
 *   WORKSPACE_ID=ws_1 AGENT_ID=cmu42zyel1c4x01090c6s335z \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/voice-v3-published-agent-tools-inspect.ts
 *
 * Optional cert reference:
 *   COMPARE_AGENT_ID=cmshz2lc25c622c4i58303501
 */
import { getPrisma } from "@/lib/db";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { listVoiceV3AstraToolNamesForConfig } from "@/lib/voice-v3/tools/voice-tool-catalog";
import { calendarBookingToolSet } from "@/lib/voice-v3/config/capability-parity-audit";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

const workspaceId = process.env.WORKSPACE_ID?.trim();
const agentId = process.env.AGENT_ID?.trim();
const compareAgentId = process.env.COMPARE_AGENT_ID?.trim();

async function inspectOne(id: string) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      publishedVersionId: true,
      phoneNumberId: true,
      draftConfig: true,
    },
  });
  if (!agent) {
    return { agentId: id, error: "agent_not_found" };
  }

  const phone = agent.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId, workspaceId },
        select: { e164: true },
      })
    : null;

  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId,
    agentId: id,
    publishedVersionId: agent.publishedVersionId,
  });

  const tools = listVoiceV3AstraToolNamesForConfig(config).sort();
  const calendarTools = calendarBookingToolSet();
  const missingCalendar = calendarTools.filter((t) => !tools.includes(t));

  const draftParsed = agent.draftConfig
    ? parseVoiceAgentConfig(agent.draftConfig as Parameters<typeof parseVoiceAgentConfig>[0])
    : null;
  const advanced = (draftParsed?.advanced || {}) as Record<string, unknown>;
  const wizard = advanced.appointmentReceptionistWizard as
    | AppointmentReceptionistWizardState
    | undefined;
  const derivedStrategy = wizard ? deriveBookingStrategyFromWizard(wizard) : null;

  return {
    agentId: id,
    name: agent.name,
    status: agent.status,
    publishedVersionId: agent.publishedVersionId,
    e164: phone?.e164 ?? null,
    wizardPinnedBookingStrategy: wizard?.bookingStrategy ?? null,
    wizardDerivedBookingStrategy: derivedStrategy,
    compiledBookingStrategy: config.scheduling?.bookingStrategy ?? null,
    calendarConnectionId: config.calendar?.connectionId ?? null,
    calendarProvider: config.calendar?.provider ?? null,
    transferEnabled: config.transfer?.enabled === true,
    transferDestinationCount: config.transferDestinations?.length ?? 0,
    compiledAstraTools: tools,
    m365CalendarToolsComplete:
      config.scheduling?.bookingStrategy === "MICROSOFT_365"
        ? missingCalendar.length === 0
        : null,
    missingCalendarToolsIfM365: missingCalendar,
    configSource: config.source,
    configVersion: config.configVersion,
  };
}

async function main() {
  if (!workspaceId || !agentId) {
    console.error("WORKSPACE_ID and AGENT_ID are required");
    process.exit(1);
  }

  const primary = await inspectOne(agentId);
  const out: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    primary,
  };

  if (compareAgentId) {
    out.compare = await inspectOne(compareAgentId);
    const p = primary as { compiledAstraTools?: string[] };
    const c = out.compare as { compiledAstraTools?: string[] };
    if (p.compiledAstraTools && c.compiledAstraTools) {
      const onlyPrimary = p.compiledAstraTools.filter((t) => !c.compiledAstraTools!.includes(t));
      const onlyCompare = c.compiledAstraTools.filter((t) => !p.compiledAstraTools!.includes(t));
      out.toolDiff = { onlyPrimary, onlyCompare };
    }
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
