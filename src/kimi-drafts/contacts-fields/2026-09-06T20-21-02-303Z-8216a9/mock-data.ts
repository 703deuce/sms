export type FieldType = "Text" | "Number" | "Date" | "Yes / No";

export type CustomField = {
  id: string;
  name: string;
  created: string;
  description: string;
  mergeTag: string;
  type: FieldType;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: "Subscribed" | "Unsubscribed";
  created: string;
  lists: string[];
  customFields?: Record<string, string>;
};

export const dataTypeOptions: FieldType[] = ["Text", "Number", "Date", "Yes / No"];

export const customFields: CustomField[] = [
  {
    id: "f1",
    name: "Preferred Location",
    created: "Created Sep 12, 2026",
    description: "The booking page or location the customer prefers for appointments.",
    mergeTag: "{{preferred_location}}",
    type: "Text",
  },
  {
    id: "f2",
    name: "Company",
    created: "Created Sep 12, 2026",
    description: "Customer's company or organization name.",
    mergeTag: "{{company}}",
    type: "Text",
  },
  {
    id: "f3",
    name: "Birthdate",
    created: "Created Sep 18, 2026",
    description: "",
    mergeTag: "{{birthdate}}",
    type: "Date",
  },
  {
    id: "f4",
    name: "Appointment Count",
    created: "Created Oct 2, 2026",
    description: "Total number of completed appointments for this contact.",
    mergeTag: "{{appointment_count}}",
    type: "Number",
  },
  {
    id: "f5",
    name: "VIP Customer",
    created: "Created Oct 9, 2026",
    description: "Whether this contact receives priority scheduling.",
    mergeTag: "{{vip_customer}}",
    type: "Yes / No",
  },
  {
    id: "f6",
    name: "Referred By",
    created: "Created Oct 21, 2026",
    description: "",
    mergeTag: "{{referred_by}}",
    type: "Text",
  },
];

export const contacts: Contact[] = [
  {
    id: "c1",
    firstName: "Sarah",
    lastName: "Johnson",
    mobile: "(571) 555-0142",
    email: "sarah.johnson@example.com",
    optIn: "Subscribed",
    created: "Sep 4, 2026",
    lists: ["VIP Club Members", "Nashville Store"],
    customFields: { preferred_location: "Nashville Store", company: "Brightline Media", vip_customer: "Yes", appointment_count: "12" },
  },
  {
    id: "c2",
    firstName: "Anthony",
    lastName: "Johnson",
    mobile: "(571) 407-3615",
    email: "anthony.j@example.com",
    optIn: "Subscribed",
    created: "Sep 7, 2026",
    lists: ["Nashville Store"],
    customFields: { preferred_location: "Nashville Store", appointment_count: "4" },
  },
  {
    id: "c3",
    firstName: "Maria",
    lastName: "Garcia",
    mobile: "(615) 555-0891",
    email: "maria.garcia@example.com",
    optIn: "Subscribed",
    created: "Sep 11, 2026",
    lists: ["VIP Club Members"],
    customFields: { company: "Garcia & Co.", vip_customer: "Yes" },
  },
  {
    id: "c4",
    firstName: "James",
    lastName: "Wright",
    mobile: "(703) 555-2274",
    email: "",
    optIn: "Unsubscribed",
    created: "Sep 14, 2026",
    lists: [],
    customFields: { referred_by: "Sarah Johnson" },
  },
  {
    id: "c5",
    firstName: "Emily",
    lastName: "Chen",
    mobile: "(202) 555-9033",
    email: "emily.chen@example.com",
    optIn: "Subscribed",
    created: "Sep 22, 2026",
    lists: ["San Francisco Store"],
    customFields: { preferred_location: "San Francisco Store", appointment_count: "7" },
  },
  {
    id: "c6",
    firstName: "David",
    lastName: "Miller",
    mobile: "(571) 555-6618",
    email: "dmiller@example.com",
    optIn: "Unsubscribed",
    created: "Oct 1, 2026",
    lists: ["NYC Store"],
    customFields: { company: "Miller Consulting" },
  },
  {
    id: "c7",
    firstName: "Priya",
    lastName: "Patel",
    mobile: "(703) 555-4410",
    email: "priya.patel@example.com",
    optIn: "Subscribed",
    created: "Oct 8, 2026",
    lists: ["VIP Club Members", "NYC Store"],
    customFields: { vip_customer: "Yes", appointment_count: "9", birthdate: "1990-03-14" },
  },
  {
    id: "c8",
    firstName: "Marcus",
    lastName: "Lee",
    mobile: "(615) 555-7720",
    email: "",
    optIn: "Subscribed",
    created: "Oct 15, 2026",
    lists: ["Nashville Store"],
    customFields: { preferred_location: "Nashville Store" },
  },
];

export const contactStats = {
  total: contacts.length,
  subscribed: contacts.filter((c) => c.optIn === "Subscribed").length,
  unsubscribed: contacts.filter((c) => c.optIn === "Unsubscribed").length,
};

export const listOptions = [
  { id: "l1", name: "Nashville Store" },
  { id: "l2", name: "NYC Store" },
  { id: "l3", name: "San Francisco Store" },
  { id: "l4", name: "VIP Club Members" },
];
