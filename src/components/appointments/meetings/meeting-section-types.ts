export type MeetingSectionId =
  | "overview"
  | "availability"
  | "hosts-method"
  | "questions"
  | "booking-rules"
  | "advanced";

export const MEETING_SECTIONS: Array<{
  id: MeetingSectionId;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Details and public booking summary" },
  { id: "availability", label: "Availability", description: "Schedule and booking window" },
  { id: "hosts-method", label: "Hosts & method", description: "Who hosts and how you meet" },
  { id: "questions", label: "Questions", description: "Intake questions for bookers" },
  { id: "booking-rules", label: "Booking rules", description: "Policies and limits" },
  { id: "advanced", label: "Advanced", description: "Payment, confirmation, reminders" },
];
