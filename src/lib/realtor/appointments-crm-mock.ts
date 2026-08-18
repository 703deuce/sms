/** Fixture data for Appointments CRM pages matching product mockups. */

export type AppointmentType =
  | "consultation"
  | "showing"
  | "follow-up"
  | "presentation"
  | "review"
  | "meeting";

export type CalendarEvent = {
  id: string;
  title: string;
  contact: string;
  /** Day index within week: 0 = Sunday */
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  color: string;
  borderColor: string;
  type: AppointmentType;
};

export const CALENDAR_WEEK_START = new Date(2025, 4, 18);

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Property Consultation", contact: "James Carter", dayIndex: 1, startMinutes: 9 * 60, endMinutes: 10 * 60, color: "bg-blue-100", borderColor: "border-l-blue-500", type: "consultation" },
  { id: "e2", title: "Buyer Consultation", contact: "Emily White", dayIndex: 1, startMinutes: 11 * 60, endMinutes: 12 * 60, color: "bg-purple-100", borderColor: "border-l-purple-500", type: "consultation" },
  { id: "e3", title: "Property Showing", contact: "Mark Thompson", dayIndex: 2, startMinutes: 10 * 60, endMinutes: 11 * 60 + 30, color: "bg-blue-100", borderColor: "border-l-blue-500", type: "showing" },
  { id: "e4", title: "Listing Presentation", contact: "Michael Brown", dayIndex: 2, startMinutes: 14 * 60, endMinutes: 15 * 60 + 30, color: "bg-emerald-100", borderColor: "border-l-emerald-500", type: "presentation" },
  { id: "e5", title: "Follow Up Call", contact: "Sarah Martinez", dayIndex: 3, startMinutes: 9 * 60 + 30, endMinutes: 10 * 60, color: "bg-orange-100", borderColor: "border-l-orange-500", type: "follow-up" },
  { id: "e6", title: "Home Tour", contact: "Jennifer Smith", dayIndex: 3, startMinutes: 13 * 60, endMinutes: 14 * 60 + 30, color: "bg-emerald-100", borderColor: "border-l-emerald-500", type: "showing" },
  { id: "e7", title: "Team Meeting", contact: "Internal", dayIndex: 4, startMinutes: 10 * 60, endMinutes: 11 * 60, color: "bg-orange-100", borderColor: "border-l-orange-500", type: "meeting" },
  { id: "e8", title: "Contract Review", contact: "David Wilson", dayIndex: 4, startMinutes: 15 * 60, endMinutes: 16 * 60, color: "bg-purple-100", borderColor: "border-l-purple-500", type: "review" },
  { id: "e9", title: "Open House Prep", contact: "Lisa Anderson", dayIndex: 5, startMinutes: 11 * 60, endMinutes: 12 * 60 + 30, color: "bg-blue-100", borderColor: "border-l-blue-500", type: "showing" },
];

export const CALENDAR_STATS = {
  appointments: 32,
  confirmed: 28,
  confirmedPct: 87,
  avgDuration: "4.6 hrs",
  clients: 18,
  growth: "12%",
};

export const TODAY_AGENDA = [
  { time: "9:00 AM", title: "Property Consultation", contact: "James Carter", icon: "user" as const },
  { time: "11:00 AM", title: "Buyer Consultation", contact: "Emily White", icon: "user" as const },
  { time: "1:30 PM", title: "Follow Up Call", contact: "Sarah Martinez", icon: "phone" as const },
  { time: "3:00 PM", title: "Home Tour", contact: "Jennifer Smith", icon: "home" as const },
  { time: "4:30 PM", title: "Contract Review", contact: "David Wilson", icon: "file" as const },
];

export const APPOINTMENTS_KPI = {
  total: 152,
  confirmed: 128,
  confirmedPct: 84,
  upcoming: 48,
  clients: 28,
  avgDuration: "4.6 hrs",
};

export type AppointmentsTab = "all" | "upcoming" | "today" | "completed" | "canceled" | "no-show";

export const APPOINTMENTS_TAB_COUNTS: Record<AppointmentsTab, number> = {
  all: 152,
  upcoming: 48,
  today: 8,
  completed: 76,
  canceled: 12,
  "no-show": 8,
};

export const APPOINTMENTS_ROWS = [
  { id: "apt-1", date: "May 19, 2025", time: "9:00 AM", title: "Property Consultation", aptId: "#APT-10234", type: "Consultation", typeClass: "bg-purple-50 text-purple-700", client: "James Carter", phone: "(703) 555-0123", agent: "Ava Johnson", agentRole: "AI Receptionist", status: "Confirmed", statusClass: "bg-emerald-50 text-emerald-700", location: "123 Main St", source: "Phone Call", tab: "today" as AppointmentsTab },
  { id: "apt-2", date: "May 19, 2025", time: "11:00 AM", title: "Buyer Consultation", aptId: "#APT-10235", type: "Consultation", typeClass: "bg-purple-50 text-purple-700", client: "Emily White", phone: "(703) 555-0456", agent: "Michael Brown", agentRole: "AI Lead Responder", status: "Confirmed", statusClass: "bg-emerald-50 text-emerald-700", location: "Video Call | Zoom", source: "Website", tab: "today" as AppointmentsTab },
  { id: "apt-3", date: "May 18, 2025", time: "2:00 PM", title: "Follow Up Call", aptId: "#APT-10230", type: "Follow Up", typeClass: "bg-orange-50 text-orange-700", client: "Sarah Martinez", phone: "(703) 555-0789", agent: "Ava Johnson", agentRole: "AI Receptionist", status: "Completed", statusClass: "bg-blue-50 text-blue-700", location: "Phone Call", source: "Calendar", tab: "completed" as AppointmentsTab },
  { id: "apt-4", date: "May 20, 2025", time: "10:00 AM", title: "Property Showing", aptId: "#APT-10240", type: "Showing", typeClass: "bg-blue-50 text-blue-700", client: "Mark Thompson", phone: "(703) 555-0321", agent: "Michael Brown", agentRole: "AI Lead Responder", status: "Pending", statusClass: "bg-amber-50 text-amber-700", location: "456 Oak Ave", source: "Website", tab: "upcoming" as AppointmentsTab },
  { id: "apt-5", date: "May 17, 2025", time: "3:30 PM", title: "Listing Presentation", aptId: "#APT-10225", type: "Presentation", typeClass: "bg-emerald-50 text-emerald-700", client: "Michael Brown", phone: "(703) 555-0654", agent: "Ava Johnson", agentRole: "AI Receptionist", status: "Canceled", statusClass: "bg-red-50 text-red-700", location: "789 Pine Rd", source: "Phone Call", tab: "canceled" as AppointmentsTab },
  { id: "apt-6", date: "May 16, 2025", time: "1:00 PM", title: "Contract Review", aptId: "#APT-10220", type: "Review", typeClass: "bg-violet-50 text-violet-700", client: "David Wilson", phone: "(703) 555-0987", agent: "Michael Brown", agentRole: "AI Lead Responder", status: "No Show", statusClass: "bg-gray-100 text-gray-700", location: "Office", source: "Calendar", tab: "no-show" as AppointmentsTab },
];

export const APPOINTMENT_TYPES_KPI = {
  activeTypes: 7,
  avgDuration: "4.6 hrs",
  bookingRate: "82%",
  clientRating: "4.8",
};

export const APPOINTMENT_TYPES_ROWS = [
  { id: "t1", name: "Property Consultation", description: "Initial consultation to discuss needs and goals", duration: "60 min", buffer: "15 min Before & After", price: "Free", agents: ["AJ", "MB"], active: true, slug: "/book/consultation", category: "consultation" },
  { id: "t2", name: "Home Tour", description: "Guided tour of a listed property", duration: "90 min", buffer: "15 min Before & After", price: "Free", agents: ["AJ", "DW"], active: true, slug: "/book/tour", category: "showing" },
  { id: "t3", name: "Investment Consultation", description: "Discuss investment property opportunities", duration: "60 min", buffer: "15 min Before & After", price: "Free", agents: ["MB"], active: false, slug: "/book/investment", category: "consultation" },
  { id: "t4", name: "Listing Presentation", description: "Present marketing plan for your property", duration: "90 min", buffer: "15 min Before & After", price: "Free", agents: ["AJ", "MB", "DW"], active: true, slug: "/book/listing", category: "presentation" },
  { id: "t5", name: "Follow Up Call", description: "Quick check-in with prospective buyers", duration: "30 min", buffer: "10 min Before & After", price: "Free", agents: ["AJ"], active: true, slug: "/book/followup", category: "follow-up" },
  { id: "t6", name: "Contract Review", description: "Review and discuss contract terms", duration: "45 min", buffer: "10 min Before & After", price: "$150", agents: ["MB", "DW"], active: true, slug: "/book/contract", category: "review" },
  { id: "t7", name: "Open House", description: "Host an open house event", duration: "120 min", buffer: "30 min Before & After", price: "Free", agents: ["AJ", "DW"], active: true, slug: "/book/openhouse", category: "showing" },
];

export const CONNECTIONS_KPI = {
  total: 8,
  active: 6,
  expiring: 1,
  errors: 1,
};

export const CONNECTIONS_ROWS = [
  { id: "c1", name: "Google Calendar", description: "Sync appointments with Google Calendar", category: "Calendars", categoryClass: "bg-purple-50 text-purple-700", connectedTo: "sarah@blueridgerealty.com", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "2 min ago", icon: "google" },
  { id: "c2", name: "Calendly", description: "Online scheduling and booking", category: "Calendars", categoryClass: "bg-purple-50 text-purple-700", connectedTo: "blueridge-realty", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "5 min ago", icon: "calendly" },
  { id: "c3", name: "GoHighLevel", description: "CRM and marketing automation", category: "CRM", categoryClass: "bg-emerald-50 text-emerald-700", connectedTo: "Blue Ridge Realty", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "12 min ago", icon: "ghl" },
  { id: "c4", name: "HubSpot", description: "Customer relationship management", category: "CRM", categoryClass: "bg-emerald-50 text-emerald-700", connectedTo: "Blue Ridge Realty", status: "Expiring Soon", statusClass: "bg-amber-50 text-amber-700", lastSync: "1 hr ago", icon: "hubspot" },
  { id: "c5", name: "Twilio", description: "Voice and SMS communications", category: "Phone", categoryClass: "bg-blue-50 text-blue-700", connectedTo: "(571) 555-0198", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "Just now", icon: "twilio" },
  { id: "c6", name: "Telnyx", description: "Voice AI and telephony", category: "Phone", categoryClass: "bg-blue-50 text-blue-700", connectedTo: "(571) 555-0198", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "Just now", icon: "telnyx" },
  { id: "c7", name: "Slack", description: "Team notifications and alerts", category: "Messaging", categoryClass: "bg-orange-50 text-orange-700", connectedTo: "#appointments", status: "Active", statusClass: "bg-emerald-50 text-emerald-700", lastSync: "8 min ago", icon: "slack" },
  { id: "c8", name: "Gmail", description: "Email notifications and confirmations", category: "Messaging", categoryClass: "bg-orange-50 text-orange-700", connectedTo: "sarah@blueridgerealty.com", status: "Error", statusClass: "bg-red-50 text-red-700", lastSync: "Failed", icon: "gmail" },
];

export const AVAILABILITY_KPI = {
  totalHours: 42,
  activeSchedules: 5,
  timezone: "America/New_York (GMT-04:00)",
  afterHours: "Enabled",
};

export const AVAILABILITY_AGENTS = [
  { name: "AI Front Desk", status: "Following this schedule" },
  { name: "Missed Call Text Back", status: "Following this schedule" },
  { name: "Speed-to-Lead", status: "Following this schedule" },
];

export const WEEKLY_BLOCKS = [
  { dayIndex: 0, label: "Unavailable", type: "unavailable" as const },
  { dayIndex: 1, startMinutes: 9 * 60, endMinutes: 17 * 60, type: "available" as const },
  { dayIndex: 1, startMinutes: 18 * 60, endMinutes: 20 * 60, type: "after-hours" as const },
  { dayIndex: 2, startMinutes: 9 * 60, endMinutes: 12 * 60, type: "available" as const },
  { dayIndex: 2, startMinutes: 12 * 60, endMinutes: 13 * 60, type: "break" as const, label: "Lunch Break" },
  { dayIndex: 2, startMinutes: 13 * 60, endMinutes: 17 * 60, type: "available" as const },
  { dayIndex: 2, startMinutes: 18 * 60, endMinutes: 20 * 60, type: "after-hours" as const },
  { dayIndex: 3, startMinutes: 9 * 60, endMinutes: 17 * 60, type: "available" as const },
  { dayIndex: 3, startMinutes: 18 * 60, endMinutes: 20 * 60, type: "after-hours" as const },
  { dayIndex: 4, startMinutes: 9 * 60, endMinutes: 17 * 60, type: "available" as const },
  { dayIndex: 4, startMinutes: 18 * 60, endMinutes: 20 * 60, type: "after-hours" as const },
  { dayIndex: 5, startMinutes: 9 * 60, endMinutes: 17 * 60, type: "available" as const },
  { dayIndex: 5, startMinutes: 18 * 60, endMinutes: 20 * 60, type: "after-hours" as const },
  { dayIndex: 6, label: "Unavailable", type: "unavailable" as const },
];
