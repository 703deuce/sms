import { normalizeForwardedFromE164 } from "@/lib/voice/telnyx/forwarded-from";
import { correlateTwilioIngressToFirstHop } from "@/lib/mctb/voice-bridge/first-hop";
import { MCTB_TWILIO_INGRESS_DIAGNOSTIC_SAY } from "@/lib/mctb/voice-bridge/telnyx-handler";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export const MCTB_TWILIO_INGRESS_LOG_SOURCE = "mctb-twilio-ingress";

export function logMctbTwilioIngress(event: string, extra: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: MCTB_TWILIO_INGRESS_LOG_SOURCE,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

export function buildMctbTwilioIngressDiagnosticTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(MCTB_TWILIO_INGRESS_DIAGNOSTIC_SAY)}</Say>
  <Hangup/>
</Response>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function handleMctbTwilioIngressVoice(params: Record<string, string>): Promise<{
  twiml: string;
  resolvedCallEventId: string | null;
  correlationMethod: string;
}> {
  const callSid = params.CallSid || "";
  const from = params.From || params.Caller || "";
  const to = params.To || params.Called || "";
  const forwardedFrom =
    normalizeForwardedFromE164(params.ForwardedFrom) ||
    normalizeForwardedFromE164(params.forwardedFrom) ||
    null;

  logMctbTwilioIngress("voice_received", {
    callSid,
    from,
    to,
    forwardedFrom,
    direction: params.Direction || null,
    callStatus: params.CallStatus || null,
  });

  let resolvedCallEventId: string | null = null;
  let correlationMethod = "none";
  try {
    const fromE164 = normalizeE164(from);
    const toE164 = normalizeE164(to);
    const correlated = await correlateTwilioIngressToFirstHop({
      callSid,
      fromE164,
      toE164,
      forwardedFromE164: forwardedFrom,
    });
    resolvedCallEventId = correlated.callEventId;
    correlationMethod = correlated.correlationMethod;
  } catch (err) {
    logMctbTwilioIngress("correlation_failed", {
      callSid,
      error: err instanceof Error ? err.message : String(err),
    });
    correlationMethod = "error";
  }

  logMctbTwilioIngress("voice_correlated", {
    callSid,
    from,
    to,
    forwardedFrom,
    resolvedCallEventId,
    correlationMethod,
  });

  return {
    twiml: buildMctbTwilioIngressDiagnosticTwiml(),
    resolvedCallEventId,
    correlationMethod,
  };
}
