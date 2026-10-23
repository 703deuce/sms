import assert from "node:assert/strict";
import {
  resolveWaterfallActiveList,
  type QueueMemberRow,
} from "../lib/server/phone/power-dialer/standby-queue";
import {
  pickRoundRobinContactIds,
  nextRoundRobinPointer,
} from "../lib/server/phone/power-dialer/team-queue-claims";
import { parseDispositionActions } from "../lib/server/phone/power-dialer/disposition-actions";
import { parseCadenceSteps } from "../lib/server/phone/power-dialer/cadence-engine";

function member(listId: string, contactId: string): QueueMemberRow {
  return {
    id: `m-${contactId}`,
    listId,
    contactId,
    dialPriority: 0,
    queueSortOrder: 0,
    createdAt: new Date(),
    sourceListId: listId,
    sourceListName: listId,
    contact: {
      id: contactId,
      workspaceId: "w1",
      phone: "+15555550100",
      firstName: null,
      lastName: null,
      company: null,
      email: null,
      title: null,
      status: "SUBSCRIBED",
      timezone: "America/Chicago",
      timezoneInferred: false,
      customFields: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedUserId: null,
      crmCompanyId: null,
      folderId: null,
      phones: [],
    },
  };
}

async function main() {
  const chain = [{ id: "L1", name: "Primary" }, { id: "L2", name: "Standby" }];
  const rows = [member("L1", "c1"), member("L2", "c2")];
  const wf = resolveWaterfallActiveList(
    chain,
    rows,
    (m) => m.contactId === "c2",
    0,
  );
  assert.equal(wf.index, 1);
  assert.equal(wf.reason, "primary_exhausted");

  const rotated = pickRoundRobinContactIds(["a", "b", "c"], "rep2", ["rep1", "rep2", "rep3"], {
    teamQueuePointer: 1,
  });
  assert.deepEqual(rotated, ["b", "c", "a"]);
  assert.equal(nextRoundRobinPointer(2, 3), 0);

  const actions = parseDispositionActions({
    id: "d1",
    setId: "s1",
    label: "Test",
    category: "outcome",
    outcomeClass: null,
    colorHex: null,
    hotkey: null,
    answerContext: "any",
    sortOrder: 0,
    requireNotes: false,
    markConnected: false,
    markContactCompleted: false,
    scheduleCallback: false,
    removeFromQueue: false,
    addToDnc: false,
    triggerCrmUpdate: false,
    triggerFollowUp: false,
    actionsJson: [{ type: "tag", tagName: "Hot" }],
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "tag");

  const steps = parseCadenceSteps([
    { type: "wait", waitMinutes: 0 },
    { type: "sms", body: "hi" },
  ]);
  assert.equal(steps.length, 2);

  console.log("test-power-dialer-batch4-b3: PASS");
}

void main();
