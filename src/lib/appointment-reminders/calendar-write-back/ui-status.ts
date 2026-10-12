import type { ArCalendarWriteBackRecord } from "./types";

export type ArCalendarWriteBackUiStatus = {
  state: "updated" | "pending" | "failed" | "disabled" | "unavailable";
  label: string;
  detail?: string;
  lastSucceededAt?: string;
  canRetry: boolean;
};

export function calendarWriteBackUiStatus(
  record: ArCalendarWriteBackRecord | null | undefined,
  opts?: { settingEnabled?: boolean; hasMicrosoftLink?: boolean },
): ArCalendarWriteBackUiStatus {
  if (opts?.settingEnabled === false) {
    return { state: "disabled", label: "Disabled", canRetry: false };
  }
  if (!opts?.hasMicrosoftLink) {
    return { state: "unavailable", label: "No writable calendar link", canRetry: false };
  }
  if (!record) {
    return { state: "unavailable", label: "Not updated yet", canRetry: false };
  }
  if (record.lastStatus === "pending") {
    return {
      state: "pending",
      label: "Pending update",
      lastSucceededAt: record.lastSucceededAt,
      canRetry: false,
    };
  }
  if (record.lastStatus === "failed") {
    return {
      state: "failed",
      label: "Unable to update",
      detail: record.lastError,
      lastSucceededAt: record.lastSucceededAt,
      canRetry: true,
    };
  }
  if (record.lastStatus === "succeeded") {
    return {
      state: "updated",
      label: "Updated in Outlook",
      lastSucceededAt: record.lastSucceededAt,
      canRetry: false,
    };
  }
  return {
    state: "unavailable",
    label: "Skipped",
    detail: record.lastError,
    canRetry: false,
  };
}
