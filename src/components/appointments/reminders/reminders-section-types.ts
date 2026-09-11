import type { RemindersSectionId } from "@/features/appointments/kimi/reminders/types";

export const REMINDERS_SECTIONS: Array<{
  id: RemindersSectionId;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Sequence health and customer preview." },
  { id: "sequence", label: "Sequence", description: "Edit timing, channels, and messages." },
  { id: "assignment", label: "Assignment", description: "Which offerings use this sequence." },
  { id: "templates", label: "Templates", description: "Message bodies and merge fields." },
  { id: "activity", label: "Activity", description: "Sent, scheduled, failed, and skipped." },
  { id: "settings", label: "Settings", description: "Timezone and messaging links." },
];
