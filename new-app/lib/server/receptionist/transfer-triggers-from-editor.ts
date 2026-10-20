import type { AgentConfig } from "@/lib/agent";

/** Plain-language transfer triggers compiled for Astra + transfer policy. */
export function transferTriggerPhrasesFromEditor(editor: AgentConfig): string[] {
  const phrases: string[] = [];
  if (editor.triggers.asks_person) {
    phrases.push("Caller asks to speak with a person, staff member, or specific department");
  }
  if (editor.triggers.emergency) {
    phrases.push("Emergency or urgent clinical situation such as severe pain, swelling, trauma, or bleeding");
  }
  if (editor.triggers.unsupported) {
    phrases.push("Request the AI receptionist cannot complete with available tools");
  }
  if (editor.triggers.booking_staff) {
    phrases.push("Booking or scheduling that requires staff per business policy");
  }
  if (editor.triggers.custom) {
    const custom = editor.customTrigger?.trim();
    if (custom) phrases.push(custom);
  }
  return phrases;
}
