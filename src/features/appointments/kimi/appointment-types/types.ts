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
  priceDisplay: string;
  showPriceOnBooking: boolean;
  bookingHours: string;
  minimumBookingNoticeMinutes: number;
  maximumBookingDaysAhead: number;
  enabled: boolean;
  customQuestion: string;
  customQuestionRequired: boolean;
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
  onRetry: () => void;
};
