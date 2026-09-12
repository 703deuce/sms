export type SchedulingConflictCode =
  | "SLOT_TAKEN"
  | "SELF_CONFLICT"
  | "NOT_IN_AVAILABILITY"
  | "STAFF_UNAVAILABLE"
  | "RESOURCE_UNAVAILABLE"
  | "CLIENT_OVERLAP"
  | "EXTERNAL_BUSY"
  | "BLACKOUT"
  | "TOO_SOON"
  | "OUTSIDE_WINDOW"
  | "BOOKING_LIMIT"
  | "GROUP_FULL"
  | "SERVICE_DISABLED"
  | "INVALID_TIME";

export class SchedulingConflictError extends Error {
  readonly code: SchedulingConflictCode;

  constructor(code: SchedulingConflictCode, message: string) {
    super(message);
    this.name = "SchedulingConflictError";
    this.code = code;
  }
}

export function isSchedulingConflictError(err: unknown): err is SchedulingConflictError {
  return err instanceof SchedulingConflictError;
}
