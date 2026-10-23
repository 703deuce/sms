import { z } from "zod";
import type { PowerDialerWorkspaceSettings } from "@/lib/products/power-dialer";
import { normalizeDialingMode } from "./dial-modes";
import type { DialingMode, PowerDialerCampaignRules } from "./types";

const campaignRulesSchema = z.object({
  ringTimeoutSeconds: z.number().int().min(10).max(120).optional(),
  retryIntervalMinutes: z.number().int().min(0).max(10080).optional(),
  dailyAttemptCap: z.number().int().min(1).max(500).optional(),
  totalAttemptCap: z.number().int().min(1).max(50).optional(),
  postCallIntervalSeconds: z.number().int().min(0).max(300).optional(),
  requireDispositionBeforeNext: z.boolean().optional(),
  allowedDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  callingHoursStart: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  callingHoursEnd: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  phoneFieldPriority: z.array(z.string().min(1)).min(1).optional(),
  dialingMode: z
    .enum(["power", "preview", "parallel", "parallel_amd", "predictive"])
    .optional(),
  maxAttempts: z.number().int().min(1).max(50).optional(),
  retryDelayMinutes: z.number().int().min(0).optional(),
});

export type CampaignConfigPatch = z.infer<typeof campaignRulesSchema>;

export function parseCampaignConfigPatch(raw: unknown): CampaignConfigPatch {
  const parsed = campaignRulesSchema.parse(raw);
  if (parsed.retryIntervalMinutes === undefined && parsed.retryDelayMinutes !== undefined) {
    parsed.retryIntervalMinutes = parsed.retryDelayMinutes;
  }
  return parsed;
}

type CampaignRow = {
  timezone: string;
  status: string;
  ringTimeoutSeconds: number;
  retryIntervalMinutes: number;
  dailyAttemptCap: number;
  totalAttemptCap: number;
  postCallIntervalSeconds: number;
  requireDispositionBeforeNext: boolean;
  allowedDays: unknown;
  callingHoursStart: string;
  callingHoursEnd: string;
  phoneFieldPriority: unknown;
  dialingMode: string;
  configJson: unknown;
};

export function resolveCampaignRules(
  row: CampaignRow,
  workspaceDefaults?: PowerDialerWorkspaceSettings | null,
): PowerDialerCampaignRules {
  const legacy = (row.configJson || {}) as Record<string, unknown>;
  const configDialMode =
    typeof legacy.dialingMode === "string" ? legacy.dialingMode : row.dialingMode;
  const allowedRaw = row.allowedDays;
  const allowedDays = Array.isArray(allowedRaw)
    ? allowedRaw.filter((d): d is number => typeof d === "number")
    : [1, 2, 3, 4, 5];
  const phonePri = Array.isArray(row.phoneFieldPriority)
    ? (row.phoneFieldPriority as string[]).filter((x) => typeof x === "string")
    : ["phone"];

  const totalCap =
    row.totalAttemptCap ||
    (typeof legacy.maxAttempts === "number" ? legacy.maxAttempts : 3);
  const retryMin =
    row.retryIntervalMinutes ||
    (typeof legacy.retryDelayMinutes === "number" ? legacy.retryDelayMinutes : 60);

  const ws = workspaceDefaults;
  return {
    ringTimeoutSeconds:
      row.ringTimeoutSeconds || ws?.defaultRingTimeoutSec || 30,
    retryIntervalMinutes: retryMin,
    dailyAttemptCap: row.dailyAttemptCap || 50,
    totalAttemptCap: totalCap || ws?.defaultMaxAttempts || 3,
    postCallIntervalSeconds:
      row.postCallIntervalSeconds ?? ws?.defaultPostCallIntervalSec ?? 5,
    requireDispositionBeforeNext:
      row.requireDispositionBeforeNext ??
      ws?.requireDispositionBeforeNext ??
      true,
    allowedDays: allowedDays.length ? allowedDays : [1, 2, 3, 4, 5],
    callingHoursStart: row.callingHoursStart || "09:00",
    callingHoursEnd: row.callingHoursEnd || "17:00",
    phoneFieldPriority:
      phonePri.length ? phonePri : ws?.defaultPhoneFieldPriority?.length
        ? ws.defaultPhoneFieldPriority
        : ["phone"],
    dialingMode: normalizeDialingMode(configDialMode),
    timezone: row.timezone || ws?.defaultTimezone || "America/Chicago",
    status: row.status,
  };
}

export function campaignPatchToDbData(patch: CampaignConfigPatch): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (patch.ringTimeoutSeconds !== undefined) data.ringTimeoutSeconds = patch.ringTimeoutSeconds;
  if (patch.retryIntervalMinutes !== undefined) data.retryIntervalMinutes = patch.retryIntervalMinutes;
  if (patch.dailyAttemptCap !== undefined) data.dailyAttemptCap = patch.dailyAttemptCap;
  if (patch.totalAttemptCap !== undefined) data.totalAttemptCap = patch.totalAttemptCap;
  if (patch.postCallIntervalSeconds !== undefined) data.postCallIntervalSeconds = patch.postCallIntervalSeconds;
  if (patch.requireDispositionBeforeNext !== undefined)
    data.requireDispositionBeforeNext = patch.requireDispositionBeforeNext;
  if (patch.allowedDays !== undefined) data.allowedDays = patch.allowedDays;
  if (patch.callingHoursStart !== undefined) data.callingHoursStart = patch.callingHoursStart;
  if (patch.callingHoursEnd !== undefined) data.callingHoursEnd = patch.callingHoursEnd;
  if (patch.phoneFieldPriority !== undefined) data.phoneFieldPriority = patch.phoneFieldPriority;
  if (patch.dialingMode !== undefined) data.dialingMode = patch.dialingMode;
  return data;
}
