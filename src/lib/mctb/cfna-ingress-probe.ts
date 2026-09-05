import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createId } from "@/lib/supabase/id";
import {
  hasDiversionHeaderInPayload,
  normalizeForwardedFromE164,
  parseTelnyxForwardedFrom,
} from "@/lib/voice/telnyx/forwarded-from";

export type CfnaProbeLayer =
  | "mctb-entry"
  | "mctb-consent"
  | "texml-status"
  | "telnyx-voice-cc";

export type CfnaProbeEvent = {
  at: string;
  layer: CfnaProbeLayer;
  eventType: string;
  to: string | null;
  from: string | null;
  callSid: string | null;
  connectionId: string | null;
  forwardSignals: {
    attNetInPayload: boolean;
    telnyxHostInPayload: boolean;
    forwardedFrom: string | null;
    hasDiversionHeader: boolean;
    hasCallControlId: boolean;
    programmableLegLikely: boolean;
  };
  sipHints: Record<string, string>;
  fieldKeys: string[];
  note?: string;
};

export type CfnaIngressProbeExtract = {
  calledDid: string | null;
  callerE164: string | null;
  toRaw: string | null;
  fromRaw: string | null;
  requestUri: string | null;
  diversionHeader: string | null;
  historyInfo: string | null;
  callSid: string | null;
  connectionId: string | null;
  forwardedFrom: string | null;
  attNetInPayload: boolean;
  telnyxHostInPayload: boolean;
  hasDiversionHeader: boolean;
  hasCallControlId: boolean;
};

export type MctbEntryProbeHandle = {
  sessionId: string;
  dbRowId: string | null;
  startedAt: number;
};

const RING_MAX = 80;
const probeRing: CfnaProbeEvent[] = [];

type GlobalProbe = {
  cfnaProbeRing?: CfnaProbeEvent[];
};

function ring(): CfnaProbeEvent[] {
  const g = globalThis as GlobalProbe;
  if (!g.cfnaProbeRing) g.cfnaProbeRing = probeRing;
  return g.cfnaProbeRing;
}

function envFlag(name: string): boolean {
  const flag = process.env[name]?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function isCfnaProbeEnabled(): boolean {
  const flag = process.env.MCTB_CFNA_PROBE?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return process.env.NODE_ENV !== "production";
}

/** DB persistence — on by default in dev; set MCTB_CFNA_PROBE_DB=1 to force in production. */
export function isCfnaProbeDbEnabled(): boolean {
  if (envFlag("MCTB_CFNA_PROBE_DB")) return true;
  if (envFlag("MCTB_CFNA_PROBE_DB_DISABLE")) return false;
  return process.env.NODE_ENV !== "production";
}

function pickField(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = payload[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function extractSipHeaderValue(
  payload: Record<string, unknown>,
  headerName: string,
): string | null {
  const headers = payload.sip_headers;
  if (!Array.isArray(headers)) return null;
  for (const raw of headers) {
    if (!raw || typeof raw !== "object") continue;
    const header = raw as { name?: string; value?: string };
    if (String(header.name || "").toLowerCase() !== headerName.toLowerCase()) continue;
    const val = String(header.value || "").trim();
    if (val) return val.slice(0, 800);
  }
  return null;
}

function collectSipHints(payload: Record<string, unknown>): Record<string, string> {
  const hints: Record<string, string> = {};
  const interesting = /sip|uri|forward|diversion|history|assert|jip|connection|control|call.?sid/i;

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (!interesting.test(key)) continue;
    if (typeof value === "string") {
      hints[key] = value.slice(0, 400);
      continue;
    }
    if (Array.isArray(value) && key.toLowerCase().includes("header")) {
      hints[key] = JSON.stringify(value).slice(0, 600);
    }
  }

  return hints;
}

function payloadHasAttNet(payload: Record<string, unknown>): boolean {
  return JSON.stringify(payload).toLowerCase().includes("one.att.net");
}

function payloadHasTelnyxHost(payload: Record<string, unknown>): boolean {
  const blob = JSON.stringify(payload).toLowerCase();
  return (
    blob.includes("telnyx.com") ||
    blob.includes("us.icp.telnyx") ||
    blob.includes("192.76.120.") ||
    blob.includes("64.16.250.")
  );
}

function resolveCallSid(payload: Record<string, unknown>): string | null {
  return pickField(
    payload,
    "call_control_id",
    "CallSid",
    "call_sid",
    "call_session_id",
    "CallSessionId",
  );
}

export function extractCfnaIngressFields(
  payload: Record<string, unknown>,
): CfnaIngressProbeExtract {
  const toRaw = pickField(payload, "to", "To", "Called", "destination_number", "cld");
  const fromRaw = pickField(payload, "from", "From", "Caller", "caller_number", "cli");
  const callSid = resolveCallSid(payload);
  const connectionId = pickField(payload, "connection_id", "ConnectionId");
  const forwardedFrom =
    normalizeForwardedFromE164(
      pickField(payload, "forwarded_from", "ForwardedFrom", "forwardedFrom"),
    ) || parseTelnyxForwardedFrom(payload) || null;

  const requestUri =
    pickField(
      payload,
      "RequestUri",
      "request_uri",
      "ToSipUri",
      "to_sip_uri",
      "SipUri",
      "sip_uri",
    ) || null;

  const diversionHeader =
    pickField(payload, "Diversion", "diversion") ||
    extractSipHeaderValue(payload, "diversion") ||
    null;

  const historyInfo =
    pickField(payload, "HistoryInfo", "history_info", "History-Info") ||
    extractSipHeaderValue(payload, "history-info") ||
    null;

  return {
    calledDid: toRaw,
    callerE164: fromRaw,
    toRaw,
    fromRaw,
    requestUri,
    diversionHeader,
    historyInfo,
    callSid,
    connectionId,
    forwardedFrom,
    attNetInPayload: payloadHasAttNet(payload),
    telnyxHostInPayload: payloadHasTelnyxHost(payload),
    hasDiversionHeader: hasDiversionHeaderInPayload(payload),
    hasCallControlId: Boolean(callSid),
  };
}

export function buildCfnaProbeEvent(input: {
  layer: CfnaProbeLayer;
  eventType: string;
  payload: Record<string, unknown>;
  note?: string;
}): CfnaProbeEvent {
  const payload = input.payload;
  const extracted = extractCfnaIngressFields(payload);

  const event: CfnaProbeEvent = {
    at: new Date().toISOString(),
    layer: input.layer,
    eventType: input.eventType,
    to: extracted.toRaw,
    from: extracted.fromRaw,
    callSid: extracted.callSid,
    connectionId: extracted.connectionId,
    forwardSignals: {
      attNetInPayload: extracted.attNetInPayload,
      telnyxHostInPayload: extracted.telnyxHostInPayload,
      forwardedFrom: extracted.forwardedFrom,
      hasDiversionHeader: extracted.hasDiversionHeader,
      hasCallControlId: extracted.hasCallControlId,
      programmableLegLikely: Boolean(
        extracted.callSid && input.eventType !== "texml.call.hangup",
      ),
    },
    sipHints: collectSipHints(payload),
    fieldKeys: Object.keys(payload).sort(),
    note: input.note,
  };

  return event;
}

function appendJsonl(event: CfnaProbeEvent): void {
  try {
    const dir = join(process.cwd(), ".cfna-probe");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // best-effort only — console log is primary
  }
}

export function recordCfnaProbeEvent(event: CfnaProbeEvent): void {
  const buf = ring();
  buf.push(event);
  while (buf.length > RING_MAX) buf.shift();
  appendJsonl(event);
}

function buildDbRowFromEvent(
  event: CfnaProbeEvent,
  payload: Record<string, unknown>,
  extra?: {
    probeSessionId?: string | null;
    mctbEntryInvoked?: boolean;
    texmlGenerated?: boolean | null;
    texmlBranch?: string | null;
    responseStatus?: number | null;
    responseLatencyMs?: number | null;
    xmlBytes?: number | null;
    errorPayload?: Record<string, unknown> | null;
    completedAt?: Date | null;
  },
) {
  const extracted = extractCfnaIngressFields(payload);
  return {
    layer: event.layer,
    eventType: event.eventType,
    probeSessionId: extra?.probeSessionId ?? null,
    calledDid: extracted.calledDid,
    callerE164: extracted.callerE164,
    toRaw: extracted.toRaw,
    fromRaw: extracted.fromRaw,
    requestUri: extracted.requestUri,
    diversionHeader: extracted.diversionHeader,
    historyInfo: extracted.historyInfo,
    callSid: extracted.callSid,
    connectionId: extracted.connectionId,
    mctbEntryInvoked: extra?.mctbEntryInvoked ?? event.layer === "mctb-entry",
    texmlGenerated: extra?.texmlGenerated ?? null,
    texmlBranch: extra?.texmlBranch ?? null,
    responseStatus: extra?.responseStatus ?? null,
    responseLatencyMs: extra?.responseLatencyMs ?? null,
    xmlBytes: extra?.xmlBytes ?? null,
    attNetInPayload: extracted.attNetInPayload,
    telnyxHostInPayload: extracted.telnyxHostInPayload,
    forwardedFrom: extracted.forwardedFrom,
    hasDiversionHeader: extracted.hasDiversionHeader,
    hasCallControlId: extracted.hasCallControlId,
    sipHints: event.sipHints,
    fieldKeys: event.fieldKeys,
    payloadSnapshot: payload,
    errorPayload: extra?.errorPayload ?? null,
    note: event.note ?? null,
    completedAt: extra?.completedAt ?? null,
  };
}

async function persistCfnaProbeRow(
  row: ReturnType<typeof buildDbRowFromEvent>,
  id?: string,
): Promise<string | null> {
  if (!isCfnaProbeDbEnabled()) return null;
  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const created = await prisma.cfnaIngressProbe.create({
      data: { id: id ?? createId(), ...row },
    });
    return created.id as string;
  } catch (err) {
    console.error(
      JSON.stringify({
        source: "cfna-ingress-probe",
        event: "db_persist_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

async function updateCfnaProbeRow(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!isCfnaProbeDbEnabled()) return;
  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    await prisma.cfnaIngressProbe.update({
      where: { id },
      data: patch,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        source: "cfna-ingress-probe",
        event: "db_update_failed",
        id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/** Phase 1: record mctb-entry ingress (non-blocking — must not delay TeXML answer). */
export function beginMctbEntryCfnaProbe(input: {
  payload: Record<string, unknown>;
  requestUrl?: string | null;
  note?: string;
}): MctbEntryProbeHandle {
  const startedAt = Date.now();
  const sessionId = createId();
  const payload = {
    ...input.payload,
    ...(input.requestUrl ? { voice_url_hit: input.requestUrl } : {}),
  };

  const event = buildCfnaProbeEvent({
    layer: "mctb-entry",
    eventType: "texml.voice_url.hit",
    payload,
    note:
      input.note ??
      "mctb-entry voice_url invoked — programmable TeXML ingress reached",
  });

  if (isCfnaProbeEnabled()) {
    const banner = event.forwardSignals.attNetInPayload ? "ATT_FORWARD_LEG" : "INBOUND_LEG";
    const programmable = event.forwardSignals.hasCallControlId
      ? "PROGRAMMABLE"
      : "NOT_PROGRAMMABLE";

    console.log(
      `\n${"═".repeat(72)}\nCFNA_PROBE ${banner} ${programmable} layer=${event.layer} event=${event.eventType}\n${"═".repeat(72)}`,
    );
    console.log(JSON.stringify(event, null, 2));
    if (Object.keys(event.sipHints).length) {
      console.log("CFNA_PROBE sip_hints:", JSON.stringify(event.sipHints, null, 2));
    }
    if (event.note) console.log("CFNA_PROBE note:", event.note);
    console.log(`${"─".repeat(72)}\n`);
    recordCfnaProbeEvent(event);
  }

  const row = buildDbRowFromEvent(event, payload, {
    probeSessionId: sessionId,
    mctbEntryInvoked: true,
    texmlGenerated: null,
  });

  let dbRowId: string | null = null;
  if (isCfnaProbeDbEnabled()) {
    dbRowId = sessionId;
    void persistCfnaProbeRow(row, sessionId);
  }

  return { sessionId, dbRowId, startedAt };
}

/** Phase 2: record TeXML response outcome for the same mctb-entry request. */
export function finishMctbEntryCfnaProbe(
  handle: MctbEntryProbeHandle | null | undefined,
  input: {
    texmlGenerated: boolean;
    responseStatus: number;
    texmlBranch?: string | null;
    xmlBytes?: number | null;
    errorPayload?: Record<string, unknown> | null;
  },
): void {
  if (!handle?.dbRowId) return;
  const latencyMs = Date.now() - handle.startedAt;
  void updateCfnaProbeRow(handle.dbRowId, {
    texmlGenerated: input.texmlGenerated,
    texmlBranch: input.texmlBranch ?? null,
    responseStatus: input.responseStatus,
    responseLatencyMs: latencyMs,
    xmlBytes: input.xmlBytes ?? null,
    errorPayload: input.errorPayload ?? null,
    completedAt: new Date().toISOString(),
  });
}

export function probeCfnaIngress(input: {
  layer: CfnaProbeLayer;
  eventType: string;
  payload: Record<string, unknown>;
  note?: string;
}): CfnaProbeEvent {
  const event = buildCfnaProbeEvent(input);
  if (!isCfnaProbeEnabled()) {
    if (isCfnaProbeDbEnabled()) {
      void persistCfnaProbeRow(
        buildDbRowFromEvent(event, input.payload, {
          mctbEntryInvoked: input.layer === "mctb-entry",
          completedAt: new Date(),
        }),
      );
    }
    return event;
  }

  const banner = event.forwardSignals.attNetInPayload ? "ATT_FORWARD_LEG" : "INBOUND_LEG";
  const programmable = event.forwardSignals.hasCallControlId ? "PROGRAMMABLE" : "NOT_PROGRAMMABLE";

  console.log(
    `\n${"═".repeat(72)}\nCFNA_PROBE ${banner} ${programmable} layer=${event.layer} event=${event.eventType}\n${"═".repeat(72)}`,
  );
  console.log(JSON.stringify(event, null, 2));
  if (Object.keys(event.sipHints).length) {
    console.log("CFNA_PROBE sip_hints:", JSON.stringify(event.sipHints, null, 2));
  }
  if (event.note) console.log("CFNA_PROBE note:", event.note);
  console.log(`${"─".repeat(72)}\n`);

  recordCfnaProbeEvent(event);

  if (isCfnaProbeDbEnabled()) {
    void persistCfnaProbeRow(
      buildDbRowFromEvent(event, input.payload, {
        mctbEntryInvoked: input.layer === "mctb-entry",
        completedAt: new Date(),
      }),
    );
  }

  return event;
}

export function listCfnaProbeEvents(limit = 40): CfnaProbeEvent[] {
  const buf = ring();
  return buf.slice(-Math.max(1, Math.min(limit, RING_MAX)));
}

export async function listCfnaProbeDbEvents(limit = 40): Promise<
  Array<Record<string, unknown>>
> {
  if (!isCfnaProbeDbEnabled()) return [];
  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const rows = await prisma.cfnaIngressProbe.findMany({
      orderBy: { recordedAt: "desc" },
      take: Math.max(1, Math.min(limit, 200)),
    });
    return rows as Array<Record<string, unknown>>;
  } catch (err) {
    console.error(
      JSON.stringify({
        source: "cfna-ingress-probe",
        event: "db_list_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return [];
  }
}

export function clearCfnaProbeEvents(): void {
  ring().length = 0;
}

const WATCHED_E164_SUFFIXES = ["5717491060", "5714073615", "8663464256"];

export function isWatchedCfnaDid(e164: string | null | undefined): boolean {
  const digits = String(e164 || "").replace(/\D/g, "");
  if (!digits) return false;
  return WATCHED_E164_SUFFIXES.some((suffix) => digits.endsWith(suffix));
}

export function shouldProbeCfnaPayload(payload: Record<string, unknown>): boolean {
  const to = pickField(payload, "to", "To", "Called", "destination_number", "cld");
  if (isWatchedCfnaDid(to)) return true;
  return payloadHasAttNet(payload);
}
