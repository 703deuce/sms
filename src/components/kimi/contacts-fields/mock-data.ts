export type FieldType = "Text" | "Number" | "Date" | "Yes / No";

export interface CustomField {
  id: string;
  name: string;
  created: string;
  description: string;
  mergeTag: string;
  type: FieldType;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: "Subscribed" | "Unsubscribed";
  created: string;
  lists: string[];
}

export const initialFields: CustomField[] = [
  {
    id: "f1",
    name: "Favorite Sports Team",
    created: "Created on Mar 19th, 2024 @ 9:03 am",
    description: "",
    mergeTag: "{{favorite_sports_team}}",
    type: "Text",
  },
  {
    id: "f2",
    name: "Graduation Year",
    created: "Created on Feb 20th, 2024 @ 8:49 am",
    description: "",
    mergeTag: "{{graduation_year}}",
    type: "Number",
  },
];

export const contacts: Contact[] = [
  { id: "c1", firstName: "Dan", lastName: "Good", mobile: "555-666-7777", email: "dg@transovo.com", optIn: "Subscribed", created: "Jun 13th, 2024 @ 11:10 am", lists: ["Marketing Team", "Nashville Office"] },
  { id: "c2", firstName: "Romane", lastName: "Gonzalez", mobile: "555-000-0318", email: "", optIn: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am", lists: [] },
  { id: "c3", firstName: "Lawrence", lastName: "Martinez", mobile: "555-000-0319", email: "", optIn: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am", lists: [] },
  { id: "c4", firstName: "Londi", lastName: "Soens", mobile: "555-000-0320", email: "", optIn: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am", lists: [] },
  { id: "c5", firstName: "Sheldon", lastName: "Garcia", mobile: "555-000-0321", email: "", optIn: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am", lists: [] },
  { id: "c6", firstName: "Jennifer", lastName: "Amos", mobile: "555-000-0322", email: "", optIn: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am", lists: [] },
];

export const contactStats = { total: 278, subscribed: 218, unsubscribed: 41 };

export const dataTypeOptions: FieldType[] = ["Text", "Number", "Date", "Yes / No"];

export function mergeTagFor(name: string) {
  return `{{${name.trim().toLowerCase().replace(/\s+/g, "_")}}}`;
}
