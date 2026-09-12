import { SchedulingConflictError } from "@/lib/appointments/scheduling-conflict-error";

export class SlotTakenError extends SchedulingConflictError {
  constructor(message = "That time slot is already booked.") {
    super("SLOT_TAKEN", message);
    this.name = "SlotTakenError";
  }
}
