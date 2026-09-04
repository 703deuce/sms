export interface Reminder {
  id: string;
  index: number;
  icon: 'calendar' | 'clock' | 'message';
  title: string;
  badge: string;
  description: string;
  template: string;
  preview: string;
  characters: number;
  segments: number;
  enabled: boolean;
}

export const mergeTags = [
  '{{first_name}}',
  '{{last_name}}',
  '{{service}}',
  '{{appointment_date}}',
  '{{appointment_time}}',
  '{{business_name}}',
  '{{reschedule_link}}',
  '{{cancel_link}}',
];

export const reminderOptions = [
  'Booking confirmation',
  '24-hour reminder',
  '2-hour reminder',
  '1-hour reminder',
];

export const initialReminders: Reminder[] = [
  {
    id: 'booking-confirmation',
    index: 1,
    icon: 'calendar',
    title: 'Booking confirmation',
    badge: 'At booking',
    description: 'Sent immediately when a customer books online.',
    template:
      'Hi {{first_name}}, your {{service}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}} • • Cancel: {{cancel_link}}',
    preview:
      'Hi Alex, your Consultation with Mass Texting Browser Cert is confirmed for Saturday, Aug 30 at 9:00 AM. Reply YES to confirm. Reschedule: /appointments/reschedule/abc123 • Cancel: /appointments/cancel/abc123',
    characters: 199,
    segments: 2,
    enabled: true,
  },
  {
    id: '24-hour',
    index: 2,
    icon: 'clock',
    title: '24-hour reminder',
    badge: '24h before',
    description: 'Sent the day before the appointment.',
    template:
      'Reminder: {{service}} with {{business_name}} tomorrow at {{appointment_time}}. Reply YES to confirm. Reschedule: {{reschedule_link}} • • Cancel: {{cancel_link}}',
    preview:
      'Reminder: Consultation with Mass Texting Browser Cert tomorrow at 9:00 AM. Reply YES to confirm. Reschedule: /appointments/reschedule/abc123 • Cancel: /appointments/cancel/abc123',
    characters: 132,
    segments: 1,
    enabled: true,
  },
  {
    id: '2-hour',
    index: 3,
    icon: 'message',
    title: '2-hour reminder',
    badge: '2h before',
    description: 'Sent shortly before the appointment.',
    template:
      'Reminder: {{service}} with {{business_name}} today at {{appointment_time}}. See you soon!',
    preview:
      'Reminder: Consultation with Mass Texting Browser Cert today at 9:00 AM. See you soon!',
    characters: 89,
    segments: 1,
    enabled: true,
  },
];
