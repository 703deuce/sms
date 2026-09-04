export type TimeWindow = { open: string; close: string };

export type DateOverride = {
  date: string;
  closed?: boolean;
  windows?: TimeWindow[];
};

export type DayScheduleRow = {
  key: string;
  day: string;
  open: boolean;
  windows: TimeWindow[];
  closedNote?: string;
};

export type OverrideRow = {
  isoDate: string;
  month: string;
  dayNum: string;
  date: string;
  type: "custom" | "closed";
  hours: string;
  note: string;
};

export type PreviewDayRow = {
  label: string;
  date: string;
  hours?: string;
  status: "open" | "closed" | "override";
};

export type SummaryItem = {
  icon: "globe" | "clock" | "calendar" | "calendar-range" | "sparkles";
  bg: string;
  color: string;
  title: string;
  value: string;
};

export type BookingRulesModel = {
  timezone: string;
  minimumNotice: number;
  minimumNoticeUnit: string;
  bookingHorizon: number;
  bookingHorizonUnit: string;
};

export type AvailabilityFormState = {
  weeklyHours: Record<string, TimeWindow[]>;
  dateOverrides: DateOverride[];
  timezone: string;
  minimumNotice: number;
  maximumDays: number;
  overrideDate: string;
  overrideClosed: boolean;
  overrideOpen: string;
  overrideClose: string;
};

export type AvailabilityPageModel = {
  weeklyHours: DayScheduleRow[];
  overrides: OverrideRow[];
  previewDays: PreviewDayRow[];
  summary: SummaryItem[];
  bookingRules: BookingRulesModel;
  form: AvailabilityFormState;
  saving: boolean;
  saved: boolean;
};

export type AvailabilityPageActions = {
  onTimezoneChange: (value: string) => void;
  onMinimumNoticeChange: (value: number) => void;
  onMaximumDaysChange: (value: number) => void;
  onUpdateWindow: (day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (day: string) => void;
  onRemoveWindow: (day: string, index: number) => void;
  onOverrideDateChange: (value: string) => void;
  onOverrideClosedChange: (value: boolean) => void;
  onOverrideOpenChange: (value: string) => void;
  onOverrideCloseChange: (value: string) => void;
  onAddOverride: () => void;
  onRemoveOverride: (date: string) => void;
  onSave: () => void;
  onRetry: () => void;
};
