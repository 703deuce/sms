import "server-only";

function decodeClientState(raw?: string): Record<string, unknown> | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const json = Buffer.from(s, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readDynamicVar(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const top = body[key];
  if (typeof top === "string" && top.trim()) return top.trim();
  const dyn = body.dynamic_variables;
  if (dyn && typeof dyn === "object" && !Array.isArray(dyn)) {
    const v = (dyn as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const assistantDyn = body.assistant_dynamic_variables;
  if (assistantDyn && typeof assistantDyn === "object" && !Array.isArray(assistantDyn)) {
    const v = (assistantDyn as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Runtime-supplied Prisma VoiceCall id — never from LLM tool arguments. */
export function resolveTrustedTransovoVoiceCallId(input: {
  headers?: Headers | null;
  body?: Record<string, unknown> | null;
}): string | null {
  const fromHeader = input.headers?.get("x-transovo-voice-call-id")?.trim();
  if (fromHeader) return fromHeader;

  const body = input.body || {};
  const fromBody =
    readDynamicVar(body, "transovo_voice_call_id") || readDynamicVar(body, "transovo_call_id");
  if (fromBody) return fromBody;

  const clientState = decodeClientState(
    typeof body.client_state === "string" ? body.client_state : undefined,
  );
  const fromState = clientState?.callId;
  if (typeof fromState === "string" && fromState.trim()) return fromState.trim();

  return null;
}

export function isTrustedPrismaVoiceCallId(id: string): boolean {
  const s = id.trim();
  if (!s) return false;
  if (s.startsWith("v3:") || s.startsWith("cc:") || s.startsWith("conv:")) return false;
  return true;
}
