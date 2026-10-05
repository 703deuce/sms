import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { readMctbFirstTextTemplateConfigFromMctbFields } from "@/lib/mctb/first-text-templates/config-defaults";
import { renderMctbFirstTextTemplateBody } from "@/lib/mctb/first-text-templates/render";
import { getMctbFirstTextTemplate } from "@/lib/mctb/first-text-templates/registry";

export const MCTB_PLATFORM_SENDER_RECOVERY_OPENER = getMctbFirstTextTemplate("simple").body;

function parseHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function inMctbBusinessWindow(config: MissedCallTextConfigRecord, now = new Date()): boolean {
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
  const inHours = inMctbBusinessWindow(config, now);
  if (inHours && config.messageTemplateBusinessHours?.trim()) {
    return config.messageTemplateBusinessHours.trim();
  }
  if (!inHours && config.messageTemplateAfterHours?.trim()) {
    return config.messageTemplateAfterHours.trim();
  }
  return config.messageTemplate;
}

/** Recovery SMS opener — platform sender uses approved template registry (not arbitrary workspace copy). */
export function resolveMctbRecoveryOpenerTemplate(
  config: MissedCallTextConfigRecord & {
    messageTemplateBusinessHours?: string | null;
    messageTemplateAfterHours?: string | null;
    platformRecoveryTemplateId?: string | null;
    firstTextTemplate?: import("@/lib/mctb/first-text-templates/types").MctbFirstTextTemplateConfig;
  },
  now = new Date(),
  previewBusinessName = "Your business",
): string {
  if (config.senderMode === "PLATFORM" || config.firstTextTemplate) {
    const firstText =
      config.firstTextTemplate ||
      readMctbFirstTextTemplateConfigFromMctbFields({
        platformRecoveryTemplateId: config.platformRecoveryTemplateId,
      });
    const inHours = inMctbBusinessWindow(config, now);
    return renderMctbFirstTextTemplateBody({
      config: firstText,
      businessName: previewBusinessName,
      inBusinessHours: inHours,
    });
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
    out = out.replace(new RegExp(`\\{${key}\\}`, "gi"), val);
  }
  return out.trim();
}
