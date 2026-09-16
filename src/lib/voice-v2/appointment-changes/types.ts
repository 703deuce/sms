import "server-only";

export type AppointmentChangeProvider = "microsoft" | "calendly";

export type ExistingAppointmentRef = {
  refId: string;
  provider: AppointmentChangeProvider;
  providerEventId: string;
  connectionId: string;
  timezone: string;
  startsAtUtc: string;
  endsAtUtc: string;
  serviceName?: string;
  voiceAppointmentId?: string;
  /** occurrence | single | seriesMaster — conservative handling for recurring */
  eventKind?: "single" | "occurrence" | "seriesMaster";
  spokenLabel: string;
};

export type FindExistingAppointmentMatch = {
  ref: ExistingAppointmentRef;
  score: number;
};

export type FindExistingAppointmentResult =
  | { status: "FOUND_ONE"; appointment_ref_id: string; spoken_label: string }
  | {
      status: "MULTIPLE";
      choices: Array<{ appointment_ref_id: string; spoken_label: string }>;
    }
  | { status: "NONE"; message: string }
  | { status: "ERROR"; error: string };

export type RescheduleAppointmentResult =
  | {
      status: "RESCHEDULE_CONFIRMED";
      appointment_ref_id: string;
      event_id: string;
      spoken_confirmation: string;
    }
  | { status: "SLOT_UNAVAILABLE" | "INVALID_OFFER" | "INVALID_REF" | "ERROR"; error: string };

export type CancelAppointmentResult =
  | { status: "CANCEL_CONFIRMED"; appointment_ref_id: string; spoken_confirmation: string }
  | { status: "INVALID_REF" | "NOT_ALLOWED" | "ERROR"; error: string };
