/**
 * In-memory Microsoft Graph stand-in for automated verification only.
 * Enabled when AI_RECEPTIONIST_MS_SCHEDULING_MOCK=1 (test scripts only).
 */
import type { SchedulingBackend } from "./connections";

export function isMicrosoftSchedulingVerifyMock(): boolean {
  return process.env.AI_RECEPTIONIST_MS_SCHEDULING_MOCK === "1";
}

export const microsoftSchedulingVerifyState = {
  busy: [] as { start: string; end: string }[],
  patchCount: 0,
  deleteCount: 0,
  createdEvents: [] as { id: string; startIso: string }[],
};

export function resetMicrosoftSchedulingVerifyState() {
  microsoftSchedulingVerifyState.busy = [];
  microsoftSchedulingVerifyState.patchCount = 0;
  microsoftSchedulingVerifyState.deleteCount = 0;
  microsoftSchedulingVerifyState.createdEvents = [];
}

export function verifyMockSchedulingBackend(): SchedulingBackend {
  return {
    ok: true,
    provider: "microsoft",
    connectionId: "conn_mock_ms",
    calendarId: "cal_mock",
  };
}

export async function verifyMockGetBusy() {
  return microsoftSchedulingVerifyState.busy;
}

export async function verifyMockCreateEvent(input: { startIso: string }) {
  const id = `evt_${microsoftSchedulingVerifyState.createdEvents.length + 1}`;
  microsoftSchedulingVerifyState.createdEvents.push({ id, startIso: input.startIso });
  return { id };
}

export async function verifyMockPatchEventTimes() {
  microsoftSchedulingVerifyState.patchCount += 1;
}

export async function verifyMockDeleteEvent() {
  microsoftSchedulingVerifyState.deleteCount += 1;
}

export async function verifyMockListEvents() {
  return microsoftSchedulingVerifyState.createdEvents.map((e) => ({
    id: e.id,
    subject: "Appointment",
    start: e.startIso,
    end: new Date(new Date(e.startIso).getTime() + 30 * 60_000).toISOString(),
  }));
}
