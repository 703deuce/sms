import type { AppointmentWorkflowTrigger } from "./types";

export function triggerLabel(trigger: AppointmentWorkflowTrigger): string {
  const labels: Record<string, string> = {
    appointment_booked: "Appointment booked",
    appointment_confirmed: "Appointment confirmed",
    appointment_rescheduled: "Appointment rescheduled",
    appointment_canceled: "Appointment canceled",
    appointment_completed: "Appointment completed",
    appointment_no_show: "No-show",
    appointment_status_changed: "Status changed",
    before_appointment: "Before appointment",
    after_appointment: "After appointment",
    booking_requested: "Booking requested",
    booking_approved: "Booking approved",
    booking_rejected: "Booking rejected",
    payment_received: "Payment received",
    waitlist_slot_available: "Waitlist slot available",
  };
  return labels[trigger] || trigger;
}
