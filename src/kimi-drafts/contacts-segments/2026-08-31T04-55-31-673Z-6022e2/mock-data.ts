export interface Segment {
  id: string;
  name: string;
  created: string;
  description: string | null;
  contacts: number;
}

export const initialSegments: Segment[] = [
  { id: "s1", name: "Clicked on Welcome Drip #1", created: "Created on Sep 6th, 2024 @ 2:35 pm", description: null, contacts: 1 },
  { id: "s2", name: "49ers Fans", created: "Created on Sep 6th, 2024 @ 2:35 pm", description: null, contacts: 2387 },
];

export const propertyGroups = [
  {
    label: "Contact Fields",
    options: ["First Name","Last Name","Area Code","Email Address","Address","City","State","Province","Postal Code","Country","Source","Age","Birthday","Birth Month","Days Until Birthday","Opt-In Status","Timezone","Language","Created","Last Updated"],
  },
  {
    label: "Custom Fields",
    options: ["Favorite Sports Team"],
  },
  {
    label: "Lists",
    options: ["List Membership"],
  },
  {
    label: "Links",
    options: ["Link Clicked"],
  },
  {
    label: "Campaigns",
    options: ["Campaign Sent"],
  },
];

export const conditions = [
  "Is","Is Not","Is Less Than","Is Less Than Or Equal To","Is Greater Than","Is Greater Than or Equal To","Is Between","Is Not Between","Is Known","Is Not Known",
];

export const usStates = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  age: number | null;
  subscribed: string;
}

export const matchedContacts: Contact[] = [
  { id: "c1", name: "Maria Alvarez", phone: "(415) 555-0132", email: "maria.alvarez@example.com", state: "California", age: 34, subscribed: "Aug 12th, 2024" },
  { id: "c2", name: "Devon Carter", phone: "(206) 555-0177", email: "devon.c@example.com", state: "Washington", age: 41, subscribed: "Aug 3rd, 2024" },
  { id: "c3", name: "Priya Nair", phone: "(503) 555-0109", email: "priya.nair@example.com", state: "Oregon", age: null, subscribed: "Jul 28th, 2024" },
  { id: "c4", name: "Tom Becker", phone: "(310) 555-0154", email: "tbecker@example.com", state: "California", age: 52, subscribed: "Jul 19th, 2024" },
  { id: "c5", name: "Alana Reyes", phone: "(619) 555-0118", email: "alana.reyes@example.com", state: "California", age: 27, subscribed: "Jul 11th, 2024" },
  { id: "c6", name: "Jordan Kim", phone: "(425) 555-0163", email: "jordan.kim@example.com", state: "Washington", age: 38, subscribed: "Jun 30th, 2024" },
  { id: "c7", name: "Casey O'Brien", phone: "(541) 555-0141", email: "casey.ob@example.com", state: "Oregon", age: 45, subscribed: "Jun 22nd, 2024" },
  { id: "c8", name: "Sam Whitfield", phone: "(916) 555-0126", email: "sam.w@example.com", state: "California", age: 29, subscribed: "Jun 14th, 2024" },
];

export const saveOptions = [
  { id: "contacts", label: "Save & View Contacts" },
  { id: "segments", label: "Save & View Segments" },
  { id: "campaign", label: "Save & Create Campaign" },
];
