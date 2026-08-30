export type MctbDebugArea =
  | "setup"
  | "missed-calls"
  | "missed-call-detail"
  | "consent-log"
  | "consent-prompt"
  | "analytics"
  | "exclusions"
  | "onboarding"
  | "try-it"
  | "setup-test"
  | "demo"
  | "live-test"
  | "tfv"
  | "admin-test"
  | "tenant-binding"
  | "phone-validation"
  | "provision"
  | "client";

/** On by default (including production). Set MCTB_DEBUG=0 to disable. */
export function isMctbDebugEnabled(): boolean {
  const raw = process.env.MCTB_DEBUG?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") {
    return false;
  }
  return true;
}

function serializeError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

/** Structured MCTB debug line for the dev server terminal. */
export function traceMctbDebug(
  area: MctbDebugArea,
  event: string,
  fields?: Record<string, unknown>,
): void {
  if (!isMctbDebugEnabled()) return;
  const payload = {
    source: "mctb-debug",
    area,
    event,
    at: new Date().toISOString(),
    ...fields,
  };
  console.log(`[mctb-debug] ${area}:${event}`, JSON.stringify(payload));
}

export function traceMctbDebugError(
  area: MctbDebugArea,
  event: string,
  err: unknown,
  fields?: Record<string, unknown>,
): void {
  if (!isMctbDebugEnabled()) return;
  const { error, stack } = serializeError(err);
  traceMctbDebug(area, event, { ...fields, error, stack });
  console.error(`[mctb-debug] ${area}:${event} ERROR`, error);
}

export function summarizeMctbPhoneOptions(
  options: Array<{ id: string; e164: string; friendlyName?: string | null; source?: string }>,
): Array<{ id: string; e164: string; label: string; source?: string }> {
  return options.map((p) => ({
    id: p.id,
    e164: p.e164,
    label: p.friendlyName || p.e164,
    source: p.source,
  }));
}
