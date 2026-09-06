export interface RecallStat {
  label: string;
  value: string;
  hint: string;
}

export const RECALL_STATS: RecallStat[] = [
  { label: "Customers without a future appointment", value: "128", hint: "Eligible for recall outreach" },
  { label: "No-shows this month", value: "14", hint: "Recovery follow-ups sent for 11" },
  { label: "Rebooked via recall", value: "23", hint: "Last 30 days" },
  { label: "Recall response rate", value: "18.2%", hint: "Replies within 72 hours" },
];

export interface RecallActivity {
  id: string;
  type: "recall" | "no_show";
  customer: string;
  phone: string;
  detail: string;
  status: "Sent" | "Rebooked" | "Awaiting reply" | "Suppressed";
  time: string;
  channel: "SMS";
  source: string;
  note?: string;
}

export const RECALL_ACTIVITY: RecallActivity[] = [
  { id: "ra-1", type: "recall", customer: "Maria Delgado", phone: "(571) 555-0142", detail: "Recall sent — last visit 6 months ago (Dental Cleaning)", status: "Rebooked", time: "Today, 9:41 AM", channel: "SMS", source: "Recall campaign — 6-month hygiene recall", note: "Customer booked a Dental Cleaning for Sep 18 at 10:00 AM." },
  { id: "ra-2", type: "no_show", customer: "James Whitfield", phone: "(571) 555-0117", detail: "No-show follow-up sent — Water Heater Estimate, Sep 8", status: "Awaiting reply", time: "Today, 8:02 AM", channel: "SMS", source: "No-show recovery", note: "Follow-up 1 of 2. Next follow-up in 2 days if no reply." },
  { id: "ra-3", type: "recall", customer: "Priya Raman", phone: "(571) 555-0168", detail: "Recall sent — no future appointment, last visit May 12", status: "Sent", time: "Yesterday, 4:18 PM", channel: "SMS", source: "Recall campaign — Annual Checkup", note: "Delivered. No reply yet." },
  { id: "ra-4", type: "no_show", customer: "Tom Becker", phone: "(571) 555-0133", detail: "No-show follow-up suppressed — customer opted out of SMS", status: "Suppressed", time: "Yesterday, 2:37 PM", channel: "SMS", source: "No-show recovery", note: "Suppressed — customer opted out of SMS on Aug 30. No further texts will be sent." },
  { id: "ra-5", type: "recall", customer: "Alina Petrova", phone: "(571) 555-0194", detail: "Recall sent — Annual Checkup due by booking type rule", status: "Rebooked", time: "Sep 8, 11:05 AM", channel: "SMS", source: "Recall campaign — Annual Checkup", note: "Customer rebooked online for Sep 22 at 9:30 AM." },
  { id: "ra-6", type: "recall", customer: "Derek Nguyen", phone: "(571) 555-0171", detail: "Recall sent — last visit 4 months ago (Consultation)", status: "Awaiting reply", time: "Sep 8, 9:26 AM", channel: "SMS", source: "Recall campaign — 90-day consultation recall", note: "Reminder 1 of 2. Next reminder in 5 days if no reply." },
];
