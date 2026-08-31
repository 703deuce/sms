export type Tag = { id: string; name: string; color: string; description: string; created: string; untagOnClose: boolean };
export type Teammate = { id: string; name: string; initials: string; color: string };
export type MessageKind = "inbound" | "outbound" | "note" | "event" | "mms" | "other" | "day";
export type Message = {
  id: string; kind: MessageKind; author?: string; initials?: string; text?: string;
  time?: string; eventText?: string; image?: string; caption?: string;
};
export type Conversation = {
  id: string; contactId?: string; name: string; initials: string; color: string; preview: string; ago: string;
  unread?: boolean; status: "open" | "pending" | "closed";
  assignee: string | null; tags: string[]; phone: string; email?: string;
  messages: Message[];
};

export const TEAMMATES: Teammate[] = [
  { id: "me", name: "Me", initials: "JD", color: "#4f46e5" },
  { id: "sophia", name: "Sophia Grant", initials: "SG", color: "#0ea5e9" },
  { id: "laura", name: "Laura Smith", initials: "LS", color: "#f59e0b" },
];

export const TAGS: Tag[] = [
  { id: "high", name: "High Priority", color: "#ef4444", description: "Time-sensitive inquiry.", created: "Aug 26th, 2024 @ 3:28 pm", untagOnClose: false },
  { id: "la", name: "Los Angeles", color: "#8b5cf6", description: "Conversations regarding the Los Angeles store.", created: "Aug 27th, 2024 @ 3:51 pm", untagOnClose: false },
  { id: "miami", name: "Miami Location", color: "#a3e635", description: "Conversations regarding the Miami store.", created: "Aug 27th, 2024 @ 3:51 pm", untagOnClose: false },
  { id: "ship", name: "Shipping Issues", color: "#e5e7eb", description: "Customer either didn't receive their shipment or it arrived damaged.", created: "Aug 26th, 2024 @ 3:27 pm", untagOnClose: false },
];

export const MMS_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='280' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0d3b3a'/><stop offset='1' stop-color='#155e59'/></linearGradient></defs><rect width='280' height='200' fill='url(#g)'/><text x='140' y='80' font-family='Arial' font-size='26' font-weight='700' fill='#fff' text-anchor='middle' letter-spacing='4'>NEW</text><text x='140' y='112' font-family='Arial' font-size='26' font-weight='700' fill='#fff' text-anchor='middle' letter-spacing='4'>STORE</text><text x='140' y='144' font-family='Arial' font-size='26' font-weight='700' fill='#5eead4' text-anchor='middle' letter-spacing='4'>HOURS</text></svg>`);

const ev = (id: string, t: string): Message => ({ id, kind: "event", eventText: t });

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1", name: "Patrick Dukes", initials: "PD", color: "#14b8a6",
    preview: "Are you still available this weekend?", ago: "An Hour Ago", unread: true,
    status: "open", assignee: "me", tags: ["high", "la"],
    phone: "844-956-0195", email: "patrick@example.com",
    messages: [
      { id: "d1", kind: "day", eventText: "Tuesday, August 27th, 2024" },
      { id: "m0", kind: "mms", author: "Me", image: MMS_IMAGE, caption: "Hey LA 😎 We're staying open late just for you. From now on, you can shop until 10pm every Friday and Saturday night! Come by after 7pm for special giveaways and a live DJ!!", time: "3:20 pm" },
      ev("e1", "Marked As Open — On Tuesday, August 27th, 2024 @ 3:23 pm by Me"),
      ev("e2", "Conversation Assigned to Me — On Tuesday, August 27th, 2024 @ 3:23 pm by Me"),
      { id: "m1", kind: "outbound", author: "Me", text: "Awesome! We might need someone next week. What is your email address?", time: "3:24 pm" },
      ev("e3", "Conversation Tagged as High Priority — On Tuesday, August 27th, 2024 @ 3:24 pm by Me"),
      { id: "m2", kind: "inbound", author: "Patrick Dukes", initials: "PD", text: "patrick@example.com", time: "3:24 pm" },
      { id: "m3", kind: "outbound", author: "Me", text: "Sounds good. We'll be in touch!", time: "3:25 pm" },
      { id: "n1", kind: "note", author: "Note From Me", text: "Might need Patrick to fill in for Wade if he can't make it. I'm making sure we are covered.", time: "Tuesday, August 27th, 2024 @ 3:26 pm" },
    ],
  },
  {
    id: "c2", name: "Patrick Glover", initials: "PG", color: "#6366f1",
    preview: "Amazing. We'll be in touch!", ago: "An Hour Ago", unread: true,
    status: "open", assignee: "me", tags: ["high"], phone: "866-717-6169",
    messages: [
      { id: "d", kind: "day", eventText: "Tuesday, August 27th, 2024" },
      { id: "m1", kind: "outbound", author: "Me", text: "Hey Patrick! We're giving away a travel size bottle of our signature scent to everyone who spends $30 or more, and everyone off your purchase. Hope to see you!", time: "8:51 am" },
      { id: "m2", kind: "inbound", author: "Patrick Glover", initials: "PG", text: "Sweet! I also DJ, so if you're ever looking for someone to fill in, let me know.", time: "8:55 am" },
      ev("e1", "Marked As Pending — On Tuesday, August 27th, 2024 @ 8:56 am by Me"),
      ev("e2", "Marked As Open — On Tuesday, August 27th, 2024 @ 8:57 am by Me"),
      { id: "n1", kind: "note", author: "Note From Me", text: "Hey Managers, We have a customer who also DJs and said he's willing to come do a set at one of our late-night shops! Let's look into this.", time: "Tuesday, August 27th, 2024 @ 8:57 am" },
      ev("e3", "Conversation Tagged as High Priority — On Tuesday, August 27th, 2024 @ 8:57 am by Me"),
      { id: "m3", kind: "outbound", author: "Me", text: "Amazing. We'll be in touch!", time: "8:58 am" },
    ],
  },
  { id: "c3", name: "Jess Patel", initials: "JP", color: "#22c55e", preview: "Yes, I'll be there tonight.", ago: "A Day Ago", status: "open", assignee: "me", tags: [], phone: "615-630-2181",
    messages: [ { id: "m1", kind: "inbound", author: "Jess Patel", initials: "JP", text: "Yes, I'll be there tonight.", time: "3:57 pm" }, ev("e1", "Marked As Open — On Monday, August 26th, 2024 @ 3:57 pm by Me") ] },
  { id: "c4", name: "Isaiah Ramirez", initials: "IR", color: "#0ea5e9", preview: "Does this come in red?", ago: "A Day Ago", unread: true, status: "open", assignee: "sophia", tags: [], phone: "615-480-5318",
    messages: [ { id: "m1", kind: "inbound", author: "Isaiah Ramirez", initials: "IR", text: "Does this come in red?", time: "2:14 pm" } ] },
  { id: "c5", name: "Brandon Miller", initials: "BM", color: "#f59e0b", preview: "Thanks!", ago: "A Day Ago", status: "open", assignee: "me", tags: [], phone: "615-903-5194",
    messages: [ { id: "m1", kind: "inbound", author: "Brandon Miller", initials: "BM", text: "Thanks!", time: "1:02 pm" } ] },
  { id: "c6", name: "Emily Johnson", initials: "EJ", color: "#22c55e", preview: "I'll check that out", ago: "A Day Ago", status: "open", assignee: "sophia", tags: [], phone: "615-796-5972",
    messages: [ { id: "m1", kind: "inbound", author: "Emily Johnson", initials: "EJ", text: "I'll check that out", time: "12:40 pm" } ] },
  { id: "c7", name: "Jessica Davis", initials: "JD", color: "#22c55e", preview: "What are your hours for Black Friday?", ago: "A Day Ago", status: "open", assignee: "me", tags: [], phone: "903-563-6807",
    messages: [ { id: "m1", kind: "inbound", author: "Jessica Davis", initials: "JD", text: "What are your hours for Black Friday?", time: "11:18 am" } ] },
  { id: "c8", name: "Ryan Brooks", initials: "RB", color: "#f59e0b", preview: "My shipment hasn't arrived yet. Can you check on that for me?", ago: "A Day Ago", unread: true, status: "open", assignee: "me", tags: ["ship"], phone: "817-913-5130",
    messages: [
      { id: "m1", kind: "inbound", author: "Ryan Brooks", initials: "RB", text: "My shipment hasn't arrived yet. Can you check on that for me?", time: "3:00 pm" },
      ev("e1", "Marked As Open — On Monday, August 26th, 2024 @ 3:00 pm"),
      ev("e2", "Conversation Assigned to Me — On Tuesday, August 27th, 2024 @ 8:37 am by Me"),
      { id: "m2", kind: "outbound", author: "Me", text: "Sure! Can you provide the order number that this is in reference to?", time: "4:08 pm" },
    ] },
  { id: "c9", name: "Ashley Morgan", initials: "AM", color: "#f59e0b", preview: "Are all the summer clearance items final sale?", ago: "A Day Ago", status: "open", assignee: "laura", tags: [], phone: "615-555-0182",
    messages: [
      { id: "m1", kind: "inbound", author: "Ashley Morgan", initials: "AM", text: "Are all the summer clearance items final sale?", time: "2:59 pm" },
      ev("e1", "Marked As Open — On Monday, August 26th, 2024 @ 2:59 pm"),
      ev("e2", "Conversation Assigned to Laura Smith — On Monday, August 26th, 2024 @ 3:26 am by Me"),
    ] },
  { id: "c10", name: "David Clark", initials: "DC", color: "#0ea5e9", preview: "I got them yesterday. Thanks!", ago: "A Day Ago", status: "closed", assignee: null, tags: [], phone: "615-555-0147",
    messages: [ { id: "m1", kind: "inbound", author: "David Clark", initials: "DC", text: "I got them yesterday. Thanks!", time: "10:05 am" } ] },
  { id: "c11", name: "Megan Roberts", initials: "MR", color: "#6366f1", preview: "Oops. I meant to order a medium. Is it too late to change my order?", ago: "A Day Ago", unread: true, status: "open", assignee: "me", tags: [], phone: "615-555-0139",
    messages: [ { id: "m1", kind: "inbound", author: "Megan Roberts", initials: "MR", text: "Oops. I meant to order a medium. Is it too late to change my order?", time: "9:41 am" } ] },
  { id: "c12", name: "Javier Lopez", initials: "JL", color: "#22c55e", preview: "It was wonderful! Thanks!", ago: "A Day Ago", status: "closed", assignee: null, tags: [], phone: "615-555-0110",
    messages: [ { id: "m1", kind: "inbound", author: "Javier Lopez", initials: "JL", text: "It was wonderful! Thanks!", time: "9:12 am" } ] },
  { id: "c13", name: "Jordan Washington", initials: "JW", color: "#6366f1", preview: "Hey Dylan, thanks for reaching out. We always strive for a 5-star...", ago: "A Day Ago", status: "open", assignee: "me", tags: [], phone: "615-555-0164",
    messages: [ { id: "m1", kind: "inbound", author: "Jordan Washington", initials: "JW", text: "Hey Dylan, thanks for reaching out. We always strive for a 5-star experience!", time: "8:58 am" } ] },
  { id: "c14", name: "Ethan Cooper", initials: "EC", color: "#0ea5e9", preview: "I don't see my size in blue. Will they be restocked soon?", ago: "A Day Ago", status: "pending", assignee: null, tags: [], phone: "615-555-0175",
    messages: [ { id: "m1", kind: "inbound", author: "Ethan Cooper", initials: "EC", text: "I don't see my size in blue. Will they be restocked soon?", time: "8:30 am" } ] },
];

export const NAV = [
  { label: "Home", icon: "home" },
  { label: "Audience", icon: "users", children: ["Contacts", "Lists", "Segments"] },
  { label: "Campaigns", icon: "megaphone" },
  { label: "Inbox", icon: "inbox", badge: 9 },
  { label: "Workflows", icon: "workflow" },
  { label: "Analytics", icon: "chart" },
  { label: "Tools", icon: "wrench" },
];
