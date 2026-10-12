const CANCELED_STATUSES = new Set(["canceled", "cancelled", "no_show", "no-show"]);

export type PublicSelfServiceBlockReason =
  | "canceled"
  | "completed"
  | "past"
  | "not_scheduled";

export function assessPublicSelfServiceEligibility(input: {
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
  now?: Date;
}): { allowed: true } | { allowed: false; reason: PublicSelfServiceBlockReason } {
  const status = (input.status || "").toLowerCase();
  if (CANCELED_STATUSES.has(status)) {
    return { allowed: false, reason: "canceled" };
  }
  if (status === "completed" || status === "done") {
    return { allowed: false, reason: "completed" };
  }
  const now = input.now || new Date();
  const end = input.endsAt || input.startsAt;
  if (end.getTime() < now.getTime()) {
    return { allowed: false, reason: "past" };
  }
  if (status && !["scheduled", "confirmed", "pending", "tentative"].includes(status)) {
    return { allowed: false, reason: "not_scheduled" };
  }
  return { allowed: true };
}
