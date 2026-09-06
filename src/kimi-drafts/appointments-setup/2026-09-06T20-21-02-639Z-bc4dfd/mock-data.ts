export type SetupStepStatus = "done" | "up-next" | "not-started";

export type SetupStep = {
  id: number;
  title: string;
  description: string;
  status: SetupStepStatus;
  icon: string;
  href: string;
};

export type SetupProgressSummary = {
  completed: number;
  total: number;
  percent: number;
  inProgress: number;
  notStarted: number;
  estTime: string;
};

export type SetupReadinessItem = {
  label: string;
  state: "done" | "partial" | "pending";
};

export type SetupQuickTip = {
  icon: string;
  title: string;
  description: string;
};

export type SetupPageModel = {
  steps: SetupStep[];
  progress: SetupProgressSummary;
  readinessItems: SetupReadinessItem[];
  bookingLink: string;
  bookingPath: string;
  onboardingComplete: boolean;
  allDone: boolean;
  quickTips: SetupQuickTip[];
  /** Permission state: user can view setup but cannot change it */
  readOnly?: boolean;
};

// Partially-complete state: business info + availability done, type is up next
export const setupModelPartial: SetupPageModel = {
  steps: [
    {
      id: 1,
      title: "Business information",
      description: "Display name, timezone, and public booking link.",
      status: "done",
      icon: "building",
      href: "/appointments/booking",
    },
    {
      id: 2,
      title: "Set availability",
      description: "Weekly hours, date overrides, and booking rules.",
      status: "done",
      icon: "calendar",
      href: "/appointments/availability",
    },
    {
      id: 3,
      title: "Create an appointment type",
      description: "Name, duration, location, and booking questions.",
      status: "up-next",
      icon: "calendar-clock",
      href: "/appointments/types",
    },
    {
      id: 4,
      title: "Turn on booking page",
      description: "Enable your public link and preview the customer flow.",
      status: "not-started",
      icon: "globe",
      href: "/appointments/booking",
    },
    {
      id: 5,
      title: "Configure reminders",
      description: "Preview templates and adjust timing.",
      status: "not-started",
      icon: "bell",
      href: "/appointments/reminders",
    },
    {
      id: 6,
      title: "Send test reminder",
      description: "Send yourself a real test SMS before going live.",
      status: "not-started",
      icon: "send",
      href: "/appointments/reminders",
    },
    {
      id: 7,
      title: "Create/test booking",
      description: "Book a test appointment and verify timeline + confirmations.",
      status: "not-started",
      icon: "party",
      href: "/appointments/new",
    },
  ],
  progress: {
    completed: 2,
    total: 7,
    percent: 29,
    inProgress: 1,
    notStarted: 4,
    estTime: "15–20 min",
  },
  readinessItems: [
    { label: "Business information", state: "done" },
    { label: "Set availability", state: "done" },
    { label: "Create an appointment type", state: "partial" },
    { label: "Turn on booking page", state: "pending" },
    { label: "Configure reminders", state: "pending" },
    { label: "Send test reminder", state: "pending" },
    { label: "Create/test booking", state: "pending" },
  ],
  bookingLink: "app.transovo.com/book/bright-dental",
  bookingPath: "/book/bright-dental",
  onboardingComplete: false,
  allDone: false,
  quickTips: [
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
  ],
};

// First-use empty state: nothing done yet
export const setupModelEmpty: SetupPageModel = {
  ...setupModelPartial,
  steps: setupModelPartial.steps.map((s, i) => ({
    ...s,
    status: i === 0 ? "up-next" : "not-started",
  })),
  progress: {
    completed: 0,
    total: 7,
    percent: 0,
    inProgress: 1,
    notStarted: 6,
    estTime: "15–20 min",
  },
  readinessItems: setupModelPartial.readinessItems.map((r, i) => ({
    ...r,
    state: i === 0 ? "partial" : "pending",
  })),
  bookingLink: "",
  bookingPath: "",
};

// All done / success state
export const setupModelComplete: SetupPageModel = {
  ...setupModelPartial,
  steps: setupModelPartial.steps.map((s) => ({ ...s, status: "done" as const })),
  progress: {
    completed: 7,
    total: 7,
    percent: 100,
    inProgress: 0,
    notStarted: 0,
    estTime: "~5 min",
  },
  readinessItems: setupModelPartial.readinessItems.map((r) => ({
    ...r,
    state: "done" as const,
  })),
  onboardingComplete: true,
  allDone: true,
};

// Permission / read-only state: same mid-progress data, but user cannot modify setup
export const setupModelReadOnly: SetupPageModel = {
  ...setupModelPartial,
  readOnly: true,
};
