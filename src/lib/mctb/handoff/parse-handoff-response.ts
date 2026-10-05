import type { MctbHandoffConfigDto, MctbNotificationRecipientDto } from "./types";

export type MctbHandoffLaunchMeta = {
  aiRepliesEnabled?: boolean;
  urgentBusinessSmsEntitled?: boolean;
  businessReplySmsEntitled?: boolean;
};

export type MctbHandoffPayload = {
  config: MctbHandoffConfigDto | null;
  recipients: MctbNotificationRecipientDto[];
  launch?: MctbHandoffLaunchMeta;
};

/** Normalize GET/POST /api/mctb/handoff JSON (supports `{ data: … }` or flat legacy). */
export function parseMctbHandoffResponse(json: unknown): MctbHandoffPayload {
  const root = json as { data?: Partial<MctbHandoffPayload> } & Partial<MctbHandoffPayload>;
  const data = root.data ?? root;
  const recipients = Array.isArray(data.recipients) ? data.recipients : [];
  const config =
    data.config && typeof data.config === "object" ? (data.config as MctbHandoffConfigDto) : null;
  const launch =
    data.launch && typeof data.launch === "object"
      ? (data.launch as MctbHandoffLaunchMeta)
      : undefined;
  return { config, recipients, launch };
}
