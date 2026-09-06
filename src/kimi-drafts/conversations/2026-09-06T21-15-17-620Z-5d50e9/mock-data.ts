export type Message = {
  id: string;
  kind: "inbound" | "outbound" | "note" | "event" | "day";
  body: string;
  time: string;
  sender?: string;
};

export type Conversation = {
  id: string;
  contactId: string;
  name: string;
  initials: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  status: "Open" | "Pending" | "Closed";
  assignee: string | null;
  tags: string[];
  appointment?: string;
  aiActive?: boolean;
  unknownReply?: boolean;
  messages: Message[];
};

export type Teammate = { id: string; name: string; initials: string };
export type Tag = { id: string; name: string; description: string; color: string; untagOnClose: boolean };

export const TAGS: Tag[] = [
  { id: "high", name: "High Priority", description: "Time-sensitive inquiry.", color: "#ef4444", untagOnClose: false },
  { id: "la", name: "Los Angeles", description: "Conversations regarding the Los Angeles store.", color: "#84cc16", untagOnClose: false },
  { id: "miami", name: "Miami Location", description: "Conversations regarding the Miami store.", color: "#a3e635", untagOnClose: false },
  { id: "refund", name: "Refund", description: "Refund request subject matter.", color: "#6a329f", untagOnClose: true },
  { id: "shipping", name: "Shipping Issues", description: "Customer didn't receive their shipment or it arrived damaged.", color: "#f59e0b", untagOnClose: false },
];

export const TEAMMATES: Teammate[] = [
  { id: "me", name: "Me", initials: "ME" },
  { id: "sophia", name: "Sophia Grant", initials: "SG" },
  { id: "laura", name: "Laura Smith", initials: "LS" },
];

const ev = (body: string, time: string): Message => ({ id: Math.random().toString(36).slice(2), kind: "event", body, time });

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1", contactId: "ct1", name: "Patrick Dukes", initials: "PD", phone: "844-956-0195",
    preview: "Are you still available this weekend?", time: "An Hour Ago", unread: true,
    status: "Open", assignee: "Me", tags: ["High Priority", "Los Angeles"], appointment: "Consultation — Fri, Sep 12 at 2:00 PM",
    aiActive: true,
    messages: [
      { id: "m0", kind: "day", body: "Tuesday, August 27th, 2024", time: "" },
      { id: "m1", kind: "inbound", body: "Nice! I'm also a DJ so if you are looking for any more to come play a set, let me know.", time: "3:23 pm", sender: "Patrick Dukes" },
      ev("Marked As Open", "3:23 pm"),
      { id: "m2", kind: "outbound", body: "Awesome! We might need someone next week. What is your email address?", time: "3:24 pm", sender: "Me" },
      ev("Conversation Tagged as High Priority", "3:24 pm"),
      { id: "m3", kind: "inbound", body: "patrick@example.com", time: "3:24 pm", sender: "Patrick Dukes" },
      { id: "m4", kind: "outbound", body: "Sounds good. We'll be in touch!", time: "3:25 pm", sender: "Me" },
      { id: "m5", kind: "note", body: "Might need Patrick to fill in for Wade if he can't make it. I'm making sure we are covered.", time: "3:26 pm", sender: "Me" },
      { id: "m6", kind: "outbound", body: "Are you still available this weekend?", time: "3:30 pm", sender: "Me" },
    ],
  },
  {
    id: "c2", contactId: "ct2", name: "Patrick Glover", initials: "PG", phone: "866-717-6169",
    preview: "Thanks!", time: "An Hour Ago", unread: true, status: "Open", assignee: "Me", tags: ["High Priority"],
    messages: [
      { id: "m1", kind: "inbound", body: "Hey Patrick! Your estimate is ready — want me to send the booking link?", time: "8:55 am", sender: "Patrick Glover" },
      { id: "m2", kind: "outbound", body: "Yes please, send it over.", time: "8:56 am", sender: "Me" },
      { id: "m3", kind: "inbound", body: "Thanks!", time: "8:57 am", sender: "Patrick Glover" },
    ],
  },
  {
    id: "c3", contactId: "ct3", name: "Jess Patel", initials: "JP", phone: "615-630-2181",
    preview: "Yes, I'll be there tonight.", time: "A Day Ago", unread: true, status: "Open", assignee: "Me", tags: [],
    appointment: "Water Heater Estimate — Thu, Sep 11 at 5:30 PM",
    messages: [
      { id: "m1", kind: "inbound", body: "Yes, I'll be there tonight.", time: "3:57 pm", sender: "Jess Patel" },
      ev("Marked As Open", "3:57 pm"),
      ev("Conversation Assigned to Me", "3:57 pm"),
    ],
  },
  {
    id: "c4", contactId: "ct4", name: "Brandon Miller", initials: "BM", phone: "615-903-5194",
    preview: "Thanks!", time: "A Day Ago", unread: false, status: "Open", assignee: "Me", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "Thanks!", time: "3:18 pm", sender: "Brandon Miller" }],
  },
  {
    id: "c5", contactId: "ct5", name: "Jessica Davis", initials: "JD", phone: "903-563-6807",
    preview: "What are your hours for Black Friday?", time: "A Day Ago", unread: true, status: "Pending", assignee: "Me", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "What are your hours for Black Friday?", time: "3:03 pm", sender: "Jessica Davis" }],
  },
  {
    id: "c6", contactId: "ct6", name: "Ryan Brooks", initials: "RB", phone: "817-933-1330",
    preview: "Sure! Can you provide the order number that this is in reference to?", time: "A Day Ago", unread: false,
    status: "Closed", assignee: null, tags: ["Shipping Issues"],
    messages: [
      { id: "m1", kind: "inbound", body: "My shipment hasn't arrived yet. Can you check on that for me?", time: "3:00 pm", sender: "Ryan Brooks" },
      ev("Marked As Open", "3:00 pm"),
      { id: "m2", kind: "outbound", body: "Sure! Can you provide the order number that this is in reference to?", time: "4:16 pm", sender: "Me" },
      ev("Marked As Pending", "4:17 pm"),
      ev("Marked As Closed", "4:18 pm"),
      ev("Conversation Unassigned from Me", "4:18 pm"),
    ],
  },
  {
    id: "c7", contactId: "ct7", name: "Ashley Morgan", initials: "AM", phone: "615-480-0011",
    preview: "Are all the summer clearance items final sale?", time: "A Day Ago", unread: false, status: "Open", assignee: "Laura Smith", tags: [],
    messages: [
      { id: "m1", kind: "inbound", body: "Are all the summer clearance items final sale?", time: "2:59 pm", sender: "Ashley Morgan" },
      ev("Marked As Open", "2:59 pm"),
      ev("Conversation Assigned to Laura Smith", "3:00 pm"),
    ],
  },
  {
    id: "c8", contactId: "ct8", name: "David Clark", initials: "DC", phone: "615-555-0140",
    preview: "I got them yesterday. Thanks!", time: "A Day Ago", unread: false, status: "Open", assignee: "Me", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "I got them yesterday. Thanks!", time: "2:30 pm", sender: "David Clark" }],
  },
  {
    id: "c9", contactId: "ct9", name: "Megan Roberts", initials: "MR", phone: "615-555-0177",
    preview: "Oops, I meant to order a medium. Is it too late to change my order?", time: "A Day Ago", unread: true, status: "Open", assignee: "Me", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "Oops, I meant to order a medium. Is it too late to change my order?", time: "1:45 pm", sender: "Megan Roberts" }],
  },
  {
    id: "c10", contactId: "ct10", name: "Javier Lopez", initials: "JL", phone: "615-555-0199",
    preview: "It was wonderful! Thanks!", time: "A Day Ago", unread: false, status: "Closed", assignee: "Me", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "It was wonderful! Thanks!", time: "1:20 pm", sender: "Javier Lopez" }],
  },
  {
    id: "c11", contactId: "ct11", name: "Jordan Washington", initials: "JW", phone: "615-555-0123",
    preview: "Hey Dylan, thanks for reaching out. We always strive for a 5-star...", time: "A Day Ago", unread: false, status: "Open", assignee: "Sophia Grant", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "Hey Dylan, thanks for reaching out. We always strive for a 5-star experience.", time: "12:58 pm", sender: "Jordan Washington" }],
  },
  {
    id: "c12", contactId: "ct12", name: "Emily Johnson", initials: "EJ", phone: "615-796-5972",
    preview: "I'll check that out", time: "A Day Ago", unread: false, status: "Open", assignee: "Sophia Grant", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "I'll check that out", time: "12:15 pm", sender: "Emily Johnson" }],
  },
  {
    id: "c13", contactId: "ct13", name: "Isaiah Ramirez", initials: "IR", phone: "615-480-5318",
    preview: "Does this come in red?", time: "A Day Ago", unread: false, status: "Open", assignee: "Laura Smith", tags: [],
    messages: [{ id: "m1", kind: "inbound", body: "Does this come in red?", time: "11:40 am", sender: "Isaiah Ramirez" }],
  },
  {
    id: "c14", contactId: "ct14", name: "Unknown Sender", initials: "?", phone: "615-555-0241",
    preview: "STOP actually I changed my mind", time: "Two Days Ago", unread: true, status: "Open", assignee: null,
    tags: [], unknownReply: true,
    messages: [
      { id: "m1", kind: "inbound", body: "STOP actually I changed my mind", time: "9:12 am", sender: "Unknown Sender" },
      ev("Inbound reply didn't match an active booking or reminder workflow — routed to inbox for review", "9:12 am"),
    ],
  },
];

export const AI_SUGGESTIONS = [
  "Hi Patrick! Yes, we're available this weekend. Would Saturday at 2:00 PM work for your consultation?",
  "Thanks for your patience! I've confirmed your booking for Friday — you'll get a reminder 24 hours before.",
  "Good question! We can definitely reschedule. What day works best for you next week?",
];

export const AI_KNOWLEDGE = [
  "Consultation bookings require 24-hour advance notice.",
  "Reschedule link: customers can move appointments up to 2 hours before start.",
  "Weekend availability: Saturdays 9 AM – 4 PM only.",
];

export const SAVED_REPLIES = [
  { id: "sr1", name: "Appointment confirmation", body: "Hi {{first_name}}! You're confirmed for {{appointment_date}} at {{appointment_time}}. Reply RESCHEDULE if you need to move it." },
  { id: "sr2", name: "Reschedule offer", body: "No problem! What day and time works better for you? I'll update your appointment right away." },
  { id: "sr3", name: "Running late", body: "Thanks for letting us know! We'll hold your appointment for 15 minutes. See you soon." },
  { id: "sr4", name: "Business hours", body: "We're open Monday–Friday, 9 AM – 5 PM ET, and Saturdays 9 AM – 4 PM. Want me to book you a slot?" },
];
