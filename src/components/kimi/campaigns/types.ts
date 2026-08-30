/** Shape from Kimi session 2026-08-30T21-40-34-537Z-32b6ff mock-data.ts */
export interface KimiCampaign {
  id: string;
  name: string;
  savedAt: string;
  recipients: string;
  audience: string;
  hasReply: boolean;
  clicks: number | null;
  unsubs: number | null;
  revenue: string | null;
  status: "Draft" | "Sent";
}

/** API shape from GET /api/mass-texting/campaigns/:id/launch-review */
export interface KimiLaunchReview {
  campaignId: string;
  campaignName: string;
  listNames: string[];
  finalRecipientCount: number;
  availableSegments: number;
  requiredSegments: number;
  canSend: boolean;
  blockReason: string | null;
}

export interface KimiReviewSummary {
  audience: string[];
  count: string;
  timing: string;
  creditsAvailable: string;
  creditsRequired: string;
  creditsRemaining: string;
  canSend?: boolean;
  blockReason?: string | null;
}

/** Snapshot passed from Kimi CreateCampaign → API wiring layer. */
export interface KimiComposeSnapshot {
  name: string;
  message: string;
  chips: string[];
  when: string;
  recurringSummary: string | null;
}
