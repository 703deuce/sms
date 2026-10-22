import type { AgentConfig, AfterHoursBehaviorConfig } from "@/lib/agent";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";

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

/** Send-booking-link (no live calendar) uses the same full agent surface as live booking. */
export function isEditorLinkBookingEnabled(editor: AgentConfig): boolean {
  if (!editor.capabilities.book) return false;
  return editor.appointments.strategy === "link" || isBookingLinkOnlyLaunch();
}

/** Live FIND/BOOK and link booking require Full Receptionist — not conversational IVR tool surface. */
export function alignRuntimeProfileForLiveBooking(editor: AgentConfig): AgentConfig {
  const needsFull =
    isEditorLiveBookingEnabled(editor) || isEditorLinkBookingEnabled(editor);
  if (!needsFull) return editor;
  if (editor.runtimeProfile === "full_receptionist") return editor;
  return { ...editor, runtimeProfile: "full_receptionist" };
}
