export type ClassSectionId =
  | "overview"
  | "schedule"
  | "people-place"
  | "capacity"
  | "pricing-access"
  | "customer-setup"
  | "advanced";

export const CLASS_SECTIONS: Array<{
  id: ClassSectionId;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Name, status and what is set up" },
  { id: "schedule", label: "Schedule", description: "Pattern, recurrence and sessions" },
  { id: "people-place", label: "People & place", description: "Instructor, location and rooms" },
  {
    id: "capacity",
    label: "Capacity & registration",
    description: "Seats, registration window, registrants and waitlist",
  },
  { id: "pricing-access", label: "Pricing & access", description: "Price, packages and who can register" },
  { id: "customer-setup", label: "Customer setup", description: "Questions, identity and forms" },
  { id: "advanced", label: "Advanced", description: "Policies, admission, confirmation, reminders" },
];
