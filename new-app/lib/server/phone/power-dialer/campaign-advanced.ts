import { z } from "zod";

const breakSchema = z.object({
  startHm: z.string().regex(/^\d{1,2}:\d{2}$/),
  endHm: z.string().regex(/^\d{1,2}:\d{2}$/),
});

export const campaignAdvancedSchema = z.object({
  scheduleBreaks: z.array(breakSchema).optional(),
  retryScheduleMinutes: z.array(z.number().int().min(0)).optional(),
  dialOrder: z.enum(["fifo", "lifo", "priority"]).optional(),
  standbyListIds: z.array(z.string()).optional(),
  teamQueueMode: z.enum(["shared", "round_robin", "pull", "dynamic"]).optional(),
  jurisdictionPreset: z.enum(["none", "us_ftc_consumer", "custom"]).optional(),
  customLegalStart: z.string().optional(),
  customLegalEnd: z.string().optional(),
  callbackExemptFromRetryDelay: z.boolean().optional(),
  allowedAreaCodes: z.array(z.string()).optional(),
  blockedAreaCodes: z.array(z.string()).optional(),
  leadOwnerRouting: z.enum(["off", "assigned_only", "allow_cross_rep"]).optional(),
  completionReason: z.string().optional(),
});

export type CampaignAdvanced = z.infer<typeof campaignAdvancedSchema>;

export function parseCampaignAdvanced(configJson: unknown): CampaignAdvanced {
  if (!configJson || typeof configJson !== "object") return {};
  const slice: Record<string, unknown> = {};
  const o = configJson as Record<string, unknown>;
  for (const key of Object.keys(campaignAdvancedSchema.shape)) {
    if (o[key] !== undefined) slice[key] = o[key];
  }
  return campaignAdvancedSchema.parse(slice);
}

/** M22 — retry delay for attempt index (0 = after first completed attempt). */
export function retryDelayMinutesForAttempt(
  advanced: CampaignAdvanced,
  fallbackMinutes: number,
  completedAttempts: number,
): number {
  const schedule = advanced.retryScheduleMinutes;
  if (schedule?.length) {
    const idx = Math.min(completedAttempts, schedule.length - 1);
    return schedule[idx] ?? fallbackMinutes;
  }
  return fallbackMinutes;
}
