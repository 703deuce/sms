export type SlotDiagnosticsStaffOption = {
  id: string;
  name: string;
};

export type SlotDiagnosticsContext = {
  serviceName?: string;
  startsAt?: string;
  staffId?: string;
  lockServiceName?: boolean;
};

export type SlotDiagnosticsPanelProps = {
  context?: SlotDiagnosticsContext;
  staffOptions?: SlotDiagnosticsStaffOption[];
  variant?: "page" | "drawer";
  onOpenFullPage?: () => void;
};
