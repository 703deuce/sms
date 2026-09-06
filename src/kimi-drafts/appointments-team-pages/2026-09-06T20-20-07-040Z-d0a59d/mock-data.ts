export type SchedulingGroup = {
  id: string;
  name: string;
  slug: string;
  memberStaffIds: string[];
  roundRobinEnabled?: boolean;
  description?: string;
  active?: boolean;
};

export type TeamBookingPage = {
  id: string;
  name: string;
  slug: string;
  schedulingGroupId?: string;
  appointmentTypeIds: string[];
  headline?: string;
  description?: string;
  active?: boolean;
};

export type BookingTypeLite = { id: string; name: string; durationMinutes: number };
export type StaffLite = { id: string; name: string; role: string };

export const WORKSPACE_SLUG = "bright-dental";
export const WORKSPACE_ORIGIN = "https://book.transovo.com";

export const bookingTypes: BookingTypeLite[] = [
  { id: "at_1", name: "New patient exam", durationMinutes: 60 },
  { id: "at_2", name: "Hygiene cleaning", durationMinutes: 45 },
  { id: "at_3", name: "Consultation", durationMinutes: 30 },
  { id: "at_4", name: "Emergency visit", durationMinutes: 30 },
];

export const staffMembers: StaffLite[] = [
  { id: "st_1", name: "Dr. Sarah Miller", role: "Owner" },
  { id: "st_2", name: "James Chen", role: "Hygienist" },
  { id: "st_3", name: "Maria Lopez", role: "Hygienist" },
  { id: "st_4", name: "Dr. Anthony Reed", role: "Associate" },
  { id: "st_5", name: "Priya Nair", role: "Front desk" },
];

export const initialGroups: SchedulingGroup[] = [
  {
    id: "sg_1",
    name: "Hygiene team",
    slug: "hygiene",
    memberStaffIds: ["st_2", "st_3"],
    roundRobinEnabled: true,
    description: "Round-robin hygiene appointments across both hygienists.",
    active: true,
  },
  {
    id: "sg_2",
    name: "Doctors",
    slug: "doctors",
    memberStaffIds: ["st_1", "st_4"],
    roundRobinEnabled: true,
    active: true,
  },
];

export const initialPages: TeamBookingPage[] = [
  {
    id: "tp_1",
    name: "Bright Dental — Team booking",
    slug: "team",
    schedulingGroupId: "sg_1",
    appointmentTypeIds: ["at_2", "at_1"],
    headline: "Book with the Bright Dental team",
    active: true,
  },
  {
    id: "tp_2",
    name: "Consultations (all providers)",
    slug: "consult",
    schedulingGroupId: "sg_2",
    appointmentTypeIds: ["at_3"],
    headline: "Schedule a consultation",
    active: true,
  },
  {
    id: "tp_3",
    name: "Emergency visits",
    slug: "emergency",
    appointmentTypeIds: ["at_4"],
    headline: "Same-day emergency care",
    active: false,
  },
];
