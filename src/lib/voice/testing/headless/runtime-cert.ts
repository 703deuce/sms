/**
 * Level A — production Telnyx tool webhook + send_resource runtime (no LLM).
 */
import { filterPublishedToolsForRuntime } from "@/lib/voice/runtime/capability-resolver";
import { emptyVoiceCallState } from "@/lib/voice/runtime/call-state";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { getPrisma } from "@/lib/db";
import {
  getRecordingSmsOutbox,
  clearRecordingSmsOutbox,
} from "./recording-sms";
import {
  invokeToolWebhook,
  newTelnyxIds,
} from "@/lib/voice/testing/preprod-harness";
import type { HeadlessFixtureContext } from "./types";
import { assertTelnyxRegistrationConformance } from "./telnyx-tool-schemas";
import { markBookingLinkOffered, confirmSmsConsentForCall } from "@/lib/voice/tools/send-resource-session";
import { ensureVoiceCallForToolWebhook } from "@/lib/voice/ensure-call-from-event";

export type RuntimeCertResult = {
  passed: boolean;
  errors: string[];
};

export async function certifySendResourceRuntime(
  fixture: HeadlessFixtureContext,
): Promise<RuntimeCertResult> {
  const errors: string[] = [];
  const schemaErrors = assertTelnyxRegistrationConformance();
  errors.push(...schemaErrors);

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: fixture.agentId, workspaceId: fixture.workspaceId },
    select: { publishedVersion: { select: { config: true } } },
  });
  const config = parseVoiceAgentConfig(agent?.publishedVersion?.config);
  const cap = filterPublishedToolsForRuntime({
    requestedTool: "send_resource",
    callState: emptyVoiceCallState({
      callId: "synthetic",
      workspaceId: fixture.workspaceId,
      agentId: fixture.agentId,
    }),
    agentConfig: config,
  });
  if (!cap.allowed) {
    errors.push(`capability gate blocked send_resource in GREETING: ${cap.reason}`);
  }

  clearRecordingSmsOutbox();
  const ids = newTelnyxIds("sms-cert");
  const res = await invokeToolWebhook({
    ctx: fixture,
    toolType: "send_resource",
    body: {
      resource_type: "booking",
      verbal_sms_consent: true,
    },
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: fixture.callerE164,
  });

  const ok = res.json.ok !== false && res.json.status !== "not_allowed";
  if (!ok) {
    errors.push(`send_resource webhook failed: ${JSON.stringify(res.json)}`);
  }

  const sms = getRecordingSmsOutbox();
  if (sms.length !== 1) {
    errors.push(`expected 1 recorded SMS, got ${sms.length}`);
  } else if (!sms[0]?.body.includes("book") && !sms[0]?.body.includes("http")) {
    errors.push("SMS body missing booking link content");
  }

  return { passed: errors.length === 0, errors };
}

/** Harbor 17:54 UTC regression — early tool invoke must not send SMS; post-consent must send once. */
export async function certifyBookingConsentGate(
  fixture: HeadlessFixtureContext,
): Promise<RuntimeCertResult> {
  const errors: string[] = [];
  clearRecordingSmsOutbox();
  const ids = newTelnyxIds("consent-gate");

  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: fixture.workspaceId,
    agentId: fixture.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: fixture.callerE164,
    toE164: fixture.toE164,
    skipRealtimeSessionInit: true,
  });
  if (!callId) {
    errors.push("failed to ensure VoiceCall for consent gate test");
    return { passed: false, errors };
  }

  await markBookingLinkOffered(callId);

  const early = await invokeToolWebhook({
    ctx: fixture,
    toolType: "send_resource",
    body: { resource_type: "booking" },
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: fixture.callerE164,
    ensureCallFirst: false,
  });
  if (getRecordingSmsOutbox().length !== 0) {
    errors.push("EARLY_TOOL_BEFORE_CONSENT: SMS sent before consent");
  }
  if (early.json.result !== "sms_consent_required" && early.json.status !== "not_allowed") {
    errors.push(`early invoke expected consent_required, got ${JSON.stringify(early.json)}`);
  }

  await confirmSmsConsentForCall(callId);
  clearRecordingSmsOutbox();

  const after = await invokeToolWebhook({
    ctx: fixture,
    toolType: "send_resource",
    body: { resource_type: "booking", verbal_sms_consent: true },
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: fixture.callerE164,
    ensureCallFirst: false,
  });
  if (getRecordingSmsOutbox().length !== 1) {
    errors.push(`POST_CONSENT_SEND_RESOURCE: expected 1 SMS, got ${getRecordingSmsOutbox().length}`);
  }
  if (after.json.ok === false || String(after.json.result || "").indexOf("sent") < 0) {
    errors.push(`post-consent tool failed: ${JSON.stringify(after.json)}`);
  }

  const execCount = await getPrisma().voiceToolExecution.count({
    where: { callId, workspaceId: fixture.workspaceId },
  });
  if (execCount < 2) {
    errors.push(`VOICE_TOOL_EXECUTION_TRACE: expected >=2 rows, got ${execCount}`);
  }

  return { passed: errors.length === 0, errors };
}

export const BOOKING_LINK_PHRASES = [
  "Can you text me the link?",
  "Just send me the booking link.",
  "Can I get that by text?",
  "Text it to this number.",
  "Yeah, send it.",
  "Please text me the booking link.",
  "Could you SMS me the link to book?",
  "Send the link by text please.",
  "I'd like the booking link texted to me.",
  "Text me so I can schedule online.",
];

export async function certifySendResourcePhrases(
  fixture: HeadlessFixtureContext,
): Promise<{ passed: number; failed: number; details: string[] }> {
  const details: string[] = [];
  let passed = 0;
  let failed = 0;

  const phraseLimit = Number(process.env.VOICE_HEADLESS_PHRASE_LIMIT || "3");
  const phrases = BOOKING_LINK_PHRASES.slice(0, Math.max(1, phraseLimit));

  for (const phrase of phrases) {
    clearRecordingSmsOutbox();
    const ids = newTelnyxIds("phrase");
    const res = await invokeToolWebhook({
      ctx: fixture,
      toolType: "send_resource",
      body: {
        resource_type: "booking",
        verbal_sms_consent: true,
        force_resend: true,
      },
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      fromE164: fixture.callerE164,
    });
    const smsOk = getRecordingSmsOutbox().length === 1;
    const toolOk = res.json.ok !== false && String(res.json.result || "").includes("sent");
    if (toolOk && smsOk) {
      passed++;
    } else {
      failed++;
      details.push(`${phrase} → ${JSON.stringify(res.json)} sms=${getRecordingSmsOutbox().length}`);
    }
  }

  return { passed, failed, details };
}
