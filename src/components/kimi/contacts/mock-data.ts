export type OptInStatus = "Subscribed" | "Unsubscribed" | "Not Subscribed" | "Blocked";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  status: OptInStatus;
  created: string;
}

export const contacts: Contact[] = [
  { id: "1", firstName: "Dan", lastName: "Seaver", mobile: "555-888-6666", email: "dseaver@gmail.com", status: "Subscribed", created: "Aug 20th, 2024 @ 10:18 am" },
  { id: "2", firstName: "Romane", lastName: "Gonzalez", mobile: "555-000-0318", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "3", firstName: "Lawrence", lastName: "Martinez", mobile: "555-000-0319", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "4", firstName: "Londi", lastName: "Soens", mobile: "555-000-0320", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "5", firstName: "Sheldon", lastName: "Garcia", mobile: "555-000-0321", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "6", firstName: "Jennifer", lastName: "Amos", mobile: "555-000-0322", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "7", firstName: "Matthew", lastName: "Jackson", mobile: "555-000-0323", email: "", status: "Unsubscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "8", firstName: "Pamela", lastName: "Leon", mobile: "555-000-0324", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "9", firstName: "Cindy", lastName: "Romero", mobile: "555-000-0325", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "10", firstName: "Kimberly", lastName: "Rutledge", mobile: "555-000-0326", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "11", firstName: "Melvin", lastName: "Boss", mobile: "555-000-0327", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "12", firstName: "Pete", lastName: "Rodriguez", mobile: "555-000-0328", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "13", firstName: "Victor", lastName: "Trujillo", mobile: "555-000-0329", email: "", status: "Subscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "14", firstName: "Cameron", lastName: "Torres", mobile: "555-000-0330", email: "", status: "Unsubscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
  { id: "15", firstName: "Faith", lastName: "Ross", mobile: "555-000-0331", email: "", status: "Unsubscribed", created: "Apr 23rd, 2024 @ 8:57 am" },
];

export const contactLists = [
  "Distribution Center",
  "Las Vegas",
  "Marketing Team",
  "Nashville Office",
  "Nashville Store",
  "New York City",
  "Orlando",
  "San Francisco",
  "St Louis",
  "VIP List",
  "Washington, DC",
];

export const contactFieldOptions = [
  "None",
  "First Name",
  "Last Name",
  "Mobile Number",
  "Email",
  "Birthdate",
  "Address",
  "City",
  "State / Province",
  "Postal Code",
  "Country",
  "Timezone",
  "Language",
  "Opt-In Status",
  "Favorite Sports Team",
  "Graduation Year",
  "Preferred Location",
];

export interface ImportColumn {
  name: string;
  sample: string;
}

export const importColumns: ImportColumn[] = [
  { name: "First Name", sample: "Henry" },
  { name: "Last Name", sample: "Rosas" },
  { name: "Mobile", sample: "5551111111" },
  { name: "Opt-In Status", sample: "Subscribed" },
];

export const stats = {
  contacts: 82133,
  subscribed: 82073,
  unsubscribed: 41,
};
