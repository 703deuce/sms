/**
 * Canonical headless voice certification tenant — Woodbridge Plumbing Test.
 */
import { getPrisma } from "@/lib/db";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { compileVoiceAgentPromptFromWizard } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { businessContextRevision } from "@/lib/voice/prompt/build-business-context";
import { VOICE_PROMPT_COMPILER_VERSION } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { applyAmyMinimumSideEffectConfig } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import {
  createPreprodTenant,
  newTelnyxIds,
  preprodCallerAni,
  type PreprodContext,
} from "@/lib/voice/testing/preprod-harness";
import type { HeadlessFixtureContext } from "./types";

export const WOODBRIDGE_BOOKING_LINK = "https://book.test.transovo/woodbridge-plumbing";

export function buildWoodbridgeWizardState(input: {
  agentId: string;
  phoneNumberId: string;
  phoneNumberE164: string;
}): AppointmentReceptionistWizardState {
  let wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard = {
    ...wizard,
    agentId: input.agentId,
    phoneNumberId: input.phoneNumberId,
    phoneNumberE164: input.phoneNumberE164,
    businessName: "Woodbridge Plumbing Test",
    solutionName: "Woodbridge After-Hours Voice",
    agentName: "Alex",
    preset: "after_hours",
    answerWhen: "after_hours",
    websiteUrl: "https://woodbridge-plumbing-test.example",
    openingGreeting:
      "Thank you for calling Woodbridge Plumbing Test. This is Alex, the after-hours assistant. How can I help you?",
    capabilities: [
      "answer_questions",
      "take_messages",
      "transfer_calls",
      "book_appointments",
      "send_sms_confirmations",
    ],
    knowledgeItems: wizard.knowledgeItems.map((item) => {
      if (item.id === "hours") {
        return {
          ...item,
          summary: "Monday through Friday, 8:00 AM to 6:00 PM. We are currently after hours.",
          status: "complete",
          statusLabel: "Configured",
        };
      }
      if (item.id === "location") {
        return {
          ...item,
          summary: "123 Test Street, Woodbridge, VA 22191",
          status: "complete",
          statusLabel: "Configured",
        };
      }
      if (item.id === "pricing") {
        return {
          ...item,
          summary: "Diagnostic fee is $89.",
          status: "complete",
          statusLabel: "Configured",
        };
      }
      if (item.id === "services") {
        return {
          ...item,
          summary: "Plumbing, water heaters, and drain cleaning.",
          status: "complete",
          statusLabel: "Configured",
        };
      }
      return item;
    }),
    appointmentTypes: [
      {
        id: "service_visit",
        name: "Service Visit",
        durationMin: 60,
        calendar: "default",
        status: "ready",
        requiredFields: [],
        bookingPermission: "send_booking_link",
        enabled: true,
      },
      ...wizard.appointmentTypes
        .filter((t) => t.id !== "service_visit")
        .map((t) => ({ ...t, enabled: false })),
    ],
    transferDestinationPhone: "+15715550100",
    transferDestinationName: "On-call plumber",
  };
  return wizard;
}

async function publishAgentConfigWithoutProviderSync(
  workspaceId: string,
  agentId: string,
  config: VoiceAgentConfig,
): Promise<void> {
  const prisma = getPrisma();
  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;
  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId,
      version,
      config: config as object,
      publishedBy: "headless-cert",
      testStatus: "skipped",
      deploymentStatus: "deployed",
      isMain: true,
    },
  });
  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      publishedVersionId: versionRow.id,
      status: "ACTIVE",
      draftConfig: config as object,
    },
  });
}

export async function seedWoodbridgeHeadlessFixture(): Promise<HeadlessFixtureContext> {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";
  process.env.VOICE_BOOKING_LINK_URL = WOODBRIDGE_BOOKING_LINK;
  process.env.HEADLESS_PROVIDER_MODE = process.env.HEADLESS_PROVIDER_MODE || "recording";
  process.env.VOICE_HEADLESS_SMS_MODE = process.env.VOICE_HEADLESS_SMS_MODE || "recording";

  const ctx = await createPreprodTenant();
  const prisma = getPrisma();

  const smsPn = await prisma.phoneNumber.create({
    data: {
      workspaceId: ctx.workspaceId,
      e164: HP_CERTIFIED_SMS_E164,
      type: "Local",
      status: "Active",
      a2pStatus: "APPROVED",
    },
  });

  const wizard = buildWoodbridgeWizardState({
    agentId: ctx.agentId,
    phoneNumberId: ctx.phoneNumberId,
    phoneNumberE164: ctx.toE164,
  });

  let draftConfig = buildWizardAgentConfig(wizard);
  draftConfig = applyAmyMinimumSideEffectConfig(draftConfig);
  await updateVoiceAgentDraft(ctx.workspaceId, ctx.agentId, { draftConfig });
  await publishAgentConfigWithoutProviderSync(ctx.workspaceId, ctx.agentId, draftConfig);

  const systemPrompt = compileVoiceAgentPromptFromWizard(wizard);
  const ids = newTelnyxIds("headless");
  const callerE164 = preprodCallerAni();

  return {
    ...ctx,
    wizard,
    systemPrompt,
    bookingLinkUrl: WOODBRIDGE_BOOKING_LINK,
    callerE164,
    conversationId: ids.conversationId,
    callControlId: ids.callControlId,
  };
}

export async function cleanupHeadlessFixture(ctx: PreprodContext): Promise<void> {
  const { cleanupPreprodTenant } = await import("@/lib/voice/testing/preprod-harness");
  const prisma = getPrisma();
  await prisma.phoneNumber
    .deleteMany({
      where: { workspaceId: ctx.workspaceId, e164: HP_CERTIFIED_SMS_E164 },
    })
    .catch(() => undefined);
  await cleanupPreprodTenant(ctx);
}

export function fixturePromptMetadata(wizard: AppointmentReceptionistWizardState) {
  return {
    promptVersion: VOICE_PROMPT_COMPILER_VERSION,
    businessContextRevision: businessContextRevision(wizard),
  };
}
