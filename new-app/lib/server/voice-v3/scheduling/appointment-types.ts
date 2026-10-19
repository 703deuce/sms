import "server-only";

export type AppointmentCandidate = {
  selectionId: string;
  provider: "calendly" | "microsoft" | "google";
  providerEventId: string;
  startTimeIso: string;
  endTimeIso: string;
  title: string;
  spokenLabel: string;
  attendeeEmail?: string;
  attendeePhone?: string;
};

export type FindAppointmentIdentity = {
  name?: string;
  phone?: string;
  email?: string;
  service?: string;
  inboundAni?: string;
};
