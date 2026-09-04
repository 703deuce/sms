export type StepStatus = "done" | "up-next" | "not-started";

export interface SetupStep {
  id: number;
  label: string;
  status: StepStatus;
  statusText?: string;
  title: string;
  description: string;
  action: "start" | "review";
  icon: string;
  href: string;
}

export interface SetupSummary {
  completed: number;
  total: number;
  percent: number;
  inProgress: number;
  notStarted: number;
  estTime: string;
}

export interface QuickTip {
  id: number;
  title: string;
  description: string;
  icon: string;
  href: string;
}
