export function logIntakeTelemetry(
  event:
    | "INTAKE_UPDATE_REQUESTED"
    | "INTAKE_UPDATE_VALIDATED"
    | "INTAKE_FIELDS_UPDATED"
    | "INTAKE_FIELDS_REJECTED"
    | "INTAKE_OBJECTIVE_CHANGED"
    | "INTAKE_OBJECTIVE_COMPLETED",
  payload: Record<string, unknown>,
): void {
  console.log(event, payload);
}
