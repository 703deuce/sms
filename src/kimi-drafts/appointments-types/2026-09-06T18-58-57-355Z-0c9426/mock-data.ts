export type AppointmentTypeQuestion = {
  id: string;
  label: string;
  type: string;
  required: boolean;
};

export type AppointmentTypeItem = {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
  free: boolean;
  active: boolean;
  isLive: boolean;
  color: string;
  bg: string;
  description: string;
  location: string;
  bufferMin: number;
  slug: string;
  questions: AppointmentTypeQuestion[];
};

export type AppointmentTypeFormState = {
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  description: string;
  location: string;
  locationId: string;
  priceDisplay: string;
  showPriceOnBooking: boolean;
  bookingHours: string;
  minimumBookingNoticeMinutes: number;
  maximumBookingDaysAhead: number;
  enabled: boolean;
  staffAssignment: "any_eligible" | "specific" | "round_robin" | "collective";
  staffIds: string[];
  cancellationPolicy: "anytime" | "notice_required" | "not_allowed";
  reschedulePolicy: "anytime" | "notice_required" | "not_allowed";
  paymentMode: "none" | "deposit" | "full";
  paymentProvider: "stripe" | "square" | "";
  paymentPriceCents: number;
  groupBookingEnabled: boolean;
  groupCapacity: number;
  recurringEnabled: boolean;
  visibility: "public" | "unlisted" | "secret";
  bookingApprovalRequired: boolean;
  namedScheduleId: string;
  ownerTeamId: string;
};

export const EMPTY_FORM: AppointmentTypeFormState = {
  name: "",
  durationMinutes: 30,
  bufferMinutes: 0,
  description: "",
  location: "",
  locationId: "",
  priceDisplay: "",
  showPriceOnBooking: true,
  bookingHours: "Mon–Fri 9:00 AM – 5:00 PM",
  minimumBookingNoticeMinutes: 60,
  maximumBookingDaysAhead: 14,
  enabled: true,
  staffAssignment: "any_eligible",
  staffIds: [],
  cancellationPolicy: "anytime",
  reschedulePolicy: "anytime",
  paymentMode: "none",
  paymentProvider: "",
  paymentPriceCents: 0,
  groupBookingEnabled: false,
  groupCapacity: 1,
  recurringEnabled: false,
  visibility: "public",
  bookingApprovalRequired: false,
  namedScheduleId: "ns1",
  ownerTeamId: "",
};

export const APPOINTMENT_TYPES: AppointmentTypeItem[] = [
  {
    id: "t1",
    name: "New Patient Exam",
    durationMin: 60,
    price: 89,
    free: false,
    active: true,
    isLive: true,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    description: "Comprehensive first visit including exam, x-rays, and treatment plan.",
    location: "Main Office",
    bufferMin: 10,
    slug: "new-patient-exam",
    questions: [
      { id: "q1", label: "Do you have dental insurance?", type: "Radio", required: true },
      { id: "q2", label: "Anything we should know before your visit?", type: "Long text", required: false },
    ],
  },
  {
    id: "t2",
    name: "Hygiene Cleaning",
    durationMin: 45,
    price: null,
    free: true,
    active: true,
    isLive: true,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    description: "Routine cleaning and polishing with a hygienist.",
    location: "Main Office",
    bufferMin: 5,
    slug: "hygiene-cleaning",
    questions: [],
  },
  {
    id: "t3",
    name: "Whitening Consultation",
    durationMin: 30,
    price: 49,
    free: false,
    active: true,
    isLive: true,
    color: "text-amber-600",
    bg: "bg-amber-100",
    description: "Evaluate whitening options and expected results.",
    location: "Video call",
    bufferMin: 0,
    slug: "whitening-consultation",
    questions: [{ id: "q3", label: "Current whitening products used?", type: "Short text", required: false }],
  },
  {
    id: "t4",
    name: "Emergency Visit",
    durationMin: 30,
    price: 120,
    free: false,
    active: true,
    isLive: false,
    color: "text-rose-600",
    bg: "bg-rose-100",
    description: "Same-day care for pain, chips, or broken teeth.",
    location: "Main Office",
    bufferMin: 0,
    slug: "emergency-visit",
    questions: [{ id: "q4", label: "Describe your symptoms", type: "Long text", required: true }],
  },
  {
    id: "t5",
    name: "Invisalign Review",
    durationMin: 20,
    price: null,
    free: true,
    active: false,
    isLive: false,
    color: "text-sky-600",
    bg: "bg-sky-100",
    description: "Progress check for existing aligner patients.",
    location: "Main Office",
    bufferMin: 5,
    slug: "invisalign-review",
    questions: [],
  },
];

export const STAFF_OPTIONS = [
  { id: "s1", name: "Dr. Amelia Chen" },
  { id: "s2", name: "Dr. Marcus Webb" },
  { id: "s3", name: "Sarah Okafor, RDH" },
  { id: "s4", name: "James Patel, RDH" },
];

export const LOCATION_OPTIONS = [
  { id: "l1", name: "Main Office" },
  { id: "l2", name: "Video call" },
  { id: "l3", name: "Phone call" },
];

export const PAYMENT_PROVIDERS = [
  { provider: "stripe" as const, label: "Stripe" },
  { provider: "square" as const, label: "Square" },
];

export const NAMED_SCHEDULES = [
  { id: "ns1", name: "Standard Hours" },
  { id: "ns2", name: "Evening Hours" },
  { id: "ns3", name: "Saturday Only" },
];

export const TEAM_GROUPS = [
  { id: "g1", name: "Dentists" },
  { id: "g2", name: "Hygienists" },
];
