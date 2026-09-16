export type VoiceV2TimeWindow = {
  start: string;
  end: string;
};

export type VoiceV2FindAvailabilityInput = {
  workspaceId: string;
  callId?: string | null;
  requestedDate: string;
  timeWindow: VoiceV2TimeWindow;
  /** Optional — defaults from workspace booking config */
  serviceName?: string | null;
  maxSlots?: number;
};

export type VoiceV2Slot = {
  slot_id: string;
  label: string;
  /** Spoken to caller; may match label */
  spoken_label?: string;
  start_utc: string;
  end_utc: string;
  /** Provider dispatch for BOOK — not exposed to the model */
  provider?: "microsoft" | "calendly";
  provider_metadata?: {
    event_type_uri?: string;
    calendly_start_time?: string;
  };
};

export type VoiceV2TimingMarks = {
  REQUEST_RECEIVED: string;
  INPUT_VALIDATED?: string;
  WORKSPACE_RESOLVED?: string;
  MICROSOFT_CONNECTION_RESOLVED?: string;
  TOKEN_STARTED?: string;
  TOKEN_COMPLETE?: string;
  GRAPH_STARTED?: string;
  GRAPH_COMPLETE?: string;
  AVAILABILITY_COMPUTE_STARTED?: string;
  AVAILABILITY_COMPUTE_COMPLETE?: string;
  RESPONSE_SENT?: string;
};

export type VoiceV2TimingMs = {
  VALIDATION_MS: number;
  WORKSPACE_RESOLUTION_MS: number;
  CONNECTION_RESOLUTION_MS: number;
  TOKEN_MS: number;
  GRAPH_MS: number;
  AVAILABILITY_COMPUTE_MS: number;
  TOTAL_MS: number;
};

export type VoiceV2FindAvailabilityResult =
  | {
      status: "AVAILABILITY_FOUND";
      offer_set_id: string;
      slots: VoiceV2Slot[];
      timing: VoiceV2TimingMarks;
      timing_ms: VoiceV2TimingMs;
      graph: {
        GRAPH_REQUEST_COUNT: number;
        GRAPH_HTTP_STATUS: number;
        TOKEN_REFRESH_REQUIRED: boolean;
      };
    }
  | {
      status: "NO_AVAILABILITY";
      slots: [];
      timing: VoiceV2TimingMarks;
      timing_ms: VoiceV2TimingMs;
      graph: {
        GRAPH_REQUEST_COUNT: number;
        GRAPH_HTTP_STATUS: number;
        TOKEN_REFRESH_REQUIRED: boolean;
      };
    }
  | {
      status: "ERROR";
      error: string;
      timing: VoiceV2TimingMarks;
      timing_ms: VoiceV2TimingMs;
      graph?: {
        GRAPH_REQUEST_COUNT: number;
        GRAPH_HTTP_STATUS: number;
        TOKEN_REFRESH_REQUIRED: boolean;
      };
    };
