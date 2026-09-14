import { buildStateBasedInitialAvailabilitySpecialist } from "../src/lib/voice/ai-booking/state-based-scheduling";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date().toISOString();
const tz = "America/New_York";

const fromWorkflow = buildStateBasedInitialAvailabilitySpecialist({
  timezone: tz,
  nowIso: now,
  voiceWorkflow: {
    session_id: "c1",
    workflow: "book_appointment",
    service_name: null,
    active_field: null,
    fields: {},
    derived: {},
    updated_at: now,
  },
  offeredSlots: [],
});
assert(fromWorkflow?.action === "CHECK_AVAILABILITY", "workflow book_appointment → CHECK_AVAILABILITY");

const withPhraseOnly = buildStateBasedInitialAvailabilitySpecialist({
  timezone: tz,
  nowIso: now,
  offeredSlots: [],
});
assert(withPhraseOnly === null, "no workflow/intent state → no shortcut");

console.log("test-state-based-scheduling: ok");
