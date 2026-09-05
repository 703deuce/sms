import type {
  BookingQuestion,
  CancellationPolicy,
  ReschedulePolicy,
  StaffAssignmentMode,
} from "@/lib/appointments/types";

export type AppointmentTypeQuestion = {
  id: string;
  label: string;
  type: string;
  required: boolean;
};

export type AppointmentTypeItem = {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
  free: boolean;
  active: boolean;
  isLive: boolean;
  color: string;
  bg: string;
  description: string;
  location: string;
  bufferMin: number;
  slug: string;
  created: string;
  updated: string;
  questions: AppointmentTypeQuestion[];
};

export type AppointmentTypeFormState = {
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  description: string;
  location: string;
  locationId: string;
  locationIds: string[];
  priceDisplay: string;
  showPriceOnBooking: boolean;
  bookingHours: string;
  minimumBookingNoticeMinutes: number;
  maximumBookingDaysAhead: number;
  enabled: boolean;
  bookingQuestions: BookingQuestion[];
  staffAssignment: StaffAssignmentMode;
  staffIds: string[];
  collectiveStaffIds: string[];
  cancellationPolicy: CancellationPolicy;
  reschedulePolicy: ReschedulePolicy;
  paymentMode: "none" | "deposit" | "full";
  paymentProvider: "stripe" | "square" | "";
  paymentPriceCents: number;
  paymentDepositCents: number;
  paymentDepositPercent: number;
  paymentCurrency: string;
  groupBookingEnabled: boolean;
  groupCapacity: number;
  recurringEnabled: boolean;
  recurringFrequencies: Array<"weekly" | "biweekly" | "monthly">;
  maxBookingsPerDay?: number;
  maxBookingsPerWeek?: number;
  maxPerTypePerDay?: number;
  transovoVideoEnabled?: boolean;
  videoMaxParticipants?: number;
  videoRequireGuestEmail?: boolean;
  videoRequireHost?: boolean;
  videoWaitingRoom?: boolean;
  videoRecordingMode?: "off" | "manual" | "automatic";
  videoTranscription?: boolean;
  videoAiRecap?: boolean;
  notetakerEnabled?: boolean;
  notetakerAutoJoin?: boolean;
  notetakerTranscript?: boolean;
  notetakerSummary?: boolean;
  notetakerActionItems?: boolean;
  notetakerSummaryTemplate?: string;
};

export type AppointmentTypesPageModel = {
  types: AppointmentTypeItem[];
  visibleTypes: AppointmentTypeItem[];
  selectedId: string | null;
  selected: AppointmentTypeItem | null;
  showInactive: boolean;
  form: AppointmentTypeFormState;
  isCreating: boolean;
  workspaceSlug: string;
  bookingEnabled: boolean;
  bookingBaseUrl: string | null;
  searchQuery: string;
  saving: boolean;
  error: string;
  copiedId: string | null;
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
};

export type AppointmentTypesPageActions = {
  onSelectType: (id: string) => void;
  onNewType: () => void;
  onBackToList: () => void;
  onToggleShowInactive: () => void;
  onSearchChange: (query: string) => void;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleActive: (active: boolean) => void;
  onCopyLink: (id: string) => void;
  onViewBookingPage: () => void;
  onManageAvailability: () => void;
  onManageStaff: () => void;
  onManageLocations: () => void;
  onRetry: () => void;
};
