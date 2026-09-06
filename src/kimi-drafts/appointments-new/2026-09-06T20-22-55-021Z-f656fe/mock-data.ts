export type AppointmentType = { id: string; name: string; durationMinutes: number };
export type Slot = { startsAt: string; endsAt: string };

export const appointmentTypes: AppointmentType[] = [
  { id: "t1", name: "Initial Consultation", durationMinutes: 30 },
  { id: "t2", name: "Water Heater Estimate", durationMinutes: 45 },
  { id: "t3", name: "Follow-Up Visit", durationMinutes: 20 },
  { id: "t4", name: "Annual Maintenance", durationMinutes: 60 },
];

function slot(dayOffset: number, hour: number, minute: number, duration = 30): Slot {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  const e = new Date(d.getTime() + duration * 60000);
  return { startsAt: d.toISOString(), endsAt: e.toISOString() };
}

export const availabilitySlots: Slot[] = [
  slot(1, 9, 0), slot(1, 9, 30), slot(1, 10, 0), slot(1, 11, 0), slot(1, 13, 0), slot(1, 14, 30),
  slot(2, 9, 0), slot(2, 10, 30), slot(2, 11, 0), slot(2, 13, 30), slot(2, 15, 0),
  slot(3, 8, 30), slot(3, 9, 0), slot(3, 10, 0), slot(3, 14, 0), slot(3, 16, 0),
  slot(4, 9, 30), slot(4, 11, 30), slot(4, 13, 0), slot(4, 14, 0),
  slot(5, 9, 0), slot(5, 10, 0), slot(5, 15, 30),
  slot(8, 9, 0), slot(8, 10, 30), slot(8, 13, 0),
];

export const existingContacts = [
  { id: "c1", firstName: "Sarah", lastName: "Johnson", phone: "(571) 555-0142", email: "sarah.j@example.com" },
  { id: "c2", firstName: "Anthony", lastName: "Rivera", phone: "(703) 555-0198", email: "a.rivera@example.com" },
  { id: "c3", firstName: "Maria", lastName: "Chen", phone: "(202) 555-0117", email: "maria.chen@example.com" },
  { id: "c4", firstName: "James", lastName: "O'Neill", phone: "(571) 555-0173", email: "joneill@example.com" },
];

export const workspace = {
  timezone: "America/New_York",
  timezoneLabel: "Eastern Time (ET)",
  reminderSequence: "Standard Reminders",
};
