import type {
  SetupPageModel,
  SetupProgressSummary,
  SetupReadinessItem,
  SetupStep,
  SetupStepStatus,
} from "./types";

export type SetupApiStatus = {
  typesCount: number;
  bookingEnabled: boolean;
  hasSlug: boolean;
  hasAvailability: boolean;
  remindersConfigured: boolean;
  onboardingComplete: boolean;
};

const STEP_DEFS: Array<{
  title: string;
  detail: string;
  href: string;
  icon: string;
  done: (s: SetupApiStatus) => boolean;
}> = [
  {
    title: "Business information",
    detail: "Display name, timezone, and public booking link.",
    href: "/appointments/booking",
    icon: "building",
    done: (s) => s.hasSlug,
  },
  {
    title: "Set availability",
    detail: "Weekly hours, date overrides, and booking rules.",
    href: "/appointments/availability",
    icon: "calendar",
    done: (s) => s.hasAvailability,
  },
  {
    title: "Create an appointment type",
    detail: "Name, duration, location, and booking questions.",
    href: "/appointments/types",
    icon: "calendar-clock",
    done: (s) => s.typesCount > 0,
  },
  {
    title: "Turn on booking page",
    detail: "Enable your public link and preview the customer flow.",
    href: "/appointments/booking",
    icon: "globe",
    done: (s) => s.bookingEnabled && s.hasSlug,
  },
  {
    title: "Configure reminders",
    detail: "Preview templates and adjust timing.",
    href: "/appointments/reminders",
    icon: "bell",
    done: (s) => s.remindersConfigured,
  },
  {
    title: "Send test reminder",
    detail: "Send yourself a real test SMS before going live.",
    href: "/appointments/reminders",
    icon: "send",
    done: () => false,
  },
  {
    title: "Create/test booking",
    detail: "Book a test appointment and verify timeline + confirmations.",
    href: "/appointments/new",
    icon: "party",
    done: () => false,
  },
];

const QUICK_TIPS = [
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

function deriveStepStatus(
  done: boolean,
  isNext: boolean,
): SetupStepStatus {
  if (done) return "done";
  if (isNext) return "up-next";
  return "not-started";
}

function buildProgress(steps: SetupStep[]): SetupProgressSummary {
  const completed = steps.filter((s) => s.status === "done").length;
  const inProgress = steps.filter((s) => s.status === "up-next").length;
  const notStarted = steps.filter((s) => s.status === "not-started").length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  const remaining = total - completed;
  const estTime =
    remaining <= 1 ? "~5 min" : remaining <= 3 ? "10–15 min" : "15–20 min";

  return { completed, total, percent, inProgress, notStarted, estTime };
}

function buildReadiness(steps: SetupStep[]): SetupReadinessItem[] {
  return steps.map((step) => ({
    label: step.title,
    state:
      step.status === "done"
        ? "done"
        : step.status === "up-next"
          ? "partial"
          : "pending",
  }));
}

export function deriveSetupApiStatus(input: {
  types: unknown[];
  settings: Record<string, unknown>;
  workspaceSlug?: string | null;
}): SetupApiStatus {
  const data = input.settings;
  const weekly = (data.weeklyHours || {}) as Record<string, unknown>;
  const reminders = (data.reminders || {}) as {
    confirmation?: { enabled?: boolean };
  };

  return {
    typesCount: input.types.length,
    bookingEnabled: Boolean(data.bookingEnabled),
    hasSlug: Boolean(input.workspaceSlug),
    hasAvailability: Object.keys(weekly).length > 0,
    remindersConfigured: Boolean(reminders.confirmation?.enabled),
    onboardingComplete: Boolean(data.onboardingComplete),
  };
}

export function buildSetupPageModel(input: {
  status: SetupApiStatus;
  workspaceSlug: string;
  origin?: string;
}): SetupPageModel {
  const nextIndex = STEP_DEFS.findIndex((def) => !def.done(input.status));
  const steps: SetupStep[] = STEP_DEFS.map((def, idx) => ({
    id: idx + 1,
    title: def.title,
    description: def.detail,
    href: def.href,
    icon: def.icon,
    status: deriveStepStatus(def.done(input.status), idx === nextIndex),
  }));

  const progress = buildProgress(steps);
  const bookingPath = input.workspaceSlug ? `/book/${input.workspaceSlug}` : "";
  const bookingLink =
    input.origin && bookingPath
      ? `${input.origin.replace(/^https?:\/\//, "")}${bookingPath}`
      : bookingPath.replace(/^\//, "");

  return {
    steps,
    progress,
    readinessItems: buildReadiness(steps),
    bookingLink,
    bookingPath,
    onboardingComplete: input.status.onboardingComplete,
    allDone: progress.percent === 100,
    quickTips: QUICK_TIPS,
  };
}
