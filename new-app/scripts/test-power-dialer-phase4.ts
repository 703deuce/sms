/**
 * Phase 4 unit checks — merge fields, VM drop mock, callback tabs, disposition idempotency, call filters.
 */
import assert from "node:assert/strict";
import { renderMergeTemplate } from "../lib/server/phone/power-dialer/merge-fields";
import { startVoicemailDropPlayback } from "../lib/server/phone/power-dialer/voicemail-drop-playback";
import { buildCallbackTabWhere, dayBoundsUtc } from "../lib/server/phone/power-dialer/callback-tab-filters";
import { parseHasRecordingParam } from "../lib/server/phone/power-dialer/call-list-filters";
import { applyDispositionEffects } from "../lib/server/phone/power-dialer/disposition-effects";

process.env.NODE_ENV = "test";
process.env.POWER_DIALER_VM_DROP_MOCK = "1";

async function testMerge() {
  const out = renderMergeTemplate("Hi {{first_name}} at {{company}}", {
    firstName: "Ada",
    company: "Acme",
  });
  assert.equal(out, "Hi Ada at Acme");
  console.log("merge-fields: PASS");
}

async function testVmMock() {
  const r = await startVoicemailDropPlayback({
    telnyxCallControlId: "ctrl_test",
    audioUrl: "https://example.com/a.mp3",
  });
  assert.equal(r.mocked, true);
  console.log("voicemail-drop-mock: PASS");
}

function testCallbackTabs() {
  const now = new Date("2026-10-23T15:00:00.000Z");
  const { startOfDay, endOfDay } = dayBoundsUtc(now);
  assert.ok(startOfDay < endOfDay);
  const overdue = buildCallbackTabWhere("ws1", "overdue", now);
  assert.equal(overdue.workspaceId, "ws1");
  assert.equal((overdue.scheduledAt as { lt: Date }).lt.getTime(), startOfDay.getTime());
  const due = buildCallbackTabWhere("ws1", "due_today", now);
  assert.equal(due.status, "scheduled");
  console.log("callback-tab-filters: PASS");
}

function testCallListFilters() {
  assert.equal(parseHasRecordingParam("1"), true);
  assert.equal(parseHasRecordingParam("false"), false);
  assert.equal(parseHasRecordingParam(undefined), undefined);
  console.log("call-list-filters: PASS");
}

async function testDispositionIdempotency() {
  let contactUpdates = 0;
  const prisma = {
    contact: {
      updateMany: async () => {
        contactUpdates += 1;
        return { count: 1 };
      },
    },
    powerDialerAttempt: { update: async () => ({}) },
  };
  await applyDispositionEffects(prisma as never, {
    workspaceId: "w",
    attemptId: "a",
    contactId: "c",
    campaignId: "camp",
    disposition: "Do not call",
    dispositionDef: { addToDnc: true } as never,
    alreadyApplied: true,
  });
  assert.equal(contactUpdates, 0);
  await applyDispositionEffects(prisma as never, {
    workspaceId: "w",
    attemptId: "a",
    contactId: "c",
    campaignId: "camp",
    disposition: "Do not call",
    dispositionDef: { addToDnc: true } as never,
    alreadyApplied: false,
  });
  assert.equal(contactUpdates, 1);
  console.log("disposition-idempotency: PASS");
}

async function main() {
  await testMerge();
  await testVmMock();
  testCallbackTabs();
  testCallListFilters();
  await testDispositionIdempotency();
  console.log("test-power-dialer-phase4: ALL PASS");
}
main();
