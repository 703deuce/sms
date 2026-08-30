import { NextResponse } from "next/server";
import {
  buildMctbConsentControlledHangupTexml,
  buildMctbConsentInboundTexml,
  resolveMctbConsentTexmlPromptMode,
  wrapMctbConsentTexmlBody,
} from "@/lib/mctb/consent-prompt/texml-response";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import {
  certModeSkipsConsentBackend,
  resolveMctbTexmlCertMode,
} from "@/lib/mctb/texml-ingress/cert-mode";
import { resolveMctbTexmlIngressConfig } from "@/lib/mctb/texml-ingress/config-cache";
import { MCTB_TEXML_ROUTING_MODE } from "@/lib/mctb/texml-ingress/constants";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";
import { parseTelnyxForwardedFrom, normalizeForwardedFromE164 } from "@/lib/voice/telnyx/forwarded-from";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

function texml(body: string) {
  return new NextResponse(wrapMctbConsentTexmlBody(body), {
    status: 200,
    headers: { "Content-Type": TEXML_CONTENT_TYPE },
  });
}

async function parseFields(request: Request): Promise<Record<string, string>> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData().catch(() => new FormData());
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    out[key] = String(value);
  });
  return out;
}

function pick(fields: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = fields[key];
    if (val?.trim()) return val.trim();
  }
  return "";
}

function buildCertModeATexml(): string {
  return `<Say voice="female">Transovo MCTB test A. Your forwarded call reached TeXML.</Say><Pause length="1"/><Hangup/>`;
}

/**
 * TeXML-first MCTB ingress — same Telnyx front door as proven AI path.
 * MUST return XML immediately; no DB before response on press_1 inbound.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const fields = await parseFields(request);
  const from = pick(fields, "From", "from", "Caller");
  const to = pick(fields, "To", "to", "Called");
  const callSid = pick(fields, "CallSid", "call_sid", "CallControlId");
  const connectionId = pick(fields, "ConnectionId", "connection_id");
  const forwardedFrom =
    normalizeForwardedFromE164(pick(fields, "ForwardedFrom", "forwarded_from")) ||
    parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
    "";

  traceMctbTexml("MCTB_INGRESS", {
    to,
    from: from ? "[present]" : "[missing]",
    callSid,
    connectionId,
    certMode: resolveMctbTexmlCertMode(),
  });

  if (!to) {
    traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "missing_to_did" });
    return texml(buildMctbConsentControlledHangupTexml("We are unable to complete your call. Goodbye."));
  }

  const config = await resolveMctbTexmlIngressConfig(to).catch(() => null);

  if (config?.branch === "ai_assistant" && config.routingMode === "telnyx_assistant") {
    traceMctbTexml("MCTB_ROUTING_FAIL", {
      to,
      reason: "did_still_on_ai_assistant_routing",
      routingMode: config.routingMode,
    });
    return texml(
      buildMctbConsentControlledHangupTexml(
        "This line is configured for AI receptionist routing. Goodbye.",
      ),
    );
  }

  const certMode = resolveMctbTexmlCertMode();

  if (certMode === "A") {
    traceMctbTexml("MCTB_TEXML_RETURNED", {
      branch: "cert_a",
      latencyMs: Date.now() - started,
      to,
      callSid,
    });
    return texml(buildCertModeATexml());
  }

  const consentMode = config?.consentMode || "press_1";

  if (consentMode === MCTB_CONSENT_MODE_EXISTING) {
    traceMctbTexml("MCTB_TEXML_RETURNED", {
      branch: "existing_consent",
      latencyMs: Date.now() - started,
      to,
      callSid,
      routingMode: config?.routingMode || MCTB_TEXML_ROUTING_MODE,
    });
    return texml(`<Say voice="female">Thank you for calling.</Say><Hangup/>`);
  }

  const promptMode =
    certMode === "B" || certMode === "C" || certMode === "D"
      ? resolveMctbConsentTexmlPromptMode("say-gather")
      : resolveMctbConsentTexmlPromptMode(null);

  const built = buildMctbConsentInboundTexml(forwardedFrom, {
    promptMode,
    gatherBasePath: "mctb-consent",
  });

  traceMctbTexml("MCTB_TEXML_RETURNED", {
    branch: "press_1_gather",
    latencyMs: Date.now() - started,
    to,
    callSid,
    certMode,
    usesGather: built.usesGather,
    consentMode,
  });

  if (built.usesGather) {
    traceMctbTexml("MCTB_GATHER_STARTED", { to, callSid, gatherActionUrl: built.gatherActionUrl });
  } else {
    traceMctbTexml("MCTB_PROMPT_STARTED", { to, callSid, promptMode: built.promptMode });
  }

  if (!certModeSkipsConsentBackend() && from && config?.workspaceId) {
    void import("@/lib/mctb/consent-prompt/texml-inbound-call-event").then(({ runMctbConsentTexmlDemoCallDetect }) =>
      runMctbConsentTexmlDemoCallDetect({
        from,
        to,
        forwardedFrom: forwardedFrom || null,
        callSid: callSid || null,
        callStatus: pick(fields, "CallStatus", "call_status") || null,
      }).catch(() => undefined),
    );
  }

  return texml(built.body);
}

export async function GET() {
  return texml(`<Say voice="female">MCTB TeXML ingress ready.</Say><Hangup/>`);
}
