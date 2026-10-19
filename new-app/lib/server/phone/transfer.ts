import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

export type TransferTarget = { id: string; name: string; number: string };

export function parseTransferTargets(prefsJson: unknown): TransferTarget[] {
  if (!prefsJson || typeof prefsJson !== "object") return [];
  const raw = (prefsJson as { transferTargets?: unknown }).transferTargets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const number = typeof r.number === "string" ? normalizeE164(r.number) : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!number) return null;
      return {
        id: typeof r.id === "string" ? r.id : `t${i + 1}`,
        name: name || number,
        number,
      };
    })
    .filter(Boolean) as TransferTarget[];
}

export function resolveTransferControlId(call: {
  telnyxCallControlId: string | null;
  telnyxCallLegId: string | null;
  metadata: unknown;
}): string | null {
  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (typeof meta.callerCallControlId === "string" && meta.callerCallControlId) {
    return meta.callerCallControlId;
  }
  if (typeof meta.browserCallControlId === "string" && meta.browserCallControlId) {
    return meta.browserCallControlId;
  }
  return call.telnyxCallControlId || call.telnyxCallLegId;
}

export async function transferHumanCall(input: {
  workspaceId: string;
  humanCallId: string;
  toE164: string;
}) {
  if (!isTelnyxPhoneConfigured()) throw new Error("Telnyx is not configured");
  const prisma = getPrisma();
  const to = normalizeE164(input.toE164);
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) throw new Error("Call not found");

  const controlId = resolveTransferControlId(call);
  if (!controlId) throw new Error("No active call leg to transfer");

  phoneServerLog("phone-transfer", "start", {
    humanCallId: input.humanCallId,
    to: to.slice(0, 6) + "…",
    controlPrefix: controlId.slice(0, 8),
  });

  await telnyxCallAction(controlId, "transfer", { to });

  const updated = await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "transferred",
      disposition: `transferred:${to}`,
      endedAt: new Date(),
      handled: true,
    },
  });

  return updated;
}

export async function getTransferTargets(workspaceId: string): Promise<TransferTarget[]> {
  const prisma = getPrisma();
  const row = await prisma.workspacePhoneSettings.findUnique({ where: { workspaceId } });
  const fromPrefs = parseTransferTargets(row?.prefsJson);
  if (fromPrefs.length > 0) return fromPrefs;

  const env = process.env.PHONE_TRANSFER_TARGETS_JSON?.trim();
  if (env) {
    try {
      return parseTransferTargets({ transferTargets: JSON.parse(env) });
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveTransferTargets(workspaceId: string, targets: TransferTarget[]) {
  const prisma = getPrisma();
  const existing = await prisma.workspacePhoneSettings.findUnique({ where: { workspaceId } });
  const prefs = (existing?.prefsJson && typeof existing.prefsJson === "object"
    ? existing.prefsJson
    : {}) as Record<string, unknown>;
  const cleaned = targets
    .map((t, i) => ({
      id: t.id || `t${i + 1}`,
      name: t.name.trim(),
      number: normalizeE164(t.number),
    }))
    .filter((t) => t.number);

  await prisma.workspacePhoneSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      prefsJson: { ...prefs, transferTargets: cleaned },
    },
    update: {
      prefsJson: { ...prefs, transferTargets: cleaned },
    },
  });
  return cleaned;
}
