export type PollOption = {
  id: string;
  startsAt: string;
  endsAt: string;
  votes: number;
};

export type PollStatus = "open" | "scheduled" | "closed" | "draft";

export type MeetingPoll = {
  id: string;
  title: string;
  status: PollStatus;
  createdAt: string;
  closesAt: string | null;
  location: string;
  durationMinutes: number;
  organizer: string;
  invitees: number;
  responded: number;
  shareUrl: string;
  winningOptionId?: string;
  options: PollOption[];
};

function iso(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

export const MOCK_POLLS: MeetingPoll[] = [
  {
    id: "poll_01",
    title: "Q3 Planning — Team Sync",
    status: "open",
    createdAt: iso(-86400000 * 3),
    closesAt: iso(86400000 * 2),
    location: "Zoom",
    durationMinutes: 45,
    organizer: "Sarah Chen",
    invitees: 8,
    responded: 5,
    shareUrl: "https://book.transovo.com/p/q3-planning",
    winningOptionId: "o1b",
    options: [
      { id: "o1a", startsAt: iso(86400000), endsAt: iso(86400000 + 2700000), votes: 2 },
      { id: "o1b", startsAt: iso(86400000 * 2 + 3600000), endsAt: iso(86400000 * 2 + 6300000), votes: 4 },
      { id: "o1c", startsAt: iso(86400000 * 3), endsAt: iso(86400000 * 3 + 2700000), votes: 1 },
    ],
  },
  {
    id: "poll_02",
    title: "Vendor Onboarding Call",
    status: "open",
    createdAt: iso(-86400000 * 6),
    closesAt: iso(86400000 * 5),
    location: "Google Meet",
    durationMinutes: 30,
    organizer: "Marcus Webb",
    invitees: 4,
    responded: 4,
    shareUrl: "https://book.transovo.com/p/vendor-onboarding",
    winningOptionId: "o2a",
    options: [
      { id: "o2a", startsAt: iso(86400000 * 4), endsAt: iso(86400000 * 4 + 1800000), votes: 3 },
      { id: "o2b", startsAt: iso(86400000 * 4 + 86400000 / 2), endsAt: iso(86400000 * 4 + 86400000 / 2 + 1800000), votes: 1 },
    ],
  },
  {
    id: "poll_03",
    title: "Design Review — Booking Page Refresh",
    status: "scheduled",
    createdAt: iso(-86400000 * 10),
    closesAt: iso(-86400000 * 2),
    location: "Office — Room 4B",
    durationMinutes: 60,
    organizer: "Sarah Chen",
    invitees: 6,
    responded: 6,
    shareUrl: "https://book.transovo.com/p/design-review",
    winningOptionId: "o3b",
    options: [
      { id: "o3a", startsAt: iso(86400000 * 6), endsAt: iso(86400000 * 6 + 3600000), votes: 2 },
      { id: "o3b", startsAt: iso(86400000 * 7 + 3600000), endsAt: iso(86400000 * 7 + 7200000), votes: 5 },
      { id: "o3c", startsAt: iso(86400000 * 8), endsAt: iso(86400000 * 8 + 3600000), votes: 1 },
    ],
  },
  {
    id: "poll_04",
    title: "Customer Success — Monthly Check-in",
    status: "closed",
    createdAt: iso(-86400000 * 20),
    closesAt: iso(-86400000 * 12),
    location: "Zoom",
    durationMinutes: 30,
    organizer: "Priya Nair",
    invitees: 5,
    responded: 5,
    shareUrl: "https://book.transovo.com/p/cs-checkin",
    options: [
      { id: "o4a", startsAt: iso(-86400000 * 9), endsAt: iso(-86400000 * 9 + 1800000), votes: 4 },
      { id: "o4b", startsAt: iso(-86400000 * 8), endsAt: iso(-86400000 * 8 + 1800000), votes: 1 },
    ],
  },
];

export const STATUS_META: Record<PollStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "chip chip-open" },
  scheduled: { label: "Time confirmed", className: "chip chip-scheduled" },
  closed: { label: "Closed", className: "chip chip-closed" },
  draft: { label: "Draft", className: "chip chip-draft" },
};
