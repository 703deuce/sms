export type SavedReply = {
  id: string;
  name: string;
  category: string;
  body: string;
  tags: string[];
  shared: boolean;
  createdBy: string;
  updatedAt: string;
};

export const replyCategories = [
  "Scheduling",
  "Estimates",
  "Reminders",
  "Follow-up",
  "Payments",
  "General",
];

export const savedReplies: SavedReply[] = [
  {
    id: "sr-1",
    name: "Confirm appointment",
    category: "Scheduling",
    body: "Hi {{first_name}}, you're all set for {{appointment_date}} at {{appointment_time}}. Reply YES to confirm, or let us know if you need to reschedule.",
    tags: ["confirmation", "booking"],
    shared: true,
    createdBy: "Sarah Kim",
    updatedAt: "Sep 2",
  },
  {
    id: "sr-2",
    name: "Reschedule link",
    category: "Scheduling",
    body: "No problem — you can manage your appointment here: {{manage_link}}. If nothing works, just reply and we'll find something together.",
    tags: ["reschedule"],
    shared: true,
    createdBy: "Sarah Kim",
    updatedAt: "Aug 28",
  },
  {
    id: "sr-3",
    name: "Estimate follow-up",
    category: "Estimates",
    body: "Hi {{first_name}}, just checking in on the estimate we sent over. Happy to answer any questions or adjust the scope — what works best for you?",
    tags: ["estimate", "follow-up"],
    shared: true,
    createdBy: "Marcus Lee",
    updatedAt: "Aug 25",
  },
  {
    id: "sr-4",
    name: "Running late",
    category: "Reminders",
    body: "Hi {{first_name}}, we're running about 15 minutes behind today. Sorry for the delay — we'll text you as soon as we're on the way.",
    tags: ["delay", "heads-up"],
    shared: true,
    createdBy: "Marcus Lee",
    updatedAt: "Aug 20",
  },
  {
    id: "sr-5",
    name: "Post-appointment thank you",
    category: "Follow-up",
    body: "Thanks for coming in today, {{first_name}}! If anything comes up before your next visit, just reply here — we're happy to help.",
    tags: ["thank-you"],
    shared: true,
    createdBy: "You",
    updatedAt: "Aug 18",
  },
  {
    id: "sr-6",
    name: "Payment received",
    category: "Payments",
    body: "Hi {{first_name}}, we've received your payment — thank you! A receipt is on its way to your email.",
    tags: ["payment", "receipt"],
    shared: false,
    createdBy: "You",
    updatedAt: "Aug 14",
  },
  {
    id: "sr-7",
    name: "After-hours response",
    category: "General",
    body: "Hi {{first_name}}, thanks for your message! We're currently outside business hours but will get back to you first thing in the morning.",
    tags: ["after-hours"],
    shared: true,
    createdBy: "Sarah Kim",
    updatedAt: "Aug 9",
  },
  {
    id: "sr-8",
    name: "No-show check-in",
    category: "Follow-up",
    body: "Hi {{first_name}}, we missed you at your appointment today. Everything okay? Reply here and we'll help you rebook at a better time.",
    tags: ["no-show", "rebook"],
    shared: false,
    createdBy: "You",
    updatedAt: "Aug 5",
  },
];
