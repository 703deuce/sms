export interface PreviewAppointmentType {
  id: string;
  name: string;
  duration: string;
  description: string;
}

export interface BusinessPreviewInfo {
  displayName: string;
  initials: string;
  phone: string;
  address: string;
}

export type ProtectionMode = "standard" | "strict" | "off";

export interface ProtectionModeOption {
  value: ProtectionMode;
  label: string;
  description: string;
}

export interface SuspiciousBooking {
  id: string;
  at: string;
  serviceName?: string;
  riskLevel: string;
  action: string;
  signals: string[];
}
