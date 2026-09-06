export type TeamMember = {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  lastActive: string;
  status: "Active" | "Invited";
};

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string;
};

export const ROLES = [
  "Owner",
  "Administrator",
  "Manager",
  "Campaign creator",
  "Inbox agent",
  "Analyst",
  "Read only",
];

export const ROLE_DESCRIPTIONS: { role: string; desc: string; caps: string[] }[] = [
  {
    role: "Owner",
    desc: "Full workspace access including billing, security, and team management.",
    caps: ["All permissions", "Billing & plan", "Delete workspace"],
  },
  {
    role: "Administrator",
    desc: "Manage team, settings, integrations, and all operational areas.",
    caps: ["Manage team", "All settings", "All operational areas"],
  },
  {
    role: "Manager",
    desc: "Manage appointments, booking configuration, and view analytics.",
    caps: ["Appointments", "Booking setup", "Analytics"],
  },
  {
    role: "Inbox agent",
    desc: "Reply to conversations, assign threads, and manage contacts.",
    caps: ["Messages", "Contacts", "Saved replies"],
  },
  {
    role: "Analyst",
    desc: "View operational reports and export analytics data.",
    caps: ["Analytics", "Reports", "Exports"],
  },
  {
    role: "Read only",
    desc: "View-only access across permitted areas. Cannot make changes.",
    caps: ["View only", "No edits", "No invites"],
  },
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    membershipId: "mem_01",
    name: "Jordan Reeves",
    email: "jordan@brightdental.co",
    role: "Owner",
    isAdmin: true,
    lastActive: "Active now",
    status: "Active",
  },
  {
    membershipId: "mem_02",
    name: "Priya Nair",
    email: "priya@brightdental.co",
    role: "Administrator",
    isAdmin: true,
    lastActive: "12 min ago",
    status: "Active",
  },
  {
    membershipId: "mem_03",
    name: "Marcus Webb",
    email: "marcus@brightdental.co",
    role: "Manager",
    isAdmin: false,
    lastActive: "1 hour ago",
    status: "Active",
  },
  {
    membershipId: "mem_04",
    name: "Sofia Delgado",
    email: "sofia@brightdental.co",
    role: "Inbox agent",
    isAdmin: false,
    lastActive: "3 hours ago",
    status: "Active",
  },
  {
    membershipId: "mem_05",
    name: "Tom Albrecht",
    email: "tom@brightdental.co",
    role: "Analyst",
    isAdmin: false,
    lastActive: "Yesterday",
    status: "Active",
  },
];

export const PENDING_INVITES: PendingInvite[] = [
  {
    id: "inv_01",
    email: "dana@brightdental.co",
    role: "INBOX_AGENT",
    invitedByName: "Jordan Reeves",
    expiresAt: "2026-09-18T00:00:00Z",
  },
  {
    id: "inv_02",
    email: "lee.hargrove@brightdental.co",
    role: "READ_ONLY",
    invitedByName: "Priya Nair",
    expiresAt: "2026-09-21T00:00:00Z",
  },
];

export const SETTINGS_TABS = [
  { label: "Business", href: "/settings/business" },
  { label: "Team", href: "/settings/users" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Calendar", href: "/settings/calendar" },
  { label: "Meetings", href: "/settings/ai-notetaker" },
  { label: "Security", href: "/settings/security" },
  { label: "Billing", href: "/settings/billing" },
];

export const INVITE_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  CAMPAIGN_CREATOR: "Campaign creator",
  INBOX_AGENT: "Inbox agent",
  ANALYST: "Analyst",
  READ_ONLY: "Read only",
};
