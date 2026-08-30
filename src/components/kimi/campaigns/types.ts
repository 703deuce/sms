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

export interface KimiReviewSummary {
  audience: string[];
  count: string;
  timing: string;
  creditsAvailable: string;
  creditsRequired: string;
  creditsRemaining: string;
}
