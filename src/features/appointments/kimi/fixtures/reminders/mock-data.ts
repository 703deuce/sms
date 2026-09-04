import type { ReminderItem } from "@/features/appointments/kimi/reminders/types";
import type { RemindersPageModel } from "@/features/appointments/kimi/reminders/types";

export type Reminder = ReminderItem;

export const mockRemindersPageModel: RemindersPageModel = {
  mergeTags: [
    "{{first_name}}",
    "{{last_name}}",
    "{{service}}",
    "{{appointment_date}}",
    "{{appointment_time}}",
    "{{business_name}}",
    "{{reschedule_link}}",
    "{{cancel_link}}",
  ],
  testStepOptions: [
    { key: "confirmation", label: "Booking confirmation" },
    { key: "reminder24h", label: "24-hour reminder" },
    { key: "reminder2h", label: "2-hour reminder" },
  ],
  smsSenderLabel:
    "Messages are sent via SMS from +1 (571) 407-3615. Standard message rates may apply.",
  reminders: [
    {
      id: "booking-confirmation",
      stepKey: "confirmation",
      index: 1,
      icon: "calendar",
      title: "Booking confirmation",
      badge: "At booking",
      description: "Sent immediately when a customer books online.",
      template:
        "Hi {{first_name}}, your {{service}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}} • Cancel: {{cancel_link}}",
      preview:
        "Hi Alex, your Consultation with Mass Texting Browser Cert is confirmed for Saturday, Aug 30 at 9:00 AM. Reply YES to confirm.",
      characters: 199,
      segments: 2,
      enabled: true,
    },
    {
      id: "24-hour",
      stepKey: "reminder24h",
      index: 2,
      icon: "clock",
      title: "24-hour reminder",
      badge: "24h before",
      description: "Sent the day before the appointment.",
      template:
        "Reminder: {{service}} with {{business_name}} tomorrow at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}}",
      preview:
        "Reminder: Consultation with Mass Texting Browser Cert tomorrow at 9:00 AM. Reply YES to confirm.",
      characters: 132,
      segments: 1,
      enabled: true,
    },
    {
      id: "2-hour",
      stepKey: "reminder2h",
      index: 3,
      icon: "message",
      title: "2-hour reminder",
      badge: "2h before",
      description: "Sent shortly before the appointment.",
      template:
        "Reminder: {{service}} with {{business_name}} today at {{appointment_time}}. See you soon!",
      preview:
        "Reminder: Consultation with Mass Texting Browser Cert today at 9:00 AM. See you soon!",
      characters: 89,
      segments: 1,
      enabled: true,
    },
  ],
};

export const mergeTags = mockRemindersPageModel.mergeTags;
export const reminderOptions = mockRemindersPageModel.testStepOptions.map((o) => o.label);
export const initialReminders = mockRemindersPageModel.reminders;
