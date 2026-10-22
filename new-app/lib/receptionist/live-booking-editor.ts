import type { AgentConfig, AfterHoursBehaviorConfig } from "@/lib/agent";

/** Live calendar FIND/BOOK (not link-only or request-only). */
export function isEditorLiveBookingEnabled(editor: AgentConfig): boolean {
  return (
    editor.capabilities.book === true &&
    editor.appointments.strategy === "live" &&
    editor.appointments.provider !== "none"
  );
}

/** Keeps stored editor policy consistent; runtime no longer gates FIND/BOOK on after-hours when book is on. */
export function alignAfterHoursBehaviorForLiveBooking(
  behavior: AfterHoursBehaviorConfig,
  bookLive: boolean,
): AfterHoursBehaviorConfig {
  if (!bookLive) return behavior;
  return {
    ...behavior,
    whenClosed: {
      ...behavior.whenClosed,
      allowLiveBooking: true,
    },
  };
}

/** Live FIND/BOOK requires Full Receptionist runtime — not conversational IVR tool surface. */
export function alignRuntimeProfileForLiveBooking(editor: AgentConfig): AgentConfig {
  if (!isEditorLiveBookingEnabled(editor)) return editor;
  if (editor.runtimeProfile === "full_receptionist") return editor;
  return { ...editor, runtimeProfile: "full_receptionist" };
}
