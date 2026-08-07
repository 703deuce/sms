import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig, updateMissedCallTextConfig } from "../config";
import type { MissedCallTextSettingsUpdate } from "../types";

export const JOHN_ADMIN_TOOLS = [
  "get_missed_call_text_settings",
  "update_missed_call_text_settings",
  "get_missed_call_text_status",
  "search_missed_calls",
  "get_missed_call_details",
  "explain_missed_call_text_failure",
  "get_missed_call_text_metrics",
] as const;

export type JohnAdminToolName = (typeof JOHN_ADMIN_TOOLS)[number];

export async function executeJohnAdminTool(input: {
  workspaceId: string;
  tool: JohnAdminToolName;
  args: Record<string, unknown>;
  actor?: string;
  naturalLanguage?: string;
  toolCallId?: string;
}) {
  switch (input.tool) {
    case "get_missed_call_text_settings": {
      const config = await loadMissedCallTextConfig(input.workspaceId);
      return { ok: true, settings: config };
    }
    case "update_missed_call_text_settings": {
      const patch = input.args as MissedCallTextSettingsUpdate;
      const result = await updateMissedCallTextConfig({
        workspaceId: input.workspaceId,
        patch,
        actor: input.actor,
        requestedNaturalLanguage: input.naturalLanguage,
        toolCallId: input.toolCallId,
      });
      return result;
    }
    case "get_missed_call_text_status": {
      const config = await loadMissedCallTextConfig(input.workspaceId);
      return {
        ok: true,
        enabled: config.enabled,
        delay_seconds: config.delaySeconds,
        phone_number_id: config.phoneNumberId,
      };
    }
    case "search_missed_calls": {
      const prisma = getPrisma();
      const phone = input.args.phone ? String(input.args.phone) : undefined;
      const since = input.args.since ? new Date(String(input.args.since)) : undefined;
      const until = input.args.until ? new Date(String(input.args.until)) : undefined;
      const rows = await prisma.missedCallEvent.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(phone ? { callerE164: { contains: phone.replace(/\D/g, "").slice(-10) } } : {}),
          ...(since || until
            ? {
                detectedAt: {
                  ...(since ? { gte: since } : {}),
                  ...(until ? { lte: until } : {}),
                },
              }
            : {}),
        },
        orderBy: { detectedAt: "desc" },
        take: Math.min(25, Number(input.args.limit) || 10),
      });
      return { ok: true, results: rows };
    }
    case "get_missed_call_details": {
      const prisma = getPrisma();
      const id = String(input.args.missed_call_event_id || input.args.id || "");
      const row = await prisma.missedCallEvent.findFirst({
        where: { id, workspaceId: input.workspaceId },
      });
      if (!row) return { ok: false, error: "not_found" };
      const traces = await prisma.missedCallTextTrace.findMany({
        where: { missedCallEventId: row.id },
        orderBy: { createdAt: "asc" },
      });
      return { ok: true, event: row, traces };
    }
    case "explain_missed_call_text_failure": {
      const prisma = getPrisma();
      const id = String(input.args.missed_call_event_id || input.args.id || "");
      const row = await prisma.missedCallEvent.findFirst({
        where: { id, workspaceId: input.workspaceId },
      });
      if (!row) return { ok: false, error: "not_found" };
      return {
        ok: true,
        eligible: row.eligible,
        status: row.status,
        reason: row.suppressionReason,
        sms_sent_at: row.smsSentAt,
      };
    }
    case "get_missed_call_text_metrics": {
      const prisma = getPrisma();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const sent = await prisma.missedCallEvent.count({
        where: { workspaceId: input.workspaceId, smsSentAt: { gte: start } },
      });
      const missed = await prisma.missedCallEvent.count({
        where: { workspaceId: input.workspaceId, detectedAt: { gte: start } },
      });
      return { ok: true, today: { missed, sent } };
    }
    default:
      return { ok: false, error: "unknown_tool" };
  }
}
