import type { AgentConfig, Capability } from "@/lib/agent";

/** Documents how new-app UI screens map to runtime — single source for certification. */
export const RECEPTIONIST_EDITOR_SCREEN_FIELDS = {
  agent: [
    "identity.name",
    "identity.role",
    "identity.language",
    "identity.voice",
    "identity.customVoiceId",
    "identity.greeting",
    "style",
    "capabilities",
    "intake",
    "qualification",
    "instructions",
  ],
  knowledge: ["knowledgeProfile"],
  call_handling: [
    "connection",
    "coverage",
    "transfers",
    "triggers",
    "transferStyle",
    "messages",
    "protection",
    "audio",
  ],
  appointments: ["appointments"],
} as const;

export function enabledVoiceToolNamesFromEditor(editor: AgentConfig): string[] {
  const names: string[] = ["update_intake", "end_call"];
  const on = (c: Capability) => editor.capabilities[c] === true;
  const bookLive =
    on("book") &&
    editor.appointments.strategy === "live" &&
    editor.appointments.provider !== "none";
  const bookLink = on("book") && editor.appointments.strategy === "link";

  if (bookLive || (on("reschedule") && bookLive)) {
    names.push("set_scheduling_preference", "find_availability");
  }
  if (bookLive) {
    names.push("book_appointment");
  }
  if (bookLink) {
    names.push("send_booking_link");
  }
  if (on("reschedule") && bookLive) {
    names.push("find_appointment", "reschedule_appointment");
  }
  if (on("cancel") && bookLive) {
    names.push("find_appointment", "cancel_appointment");
  }
  if (on("transfer")) names.push("transfer_call");
  if (on("message")) names.push("request_callback");
  if (on("answer")) names.push("search_business_knowledge");
  if (editor.protection.some((r) => r.enabled && r.kind === "solicitor")) {
    names.push("report_unwanted_solicitor");
  }
  return [...new Set(names)];
}
