export interface AppointmentType {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
  free: boolean;
  active: boolean;
  color: string;
  bg: string;
  description: string;
  location: string;
  bufferMin: number;
  slug: string;
  created: string;
  updated: string;
  questions: FormQuestion[];
}

export interface FormQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export const appointmentTypes: AppointmentType[] = [
  {
    id: "consult",
    name: "30-Minute Consultation",
    durationMin: 30,
    price: 49,
    free: false,
    active: true,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    description:
      "A focused 30-minute session to discuss your needs and explore how we can help.",
    location: "In-office",
    bufferMin: 0,
    slug: "30min-consult",
    created: "Aug 10, 2026 at 9:12 AM",
    updated: "Aug 28, 2026 at 2:45 PM",
    questions: [
      { id: "q1", label: "What brings you in today?", type: "Short answer", required: true },
      { id: "q2", label: "How did you hear about us?", type: "Multiple choice", required: false },
      { id: "q3", label: "Anything else we should know?", type: "Long answer", required: false },
    ],
  },
  { id: "discovery", name: "Discovery Call", durationMin: 15, price: null, free: true, active: true, color: "text-emerald-600", bg: "bg-emerald-100", description: "A quick intro call to see if we're a fit.", location: "Phone call", bufferMin: 5, slug: "discovery", created: "Jul 2, 2026 at 10:00 AM", updated: "Aug 1, 2026 at 11:30 AM", questions: [] },
  { id: "strategy", name: "Strategy Session", durationMin: 60, price: 129, free: false, active: true, color: "text-amber-600", bg: "bg-amber-100", description: "Deep-dive planning session.", location: "Video call", bufferMin: 10, slug: "strategy", created: "Jun 14, 2026 at 1:15 PM", updated: "Aug 12, 2026 at 9:45 AM", questions: [] },
  { id: "onboarding", name: "Onboarding Call", durationMin: 45, price: 79, free: false, active: true, color: "text-sky-600", bg: "bg-sky-100", description: "Get set up and running.", location: "Video call", bufferMin: 0, slug: "onboarding", created: "May 30, 2026 at 8:00 AM", updated: "Jul 22, 2026 at 4:10 PM", questions: [] },
  { id: "demo", name: "Product Demo", durationMin: 30, price: null, free: true, active: false, color: "text-rose-600", bg: "bg-rose-100", description: "Live walkthrough of the product.", location: "Video call", bufferMin: 0, slug: "demo", created: "Apr 18, 2026 at 3:00 PM", updated: "Jun 9, 2026 at 10:20 AM", questions: [] },
  { id: "followup", name: "Follow-up Call", durationMin: 15, price: null, free: true, active: false, color: "text-teal-600", bg: "bg-teal-100", description: "Quick check-in after your session.", location: "Phone call", bufferMin: 0, slug: "follow-up", created: "Mar 7, 2026 at 12:00 PM", updated: "May 19, 2026 at 2:30 PM", questions: [] },
  { id: "vip", name: "VIP Coaching", durationMin: 90, price: 249, free: false, active: true, color: "text-violet-600", bg: "bg-violet-100", description: "Premium 1:1 coaching intensive.", location: "In-office", bufferMin: 15, slug: "vip-coaching", created: "Jan 25, 2026 at 9:00 AM", updated: "Aug 20, 2026 at 5:00 PM", questions: [] },
];
