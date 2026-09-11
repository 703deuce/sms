import { randomBytes } from "crypto";
import type {
  MeetingPoll,
  MeetingPollActivityEntry,
  MeetingPollParticipant,
  MeetingPollSettings,
  MeetingPollStatus,
} from "@/lib/appointments/scheduling-capabilities";

export const DEFAULT_POLL_SETTINGS: MeetingPollSettings = {
  allowMaybe: true,
  allowComments: true,
  allowResponseChanges: true,
  showNamesToParticipants: false,
  showAggregateBeforeResponse: true,
  deadlineBehavior: "mark_passed",
  requireOrganizerFreeOnFinalize: true,
  autoReminderHoursBeforeDeadline: 24,
};

function newId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function mapLegacyStatus(status: string | undefined): MeetingPollStatus {
  if (status === "booked" || status === "scheduled") return "finalized";
  if (status === "draft" || status === "open" || status === "closed") return status;
  if (status === "finalized" || status === "expired" || status === "cancelled") return status;
  return "open";
}

/** Normalize polls persisted before the coordination subsystem expansion. */
export function normalizeMeetingPoll(raw: MeetingPoll): MeetingPoll {
  const now = new Date().toISOString();
  const status = mapLegacyStatus(raw.status);
  return {
    ...raw,
    description: raw.description || "",
    timezone: raw.timezone || "America/New_York",
    durationMinutes: raw.durationMinutes || 30,
    participants: raw.participants || [],
    responses: raw.responses || [],
    settings: { ...DEFAULT_POLL_SETTINGS, ...(raw.settings || {}) },
    activity: raw.activity || [],
    status,
    shareToken: raw.shareToken || newId("ptok"),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
    options: (raw.options || []).map((o) => ({
      ...o,
      votes: o.votes,
    })),
  };
}

export function appendPollActivity(
  poll: MeetingPoll,
  entry: Omit<MeetingPollActivityEntry, "id" | "at"> & { at?: string },
): MeetingPoll {
  const activity: MeetingPollActivityEntry = {
    id: newId("act"),
    at: entry.at || new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail,
  };
  return {
    ...poll,
    activity: [activity, ...(poll.activity || [])].slice(0, 200),
    updatedAt: new Date().toISOString(),
  };
}

export function createParticipant(input: { name: string; email: string; contactId?: string }): MeetingPollParticipant {
  return {
    id: newId("part"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    contactId: input.contactId,
    inviteToken: randomBytes(18).toString("base64url"),
    status: "invited",
  };
}

export function touchPoll(poll: MeetingPoll): MeetingPoll {
  return { ...poll, updatedAt: new Date().toISOString() };
}

export function publicPollUrl(workspaceSlug: string, shareToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.transovo.com";
  return `${base.replace(/\/$/, "")}/book/${workspaceSlug}/poll/${shareToken}`;
}

export function participantPollUrl(workspaceSlug: string, inviteToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.transovo.com";
  return `${base.replace(/\/$/, "")}/book/${workspaceSlug}/poll/vote/${inviteToken}`;
}

export function isPollPastAllOptions(poll: MeetingPoll): boolean {
  const active = poll.options.filter((o) => !o.archivedAt);
  if (!active.length) return false;
  const now = Date.now();
  return active.every((o) => new Date(o.endsAt).getTime() < now);
}

export function derivePollStatus(poll: MeetingPoll): MeetingPollStatus {
  if (poll.status === "finalized" || poll.status === "cancelled" || poll.status === "closed") {
    return poll.status;
  }
  if (poll.status === "draft") return "draft";
  if (isPollPastAllOptions(poll)) return "expired";
  if (poll.deadlineAt && poll.settings.deadlineBehavior === "auto_close") {
    if (new Date(poll.deadlineAt).getTime() < Date.now()) return "closed";
  }
  return poll.status === "open" ? "open" : poll.status;
}
