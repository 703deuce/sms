export const initialConfig = {
  enabled: true,
  graceMinutes: 30,
  autoInstallWorkflow: true,
  notifyTeam: true,
  followUpChannel: "sms" as "sms" | "sms_email",
};

export const initialStats = {
  noShowsLast30Days: 12,
  recoveredBookings: 5,
  workflowInstalled: false,
  lastScanAt: "Today, 9:12 AM EDT",
};

export type NoShowRow = {
  id: string;
  customer: string;
  bookingType: string;
  scheduledFor: string;
  status: "Recovery sent" | "Replied" | "Rebooked" | "No response";
};

export const recentNoShows: NoShowRow[] = [
  { id: "1", customer: "Sarah Johnson", bookingType: "Water Heater Estimate", scheduledFor: "Sep 12 · 2:00 PM", status: "Rebooked" },
  { id: "2", customer: "Marcus Lee", bookingType: "Initial Consultation", scheduledFor: "Sep 11 · 10:30 AM", status: "Recovery sent" },
  { id: "3", customer: "Priya Nair", bookingType: "Follow-up Visit", scheduledFor: "Sep 10 · 4:00 PM", status: "Replied" },
  { id: "4", customer: "Daniel Ortiz", bookingType: "Site Inspection", scheduledFor: "Sep 9 · 1:00 PM", status: "No response" },
  { id: "5", customer: "Emily Chen", bookingType: "Initial Consultation", scheduledFor: "Sep 8 · 9:30 AM", status: "Rebooked" },
];

export const workflowTemplate = {
  name: "No-Show Recovery",
  trigger: "Appointment marked as no-show",
  steps: [
    { timing: "15 minutes after no-show", action: "Send SMS to customer", preview: "Hi {{first_name}}, we missed you at your {{service}} today. Pick a new time: {{manage_link}}" },
    { timing: "24 hours later (if no reply)", action: "Send SMS follow-up", preview: "Still happy to get you rebooked, {{first_name}} — manage your appointment here: {{manage_link}}" },
    { timing: "If customer rebooks", action: "Stop workflow + confirm booking", preview: "Automatic — workflow ends when the customer books a new appointment." },
  ],
};

// Permission mock — flip to false to preview the read-only state
export const permissions = {
  canManageNoShowRecovery: true,
};
