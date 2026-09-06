export interface Segment {
  id: string;
  name: string;
  createdAt: string;
  contacts: number;
  conditions?: any;
}

export interface Contact {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  state: string;
  age?: number | null;
  status: "Subscribed" | "Unsubscribed";
  lastAppointment?: string;
  nextAppointment?: string;
}

export const initialSegments: Segment[] = [
  { id: "s1", name: "25+ West Coast", createdAt: "Sep 9th, 2024 @ 2:20 pm", contacts: 1243 },
  { id: "s2", name: "Joined in Last 30 Days", createdAt: "Sep 9th, 2024 @ 2:19 pm", contacts: 412 },
  { id: "s3", name: "Subscribed — No Recent Booking", createdAt: "Sep 8th, 2024 @ 11:04 am", contacts: 876 },
  { id: "s4", name: "VIP Members — California", createdAt: "Sep 6th, 2024 @ 4:41 pm", contacts: 158 },
];

export const contacts: Contact[] = [
  { id: "c1", phone: "555-002-4984", firstName: "Jann", lastName: "Sontag", email: "jann.sontag@example.com", state: "California", age: 34, status: "Subscribed", lastAppointment: "Sep 2nd, 2024", nextAppointment: "Sep 18th, 2024 @ 2:00 pm" },
  { id: "c2", phone: "555-002-4991", firstName: "Grant", lastName: "Hellestad", email: "grant.h@example.com", state: "Oregon", age: 41, status: "Subscribed", lastAppointment: "Aug 28th, 2024" },
  { id: "c3", phone: "555-002-4992", firstName: "Megan", lastName: "Erdbruegger", email: "", state: "Washington", age: 28, status: "Subscribed", nextAppointment: "Sep 20th, 2024 @ 10:30 am" },
  { id: "c4", phone: "555-002-4997", firstName: "Kayla", lastName: "Cullen", email: "kayla.cullen@example.com", state: "California", age: null, status: "Unsubscribed", lastAppointment: "Jul 12th, 2024" },
  { id: "c5", phone: "555-002-4999", firstName: "Kathleen", lastName: "McLachlan", email: "k.mclachlan@example.com", state: "Nevada", age: 52, status: "Subscribed" },
  { id: "c6", phone: "555-002-4951", firstName: "Monica", lastName: "Kiraly", email: "monica.k@example.com", state: "California", age: 37, status: "Subscribed", nextAppointment: "Sep 15th, 2024 @ 4:00 pm" },
  { id: "c7", phone: "555-002-4993", firstName: "Nick", lastName: "Noble", email: "", state: "Arizona", age: 45, status: "Unsubscribed", lastAppointment: "Aug 5th, 2024" },
  { id: "c8", phone: "555-002-4970", firstName: "Alyssa", lastName: "Perry", email: "alyssa.perry@example.com", state: "California", age: 29, status: "Subscribed", nextAppointment: "Sep 22nd, 2024 @ 9:00 am" },
];

export const contactStats = { totalContacts: 6768, subscribedContacts: 2252, unreadMessages: 3 };

export const listOptions = ["Marketing Team", "Miami Store", "Las Vegas Store", "Distribution Center", "VIP Club Members"];

export const bookingTypes = ["Initial Consultation", "Follow-up Visit", "Estimate", "Demo Call"];

// Contact segment properties — incl. appointment filters (atomic feature: contacts-segments)
export const contactProperties: { group: string; items: string[] }[] = [
  { group: "Contact Info", items: ["First Name", "Last Name", "Email", "Phone", "City", "State", "Zip Code", "Age"] },
  { group: "Appointments", items: ["Appointment Status", "Next Appointment Date", "Last Appointment Date", "Booking Type"] },
  { group: "Activity", items: ["Date Joined", "Last Booking Date", "Last Message Date", "Opt-In Status"] },
  { group: "Membership", items: ["List Membership"] },
];

export const conditions = [
  "Is", "Is Not", "Contains", "Does Not Contain",
  "Starts With", "Ends With",
  "Is Greater Than", "Is Less Than",
  "Is After", "Is Before",
  "Is Set", "Is Not Set",
];

export const noValueConditions = ["Is Set", "Is Not Set"];

export const appointmentStatuses = ["Scheduled", "Confirmed", "Completed", "Canceled", "No-show"];

export const usStates = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];
