import type { BookableStaffMember } from "@/lib/appointments/types";

export type StaffListItem = {
  id: string;
  name: string;
  active: boolean;
  customerSelectable: boolean;
  typeCount: number;
  locationCount: number;
};

export type StaffEditorTab = "details" | "availability" | "assignments" | "calendar";

export type StaffRoundRobinStat = {
  serviceKey: string;
  assignmentCount: number;
  lastAssigned?: boolean;
};

export type StaffDayRow = {
  key: string;
  label: string;
  usesWorkspaceDefault: boolean;
  windows: Array<{ open: string; close: string }>;
};

export type StaffPageModel = {
  staff: StaffListItem[];
  visibleStaff: StaffListItem[];
  selectedId: string | null;
  selected: BookableStaffMember | null;
  searchQuery: string;
  editorTab: StaffEditorTab;
  appointmentTypes: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  dayRows: StaffDayRow[];
  roundRobinStats: StaffRoundRobinStat[];
  saving: boolean;
  saved: boolean;
  error: string;
};

export type StaffPageActions = {
  onSearchChange: (value: string) => void;
  onSelectStaff: (id: string) => void;
  onAddStaff: () => void;
  onRemoveStaff: (id: string) => void;
  onTabChange: (tab: StaffEditorTab) => void;
  onNameChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
  onCustomerSelectableChange: (value: boolean) => void;
  onToggleTypeId: (typeId: string) => void;
  onToggleLocationId: (locationId: string) => void;
  onSetCustomHours: (dayKey: string, enabled: boolean) => void;
  onUpdateWindow: (dayKey: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (dayKey: string) => void;
  onCalendarColorChange: (value: string) => void;
  onSave: () => void;
  onRetry: () => void;
};
