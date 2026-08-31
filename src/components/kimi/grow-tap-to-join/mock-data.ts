export interface Keyword {
  id: string;
  keyword: string;
  lastSaved: string;
  description: string;
  connectedLists: number;
  status: "Active" | "Inactive";
}

export interface TapLink {
  id: string;
  name: string;
  createdAt: string;
  keyword: string;
  number: string;
  fallbackUrl: string;
  status: "Active" | "Inactive";
  all: number;
  unique: number;
  bot: number;
  url: string;
}

export const keywords: Keyword[] = [
  {
    id: "kw-1",
    keyword: "Join",
    lastSaved: "Last saved on Oct 24th, 2025 @ 8:53 am",
    description: "",
    connectedLists: 0,
    status: "Inactive",
  },
  {
    id: "kw-2",
    keyword: "Send this text to get 30% off your next order",
    lastSaved: "Last saved on Oct 24th, 2025 @ 8:53 am",
    description: "",
    connectedLists: 0,
    status: "Active",
  },
  {
    id: "kw-3",
    keyword: "BlackFriday",
    lastSaved: "Last saved on Oct 24th, 2025 @ 8:53 am",
    description: "",
    connectedLists: 1,
    status: "Active",
  },
];

export const tapLinks: TapLink[] = [
  {
    id: "link-1",
    name: "Summer Sale Opt-In",
    createdAt: "Created on Oct 23rd, 2025 @ 11:17 am",
    keyword: "Join",
    number: "888-379-4654",
    fallbackUrl: "",
    status: "Active",
    all: 0,
    unique: 0,
    bot: 0,
    url: "https://trnv.io/2Xf81",
  },
];

export const navSections = [
  {
    label: null,
    items: [
      { key: "home", label: "Home", icon: "Home" },
      { key: "audience", label: "Audience", icon: "Users" },
      { key: "campaigns", label: "Campaigns", icon: "Megaphone" },
      { key: "inbox", label: "Inbox", icon: "Inbox" },
      { key: "workflows", label: "Workflows", icon: "Workflow" },
      { key: "analytics", label: "Analytics", icon: "BarChart3" },
    ],
  },
];

export const toolsSubNav = [
  { key: "keywords", label: "Keywords" },
  { key: "web-forms", label: "Web Forms" },
  { key: "website-popups", label: "Website Popups" },
  { key: "tap-to-join", label: "Tap-to-Join Links" },
  { key: "qr-codes", label: "QR Codes" },
  { key: "all-tools", label: "All Tools" },
];

export const stats = {
  totalContacts: 45,
  totalSubscribed: 42,
  unreadInbox: 0,
  messageCredits: "99,567",
};
