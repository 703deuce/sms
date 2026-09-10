export type OverviewStatItem = {
  label: string;
  value: string;
  sub: string;
  icon: "calendar" | "check" | "send" | "shield";
  tint: string;
};

export type OverviewScheduleItem = {
  id: string;
  time: string;
  dur: string;
  type: string;
  loc: string;
  name: string;
  phone: string;
  status: string;
};

export type OverviewChartModel = {
  points: number[];
  days: string[];
  total: number;
  deltaLabel: string;
  peakLabel: string;
  vsLastWeek: string;
};

export type OverviewConversationItem = {
  id: string;
  initials: string;
  color: string;
  name: string;
  msg: string;
  tag: string;
  tagColor: string;
  time: string;
};

export type OverviewAttentionItem = {
  id: string;
  icon: "bell" | "shield" | "check-square";
  tint: string;
  title: string;
  sub: string;
  href: string;
};

export type OverviewPageModel = {
  dateLabel: string;
  stats: OverviewStatItem[];
  schedule: OverviewScheduleItem[];
  scheduleTotal: number;
  chart: OverviewChartModel;
  conversations: OverviewConversationItem[];
  attention: OverviewAttentionItem[];
};

export type OverviewPageActions = {
  onOpenCalendarDate: (dateKey: string) => void;
  onViewCalendar: () => void;
  onCopyBookingLink: () => void;
  onNewAppointment: () => void;
  onSendTestReminder: () => void;
  onConfigureAvailability: () => void;
  onManageTypes: () => void;
  onReviewIssues: () => void;
  onOpenAppointment: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onViewAllConversations: () => void;
  onOpenAttentionItem: (href: string) => void;
  onRetry: () => void;
};
