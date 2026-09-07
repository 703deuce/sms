export type SessionRow = {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
};

export const MOCK_SESSIONS: SessionRow[] = [
  {
    id: "ses_01",
    device: "MacBook Pro",
    browser: "Chrome 126 · macOS",
    location: "Woodbridge, VA, United States",
    ip: "73.141.88.204",
    lastActive: "Active now",
    current: true,
  },
  {
    id: "ses_02",
    device: "iPhone 15 Pro",
    browser: "Transovo Mobile · iOS",
    location: "Woodbridge, VA, United States",
    ip: "73.141.88.204",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: "ses_03",
    device: "Windows 11 Desktop",
    browser: "Edge 126 · Windows",
    location: "Richmond, VA, United States",
    ip: "98.26.114.71",
    lastActive: "Yesterday at 5:42 PM",
    current: false,
  },
];

export const MOCK_SECURITY_STATE = {
  totpEnabled: false,
  backupCodesRemaining: 0,
};

export const MOCK_BACKUP_CODES = [
  "k4f9-2hda-81mz",
  "p7q2-xw94-0vn3",
  "m2t8-6sjb-44kq",
  "z9c1-3yfu-77rw",
  "b5n6-8ghe-22px",
  "w0v4-1kla-59tn",
  "r3d7-5qcm-88jf",
  "h6s0-9tzb-31gy",
];

export const MOCK_MANUAL_SECRET = "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP";

export const SETTINGS_TABS = [
  { label: "Business", href: "/settings/business" },
  { label: "Team", href: "/settings/users" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Calendar", href: "/settings/calendar" },
  { label: "Meetings", href: "/settings/ai-notetaker" },
  { label: "Security", href: "/settings/security" },
  { label: "Billing", href: "/settings/billing" },
];
