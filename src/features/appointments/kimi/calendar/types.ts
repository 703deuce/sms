export type CalendarViewMode = "day" | "week" | "month";

export type CalendarStatItem = {
  icon: "calendar" | "check" | "clock" | "x" | "users";
  tone: "indigo" | "green" | "amber" | "red" | "violet";
  value: string;
  label: string;
  delta?: string;
  deltaUp?: boolean;
};

export type CalendarWeekDay = {
  label: string;
  date: string;
  dateKey: string;
  today: boolean;
  dayOfWeek: number;
};

export type AppointmentMeetingIndicator = {
  notetakerStatus?: string | null;
  notetakerSessionId?: string | null;
  notetakerEnabled?: boolean;
  videoStatus?: string | null;
  videoProvisioningStatus?: string | null;
  videoMeetingId?: string | null;
  videoJoinUrl?: string | null;
  recapReady?: boolean;
  recapSessionId?: string | null;
};

export type CalendarWeekEvent = {
  id: string;
  day: number;
  start: number;
  duration: number;
  timeLabel: string;
  title: string;
  name: string;
  type: "consultation" | "call" | "followup" | "onboarding" | "canceled";
  status: "confirmed" | "pending" | "canceled";
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
  colorDot?: string;
  isRecurring?: boolean;
  isClassOrEvent?: boolean;
  attendeeCount?: number;
};

export type CalendarUnavailableBlock = {
  day: number;
  start: number;
  duration: number;
  label?: string;
};

export type CalendarTypeColor = {
  label: string;
  dot: string;
};

export type CalendarMiniDay = {
  day: number;
  muted: boolean;
  selected: boolean;
  hasEvent: boolean;
  dateKey: string;
};

export type CalendarAgendaItem = {
  id: string;
  time: string;
  duration: string;
  title: string;
  name: string;
  status: "confirmed" | "pending" | "canceled";
  dot: string;
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
};

export type CalendarNextAppointment = {
  id: string;
  inLabel: string;
  time: string;
  duration: string;
  title: string;
  name: string;
  method: string;
  phone: string;
  status: "confirmed" | "pending" | "canceled";
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
};

export type CalendarNowLine = {
  top: number;
  label: string;
};

export type CalendarMonthDay = {
  day: number;
  dateKey: string;
  muted: boolean;
  today: boolean;
  events: Array<{
    id: string;
    timeLabel: string;
    title: string;
    name: string;
    type: CalendarWeekEvent["type"];
    status: CalendarWeekEvent["status"];
  }>;
};

export type CalendarPageModel = {
  view: CalendarViewMode;
  rangeLabel: string;
  stats: CalendarStatItem[];
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
  monthDays: CalendarMonthDay[];
  hours: string[];
  typeColors: Record<string, CalendarTypeColor>;
  nowLine: CalendarNowLine | null;
  miniCalendar: {
    monthLabel: string;
    days: CalendarMiniDay[];
  };
  agenda: {
    dateLabel: string;
    count: number;
    items: CalendarAgendaItem[];
  };
  nextAppointment: CalendarNextAppointment | null;
  timezoneLabel: string;
  unavailableBlocks?: CalendarUnavailableBlock[];
  showAvailabilityOverlay?: boolean;
};

export type CalendarPageActions = {
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  onNewAppointment: () => void;
  onCheckAvailability: () => void;
  onOpenAppointment: (id: string) => void;
  onSelectDay: (dateKey: string) => void;
  onMiniCalendarPrev: () => void;
  onMiniCalendarNext: () => void;
  onViewFullDay: () => void;
  onShowCalendarSettings: () => void;
  onRetry: () => void;
  onSlotClick?: (input: { dateKey: string; hour: number }) => void;
  onRescheduleEvent?: (input: { id: string; startsAt: string }) => void | Promise<void>;
  onToggleAvailabilityOverlay?: () => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
};
