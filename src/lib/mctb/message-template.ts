import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { DEFAULT_ONBOARDING_MESSAGE } from "@/lib/mctb/onboarding/types";

/** Authoritative recovery opener for Transovo platform-sender workspaces (TFV/onboarding default). */
export const MCTB_PLATFORM_SENDER_RECOVERY_OPENER = DEFAULT_ONBOARDING_MESSAGE;

function parseHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inBusinessWindow(config: MissedCallTextConfigRecord, now = new Date()): boolean {
  if (!config.allowedStartTime || !config.allowedEndTime) return true;
  const start = parseHm(config.allowedStartTime);
  const end = parseHm(config.allowedEndTime);
  if (start == null || end == null) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const mins = hour * 60 + minute;
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function resolveMctbMessageTemplate(
  config: MissedCallTextConfigRecord & {
    messageTemplateBusinessHours?: string | null;
    messageTemplateAfterHours?: string | null;
  },
  now = new Date(),
): string {
  const inHours = inBusinessWindow(config, now);
  if (inHours && config.messageTemplateBusinessHours?.trim()) {
    return config.messageTemplateBusinessHours.trim();
  }
  if (!inHours && config.messageTemplateAfterHours?.trim()) {
    return config.messageTemplateAfterHours.trim();
  }
  return config.messageTemplate;
}

/** Recovery SMS opener — platform sender ignores workspace-custom copy. */
export function resolveMctbRecoveryOpenerTemplate(
  config: MissedCallTextConfigRecord & {
    messageTemplateBusinessHours?: string | null;
    messageTemplateAfterHours?: string | null;
  },
  now = new Date(),
): string {
  if (config.senderMode === "PLATFORM") {
    return MCTB_PLATFORM_SENDER_RECOVERY_OPENER;
  }
  return resolveMctbMessageTemplate(config, now);
}

export function renderMctbMessageTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
    out = out.replace(new RegExp(`\\{\\{\\s*customer\\.${key}\\s*\\}\\}`, "gi"), val);
  }
  return out.trim();
}
