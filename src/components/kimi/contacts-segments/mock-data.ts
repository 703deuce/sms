export interface Segment {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  contacts: number;
  conditions?: unknown;
}

export const segments: Segment[] = [
  { id: "s1", name: "Clicked on Welcome Drip #1", createdAt: "Sep 6th, 2024 @ 2:35 pm", contacts: 87 },
  { id: "s2", name: "49ers Fans", createdAt: "Sep 6th, 2024 @ 2:35 pm", contacts: 2387 },
];

export interface Contact {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  state: string;
  age: number | null;
  status: "Subscribed" | "Unsubscribed";
}

export const contacts: Contact[] = [
  { id: "c1", phone: "(415) 555-0132", firstName: "Maya", lastName: "Reyes", email: "maya.reyes@example.com", state: "California", age: 34, status: "Subscribed" },
  { id: "c2", phone: "(206) 555-0178", firstName: "Jordan", lastName: "Lee", email: "jordan.lee@example.com", state: "Washington", age: 41, status: "Subscribed" },
  { id: "c3", phone: "(503) 555-0109", firstName: "Priya", lastName: "Nair", email: "priya.nair@example.com", state: "Oregon", age: 29, status: "Subscribed" },
  { id: "c4", phone: "(310) 555-0155", firstName: "Diego", lastName: "Torres", email: "diego.t@example.com", state: "California", age: 52, status: "Subscribed" },
  { id: "c5", phone: "(425) 555-0117", firstName: "Sara", lastName: "Kim", email: "sara.kim@example.com", state: "Washington", age: null, status: "Subscribed" },
  { id: "c6", phone: "(916) 555-0143", firstName: "Tom", lastName: "Baker", email: "tom.baker@example.com", state: "California", age: 27, status: "Subscribed" },
  { id: "c7", phone: "(971) 555-0126", firstName: "Alicia", lastName: "Ford", email: "alicia.f@example.com", state: "Oregon", age: 38, status: "Unsubscribed" },
  { id: "c8", phone: "(628) 555-0191", firstName: "Noah", lastName: "Chen", email: "noah.chen@example.com", state: "California", age: 45, status: "Subscribed" },
];

export interface ContactList {
  id: string;
  name: string;
  contacts: number;
  createdAt: string;
}

export const lists: ContactList[] = [
  { id: "l1", name: "VIP Customers", contacts: 1214, createdAt: "Aug 12th, 2024" },
  { id: "l2", name: "Newsletter Subscribers", contacts: 5210, createdAt: "Jul 3rd, 2024" },
  { id: "l3", name: "Event Attendees 2024", contacts: 342, createdAt: "Sep 1st, 2024" },
];

export const contactProperties = [
  { group: "Contact Fields", items: ["First Name","Last Name","Area Code","Email Address","Address","City","State","Province","Postal Code","Country","Source","Age","Birthday","Birth Month","Days Until Birthday","Opt-In Status","Timezone","Language","Created","Last Updated"] },
  { group: "Custom Fields", items: ["Favorite Sports Team"] },
  { group: "Lists", items: ["List Membership"] },
  { group: "Links", items: ["Link Clicked"] },
  { group: "Campaigns", items: ["Campaign Sent"] },
];

export const conditions = ["Is","Is Not","Is Less Than","Is Less Than Or Equal To","Is Greater Than","Is Greater Than or Equal To","Is Between","Is Not Between","Is Known","Is Not Known"];

export const noValueConditions = ["Is Known", "Is Not Known"];

export const usStates = ["Alabama","Alaska","Arizona","California","Colorado","Florida","Georgia","New York","North Carolina","Oregon","Texas","Washington"];

export function computeMatched(name: string, groups: { conditions: { property: string; condition: string; value: string; values?: string[] }[] }[]): number {
  let n = 0;
  const flat = groups.flatMap(g => g.conditions).filter(c => c.property && c.condition);
  if (flat.length === 0) return 0;
  n = 6766;
  for (const c of flat) {
    if (c.condition === "Is Not Known") n = Math.min(n + 706, 5469);
    else if (c.property === "Age" && c.condition === "Is Greater Than or Equal To") n = Math.min(n, 4753);
    else if (c.property === "State") n = 2793;
    else n = Math.max(12, Math.floor(n * 0.62));
  }
  return n;
}
