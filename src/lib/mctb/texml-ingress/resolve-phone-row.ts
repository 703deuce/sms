import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";
import { isMctbTexmlVoiceIngress } from "@/lib/mctb/sip-ingress/sync";
import { traceMctbDebug } from "@/lib/mctb/debug";
import { mctbTexmlE164Variants } from "./e164-lookup";
import { MCTB_TEXML_ROUTING_MODE, MCTB_TEXML_ROUTING_OWNER } from "./constants";

type PhoneRow = {
  id: string;
  e164: string;
  workspaceId: string;
  providerNumberId: string | null;
  settingsJson: unknown;
  status: string | null;
};

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

function telephonyRoutingMode(settingsJson: unknown): string {
  const settings = readSettings(settingsJson);
  const telephony = settings.telephony as Record<string, unknown> | undefined;
  const provisioning = settings.provisioning as Record<string, unknown> | undefined;
  return String(
    telephony?.routingMode ||
      provisioning?.routingMode ||
      settings.routingOwner ||
      "",
  ).toLowerCase();
}

export function isArchivedIngressRow(settingsJson: unknown): boolean {
  const settings = readSettings(settingsJson);
  if (settings.archivedPlatformDemoRow === true) return true;
  const role = String(settings.mctbRole || "").toLowerCase();
  if (role === "archived" || role === "platform_demo") return true;
  return telephonyRoutingMode(settingsJson) === "archived";
}

function isReleased(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "released";
}

function isBlockedIngressRoutingMode(routingMode: string): boolean {
  return (
    routingMode === "call_control_event_only" ||
    routingMode === "call_control" ||
    routingMode === "telnyx_assistant"
  );
}

async function scoreIngressPhoneRow(phone: PhoneRow): Promise<number> {
  if (isReleased(phone.status)) return -1000;
  if (isArchivedIngressRow(phone.settingsJson)) return -1000;

  const routingMode = telephonyRoutingMode(phone.settingsJson);
  const caps = readPhoneCapabilities({ settingsJson: phone.settingsJson });
  let score = 0;

  if (routingMode === MCTB_TEXML_ROUTING_MODE) score += 200;
  if (isMctbTexmlVoiceIngress(phone.settingsJson)) score += 100;
  const settings = readSettings(phone.settingsJson);
  if (settings.routingOwner === MCTB_TEXML_ROUTING_OWNER) score += 80;
  if (caps.mctbEnabled) score += 40;
  if (phone.providerNumberId) score += 60;
  if (isBlockedIngressRoutingMode(routingMode)) score -= 500;

  const ownerConfig = await loadMissedCallTextConfig(phone.workspaceId);
  if (ownerConfig.enabled && ownerConfig.phoneNumberId === phone.id) {
    score += 150;
  }

  if (settings.platformDemo === true) score -= 300;
  if (String(settings.mctbRole || "").toLowerCase() === "platform_demo") score -= 100;

  return score;
}

/** Pick the best phone_numbers row when duplicate E.164 rows exist (571 demo vs owned). */
export async function resolveBestMctbIngressPhoneRow(
  toE164: string,
): Promise<PhoneRow | null> {
  const variants = mctbTexmlE164Variants(toE164);
  if (!variants.length) return null;

  const prisma = getPrisma();
  const candidates = await prisma.phoneNumber.findMany({
    where: { e164: { in: variants } },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      providerNumberId: true,
      settingsJson: true,
      status: true,
    },
  });
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0]!;

  const scored = await Promise.all(
    candidates.map(async (phone) => ({
      phone,
      score: await scoreIngressPhoneRow(phone),
      routingMode: telephonyRoutingMode(phone.settingsJson),
    })),
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aLive = Boolean(a.phone.providerNumberId);
    const bLive = Boolean(b.phone.providerNumberId);
    if (aLive !== bLive) return aLive ? -1 : 1;
    return 0;
  });
  const best = scored[0];
  if (!best || best.score < 0) return null;

  traceMctbDebug("provision", "ingress_phone_row_resolved", {
    e164: toE164,
    chosenId: best.phone.id,
    chosenWorkspaceId: best.phone.workspaceId,
    chosenRoutingMode: best.routingMode,
    score: best.score,
    candidates: scored.map((row) => ({
      id: row.phone.id,
      workspaceId: row.phone.workspaceId,
      routingMode: row.routingMode,
      score: row.score,
    })),
  });

  return best.phone;
}
