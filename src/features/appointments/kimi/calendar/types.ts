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
};

export type CalendarNowLine = {
  top: number;
  label: string;
};

export type CalendarPageModel = {
  view: CalendarViewMode;
  rangeLabel: string;
  stats: CalendarStatItem[];
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
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
};

export type CalendarPageActions = {
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  onNewAppointment: () => void;
  onOpenAppointment: (id: string) => void;
  onSelectDay: (dateKey: string) => void;
  onMiniCalendarPrev: () => void;
  onMiniCalendarNext: () => void;
  onViewFullDay: () => void;
  onShowCalendarSettings: () => void;
  onRetry: () => void;
};
