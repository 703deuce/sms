import "server-only";

import {
  dispatchAppointmentWorkflowTrigger,
  invalidateWorkflowExecutionsForAppointment,
  rescheduleWorkflowStepsForAppointment,
  type WorkflowTriggerEvent,
} from "./engine";

/** Map appointment lifecycle events to workflow triggers. */
export async function onAppointmentBooked(
  workspaceId: string,
  appointmentId: string,
  contactId?: string | null,
) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_booked",
    contactId,
  });
}

export async function onAppointmentConfirmed(workspaceId: string, appointmentId: string) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_confirmed",
  });
}

export async function onAppointmentRescheduled(workspaceId: string, appointmentId: string) {
  await rescheduleWorkflowStepsForAppointment(workspaceId, appointmentId);
}

export async function onAppointmentCanceled(workspaceId: string, appointmentId: string) {
  await invalidateWorkflowExecutionsForAppointment(
    workspaceId,
    appointmentId,
    "appointment_canceled",
  );
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_canceled",
  });
}

export async function onAppointmentCompleted(workspaceId: string, appointmentId: string) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_completed",
  });
}

export async function onAppointmentNoShow(workspaceId: string, appointmentId: string) {
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_no_show",
  });
}

export async function onAppointmentStatusChanged(
  workspaceId: string,
  appointmentId: string,
  newStatus: string,
) {
  const normalized = newStatus.toLowerCase();
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_status_changed",
  });

  if (normalized === "confirmed") {
    await onAppointmentConfirmed(workspaceId, appointmentId);
  } else if (normalized === "canceled" || normalized === "cancelled") {
    await onAppointmentCanceled(workspaceId, appointmentId);
  } else if (normalized === "completed") {
    await onAppointmentCompleted(workspaceId, appointmentId);
  } else if (normalized === "no_show" || normalized === "no-show") {
    await onAppointmentNoShow(workspaceId, appointmentId);
  }
}

export async function emitWorkflowTrigger(event: WorkflowTriggerEvent) {
  await dispatchAppointmentWorkflowTrigger(event);
}
