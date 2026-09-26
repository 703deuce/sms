import assert from "node:assert/strict";
import {
  buildEmptyAvailabilityGuidance,
  summarizeOpenWeekdays,
} from "../src/lib/voice-v3/calendar/empty-availability-guidance";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";

const baseConfig = {
  timezone: "America/New_York",
  business: { hoursDisplay: "Mon–Fri 9–5" },
  operatingPolicy: {
    revision: 1,
    businessSchedule: {
      timezone: "America/New_York",
      weekly: {
        monday: { closed: false, ranges: [{ start: "09:00", end: "17:00" }] },
        tuesday: { closed: false, ranges: [{ start: "09:00", end: "17:00" }] },
        wednesday: { closed: false, ranges: [{ start: "09:00", end: "17:00" }] },
        thursday: { closed: false, ranges: [{ start: "09:00", end: "17:00" }] },
        friday: { closed: false, ranges: [{ start: "09:00", end: "17:00" }] },
        saturday: { closed: true, ranges: [] },
        sunday: { closed: true, ranges: [] },
      },
      holidays: [],
    },
    afterHoursBehavior: {
      useOperatingStateDuringCalls: true,
      whenClosed: {
        allowLiveBooking: true,
        allowCallbackRequest: true,
        allowMessageTaking: true,
        allowOnCallEscalation: false,
        allowOfficeTransfer: false,
        allowNormalTransferDestinations: false,
      },
    },
    onCallSchedule: { enabled: false, entries: [] },
    callbackSla: {
      normalTarget: "next_business_day",
      normalCustomMinutes: null,
      urgentTarget: "asap",
      urgentCustomMinutes: null,
    },
  },
} as unknown as VoiceV3AgentConfig;

const ctx = createInitialVoiceV3CallContext({
  callId: "test",
  liveSessionId: "live_test",
  timezone: "America/New_York",
});

const saturdayCtx = {
  ...ctx,
  scheduling: {
    ...ctx.scheduling,
    meaning: {
      ...ctx.scheduling.meaning!,
      weekday: "SATURDAY" as const,
      date_relation: "THIS_WEEKDAY" as const,
    },
    normalized: {
      timezone: "America/New_York",
      localDate: "2026-09-26",
      localStartDateTime: null,
      localEndDateTime: null,
      utcStart: null,
      utcEnd: null,
      sourceDateExpression: "Saturday",
      sourceTimeExpression: null,
      precision: "DATE_ONLY" as const,
    },
  },
};

assert.equal(summarizeOpenWeekdays(baseConfig.operatingPolicy!.businessSchedule!), "Monday through Friday");

const sat = buildEmptyAvailabilityGuidance(baseConfig, saturdayCtx);
assert.equal(sat.reason, "CLOSED_WEEKDAY");
assert.equal(sat.requestedDayLabel, "Saturday");
assert.match(sat.safeAgentMessage, /not open for appointments/i);
assert.match(sat.safeAgentMessage, /Monday through Friday/i);
assert.match(sat.safeAgentMessage, /callback/i);

console.log("test-voice-v3-empty-availability-guidance: PASS");
