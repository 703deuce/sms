export type EmployeeAccessState = {
  kind: "smart_routing_employee";
  accessSessionId: string;
  workspaceId: string;
  awaiting?: "pin" | "menu" | "confirm" | "manual_entry" | "dashboard_connect";
  outboundCallId?: string;
};

export function encodeEmployeeAccessState(state: EmployeeAccessState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function decodeEmployeeAccessState(raw?: string): EmployeeAccessState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as EmployeeAccessState;
    if (parsed?.kind === "smart_routing_employee" && parsed.accessSessionId) return parsed;
    return null;
  } catch {
    return null;
  }
}
