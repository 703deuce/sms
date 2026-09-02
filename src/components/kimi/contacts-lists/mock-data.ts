export interface ContactList {
  id: string;
  name: string;
  description: string;
  created: string;
  contacts: number;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: "Subscribed" | "Not Subscribed" | "Unsubscribed";
  created: string;
}

export interface Keyword {
  id: string;
  keyword: string;
  description: string;
  lastSaved: string;
  connectedLists: number;
  createsContacts: boolean;
  autoResponse?: string;
  listName?: string;
  status?: "Active" | "Inactive";
}

export const initialLists: ContactList[] = [
  { id: "1", name: "Marketing Team", description: "Employees on our marketing team", created: "Sep 9th, 2024 @ 2:18 pm", contacts: 5 },
  { id: "2", name: "Miami Store", description: "Customers of Miami location", created: "Sep 9th, 2024 @ 2:18 pm", contacts: 6753 },
  { id: "3", name: "Las Vegas Store", description: "Customers of Las Vegas Location", created: "Sep 9th, 2024 @ 2:17 pm", contacts: 6456 },
  { id: "4", name: "Distribution Center", description: "Employees at our distribution center", created: "Sep 9th, 2024 @ 2:16 pm", contacts: 13 },
];

export const contacts: Contact[] = [
  { id: "c1", firstName: "Jann", lastName: "Sontag", mobile: "555-002-4984", email: "", optIn: "Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c2", firstName: "Grant", lastName: "Hellestad", mobile: "555-002-4991", email: "", optIn: "Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c3", firstName: "Megan", lastName: "Erdbruegger", mobile: "555-002-4992", email: "", optIn: "Not Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c4", firstName: "kayla", lastName: "Cullen", mobile: "555-002-4997", email: "", optIn: "Not Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c5", firstName: "Kathleen", lastName: "McLachlan", mobile: "555-002-4999", email: "", optIn: "Not Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c6", firstName: "monica", lastName: "Kiraly", mobile: "555-002-4951", email: "", optIn: "Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c7", firstName: "Nick", lastName: "Noble", mobile: "555-002-4993", email: "", optIn: "Not Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
  { id: "c8", firstName: "Alyssa", lastName: "Perry", mobile: "555-002-4970", email: "", optIn: "Subscribed", created: "Sep 9th, 2024 @ 2:28 pm" },
];

export const contactStats = { total: 6768, subscribed: 2252, unsubscribed: 0 };

export const keywords: Keyword[] = [
  { id: "k1", keyword: "BlackFriday", description: "Joined during our Black Friday sale.", lastSaved: "Sep 10th, 2024 @ 10:12 am", connectedLists: 0, createsContacts: true },
  { id: "k2", keyword: "SoCalVIP", description: "Subscribers who have opted in at our SoCal locations.", lastSaved: "Sep 10th, 2024 @ 10:12 am", connectedLists: 1, createsContacts: true },
  { id: "k3", keyword: "NYCVIP", description: "Subscribers who have opted in at our NYC locations.", lastSaved: "Sep 10th, 2024 @ 10:12 am", connectedLists: 1, createsContacts: true },
  { id: "k4", keyword: "MiamiVIP", description: "Subscribers who have opted in at our Miami location.", lastSaved: "Sep 10th, 2024 @ 10:12 am", connectedLists: 1, createsContacts: true },
  { id: "k5", keyword: "NashVIP", description: "Subscribers who have shopped at our Nashville location.", lastSaved: "Sep 10th, 2024 @ 10:12 am", connectedLists: 0, createsContacts: true },
];

export const keywordDetail = {
  keyword: "NashVIP",
  description: "Subscribers who have shopped at our Nashville location.",
  autoResponse: "Well howdy there! Show this text at the register to get a free sample of our signature scent.",
};
