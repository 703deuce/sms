export type FaxTier = "starter" | "business" | "pro";

export type FaxTransmissionStatus =
  | "queued"
  | "media_processed"
  | "sending"
  | "delivered"
  | "failed"
  | "received"
  | "scheduled"
  | "cancelled";

export type FaxDirection = "inbound" | "outbound";

export type FaxIntelligenceStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partially_completed"
  | "failed";

export const FAX_TIER_PAGES: Record<FaxTier, number> = {
  starter: 200,
  business: 500,
  pro: 1000,
};

export const FAX_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const FAX_MAX_PAGES = 350;

export type TelnyxFaxPayload = {
  id: string;
  record_type?: string;
  direction?: string;
  status?: string;
  from?: string;
  to?: string;
  media_url?: string;
  page_count?: number;
  failure_reason?: string;
  connection_id?: string;
};
