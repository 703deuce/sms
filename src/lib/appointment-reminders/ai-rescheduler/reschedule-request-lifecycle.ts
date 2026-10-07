import type { ArRescheduleRequestMeta } from "./business-approval";

export function isArRescheduleRequestPending(req: ArRescheduleRequestMeta | undefined): boolean {
  if (!req) return false;
  return req.status === "pending_approval" || req.status === "pending_business" || req.status === "processing";
}

export function expireArRescheduleRequestIfNeeded(
  req: ArRescheduleRequestMeta,
  now = new Date(),
): ArRescheduleRequestMeta {
  if (!req.proposedStartsAt) return req;
  if (req.status !== "pending_approval" && req.status !== "pending_business") return req;
  if (new Date(req.proposedStartsAt).getTime() > now.getTime()) return req;
  return { ...req, status: "expired" };
}
