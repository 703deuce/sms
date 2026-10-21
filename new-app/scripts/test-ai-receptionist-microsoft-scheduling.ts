#!/usr/bin/env npx tsx
/**
 * Microsoft scheduling path with mocked Graph (requires preload-microsoft-scheduling-mock.mjs).
 */
import assert from "node:assert/strict";
import { defaultReceptionistEditorConfig } from "@/lib/server/receptionist/defaults";
import * as scheduling from "@/lib/server/voice-v3/scheduling/service";
import * as appointments from "@/lib/server/voice-v3/scheduling/appointments";

async function main() {
  process.env.AI_RECEPTIONIST_MS_SCHEDULING_MOCK = "1";
  const {
    resetMicrosoftSchedulingVerifyState,
    microsoftSchedulingVerifyState,
  } = await import("@/lib/server/voice-v3/scheduling/microsoft-scheduling-verify-mock");
  resetMicrosoftSchedulingVerifyState();

  const editor = {
    ...defaultReceptionistEditorConfig(),
    runtimeProfile: "full_receptionist" as const,
    capabilities: {
      ...defaultReceptionistEditorConfig().capabilities,
      book: true,
      reschedule: true,
      cancel: true,
    },
  };
  editor.appointments = {
    ...editor.appointments,
    strategy: "live",
    provider: "microsoft",
    types: editor.appointments.types.map((t) => ({ ...t, enabled: true, duration: 30 })),
  };

  const state: scheduling.SchedulingSessionState = {};
  const tz = "America/Chicago";

  const find = await scheduling.findAvailability({
    workspaceId: "ws_verify",
    editor,
    timezone: tz,
    state,
  });
  assert.equal(find.ok, true);
  assert.ok(find.slots && find.slots.length > 0);

  const firstSlot = find.slots![0];
  microsoftSchedulingVerifyState.busy.push({
    start: firstSlot.startTimeIso,
    end: new Date(new Date(firstSlot.startTimeIso).getTime() + 30 * 60_000).toISOString(),
  });

  const findConflict = await scheduling.findAvailability({
    workspaceId: "ws_verify",
    editor,
    timezone: tz,
    state: {},
  });
  assert.equal(findConflict.ok, true);
  const conflictSlot = findConflict.slots?.find((s) => s.startTimeIso === firstSlot.startTimeIso);
  assert.ok(!conflictSlot, "busy block removes conflicting slot");

  const book = await scheduling.bookAppointment({
    workspaceId: "ws_verify",
    editor,
    slotId: firstSlot.slotId,
    attendeeName: "Verify Caller",
    state,
  });
  assert.equal(book.ok, true);
  assert.equal(microsoftSchedulingVerifyState.createdEvents.length, 1);

  state.verifiedAppointment = {
    provider: "microsoft",
    providerEventId: microsoftSchedulingVerifyState.createdEvents[0].id,
    startTimeIso: firstSlot.startTimeIso,
    endTimeIso: new Date(new Date(firstSlot.startTimeIso).getTime() + 30 * 60_000).toISOString(),
    selectionId: "sel_1",
    attendeeName: "Verify Caller",
  };
  const newSlot = findConflict.slots?.[0];
  assert.ok(newSlot);
  state.lastOfferedSlots = [newSlot];

  const resched = await appointments.rescheduleAppointment({
    workspaceId: "ws_verify",
    editor,
    slotId: newSlot.slotId,
    state,
  });
  assert.equal(resched.ok, true);
  assert.equal(microsoftSchedulingVerifyState.patchCount, 1);

  const cancel = await appointments.cancelAppointment({
    workspaceId: "ws_verify",
    editor,
    state,
    confirmed: true,
  });
  assert.equal(cancel.ok, true);
  assert.equal(microsoftSchedulingVerifyState.deleteCount, 1);

  console.log("Microsoft scheduling mock suite: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
