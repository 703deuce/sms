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
};

export type SetupPageActions = {
  onStepNavigate: (href: string) => void;
  onMarkComplete: () => void;
  onCopyBookingLink: () => void;
  onPreviewBooking: () => void;
  onRetry: () => void;
};
