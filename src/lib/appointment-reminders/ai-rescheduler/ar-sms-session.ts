import { parseConversationState } from "@/lib/appointments/ai-scheduling/conversation-state";
import { parseReminderContexts } from "./reminder-reply-context-store";

const ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

export function hasActiveArReminderSmsSession(customFields: unknown): boolean {
  const state = parseConversationState(customFields);
  if (state?.activeIntent === "RESCHEDULE" && state.appointmentId) {
    const updated = new Date(state.updatedAt).getTime();
    if (Date.now() - updated <= ACTIVE_MS) return true;
  }
  const contexts = parseReminderContexts(customFields);
  if (!contexts.length) return false;
  const latest = contexts[0];
  if (!latest) return false;
  return Date.now() - new Date(latest.sentAt).getTime() <= ACTIVE_MS;
}
