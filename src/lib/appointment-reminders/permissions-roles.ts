import type { AppointmentRemindersPermission } from "@/lib/appointment-reminders/permissions-types";

const AR_PERMS: AppointmentRemindersPermission[] = [
  "appointment_reminders.read",
  "appointment_reminders.write",
  "appointment_reminders.settings",
  "appointment_reminders.calendar",
  "appointment_reminders.test",
];

export function defaultArPermissionsForRole(roleId: string): AppointmentRemindersPermission[] {
  if (roleId === "viewer") {
    return ["appointment_reminders.read"];
  }
  if (roleId === "scheduler") {
    return [
      "appointment_reminders.read",
      "appointment_reminders.write",
      "appointment_reminders.calendar",
      "appointment_reminders.test",
    ];
  }
  return [...AR_PERMS];
}
