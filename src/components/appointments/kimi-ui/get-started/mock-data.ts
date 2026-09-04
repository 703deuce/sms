export type StepStatus = "done" | "up-next" | "not-started";

export interface SetupStep {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  icon: string; // key resolved in StepRow
}

export const setupSteps: SetupStep[] = [
  {
    id: 1,
    title: "Business information",
    description: "Display name, timezone, and public booking link.",
    status: "done",
    icon: "building",
  },
  {
    id: 2,
    title: "Set availability",
    description: "Define your weekly hours, date overrides, and booking rules.",
    status: "up-next",
    icon: "calendar",
  },
  {
    id: 3,
    title: "Create an appointment type",
    description: "Name, duration, location, and booking questions.",
    status: "not-started",
    icon: "calendar-clock",
  },
  {
    id: 4,
    title: "Turn on booking page",
    description: "Enable your public link and preview the customer flow.",
    status: "not-started",
    icon: "globe",
  },
  {
    id: 5,
    title: "Configure reminders",
    description: "Choose templates and adjust timing for emails and SMS.",
    status: "done",
    icon: "bell",
  },
  {
    id: 6,
    title: "Send test reminder",
    description: "Send yourself a real test SMS before going live.",
    status: "not-started",
    icon: "send",
  },
  {
    id: 7,
    title: "Create/test booking",
    description: "Book a test appointment and verify timeline + confirmations.",
    status: "not-started",
    icon: "party",
  },
];

export interface ReadinessItem {
  label: string;
  state: "done" | "partial" | "pending";
}

export const readinessItems: ReadinessItem[] = [
  { label: "Business information", state: "done" },
  { label: "Set availability", state: "partial" },
  { label: "Create appointment type", state: "pending" },
  { label: "Turn on booking page", state: "pending" },
  { label: "Configure reminders", state: "done" },
  { label: "Send test reminder", state: "pending" },
  { label: "Create/test booking", state: "pending" },
];

export const bookingLink = "transovo.com/book/mass-text-cert";

export const quickTips = [
  {
    icon: "clock",
    title: "Set clear availability",
    description: "Add date overrides for holidays and special hours.",
  },
  {
    icon: "help",
    title: "Add booking questions",
    description: "Collect details upfront to save time.",
  },
  {
    icon: "rocket",
    title: "Test end-to-end",
    description: "Book a test to confirm reminders and flow.",
  },
];

export const progressSummary = {
  completed: 5,
  total: 7,
  percent: 71,
  inProgress: 1,
  notStarted: 1,
  estTime: "10–15 min",
};
