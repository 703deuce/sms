/**
 * Voice V2 after-hours operating maturity headless cert.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-after-hours-maturity-headless.ts
 */
import assert from "node:assert/strict";

import { DEFAULT_VOICE_V2_BUSINESS_SCHEDULE } from "../src/lib/voice-receptionist-wizard/operating-maturity/defaults";
import { resolveVoiceV2OperatingState } from "../src/lib/voice-receptionist-wizard/operating-maturity/operating-state";
import { resolveActiveOnCallTarget } from "../src/lib/voice-receptionist-wizard/operating-maturity/on-call";
import { gateCapabilitiesForOperatingState } from "../src/lib/voice-receptionist-wizard/operating-maturity/behavior-gating";
import { normalizeVoiceV2ResolutionAudit } from "../src/lib/voice-receptionist-wizard/operating-maturity/resolution-audit";
import { detectRealtimeFrictionSignals } from "../src/lib/voice-receptionist-wizard/operating-maturity/friction";
import {
  computeCallbackDeadline,
  shouldMarkCallbackOverdue,
} from "../src/lib/voice-receptionist-wizard/operating-maturity/callback-sla";
import { runQualityStudioHeadless } from "../src/lib/voice-receptionist-wizard/operating-maturity/quality-studio";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "../src/lib/voice-receptionist-wizard/operating-maturity/defaults";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";

const schedule = {
  ...DEFAULT_VOICE_V2_BUSINESS_SCHEDULE,
  timezone: "America/New_York",
};

// Weekday closed evening
{
  const r = resolveVoiceV2OperatingState({
    schedule,
    at: "2026-09-16T03:00:00.000Z", // Tue 11pm EDT
  });
  assert.equal(r.state, "CLOSED_AFTER_HOURS");
}

// Holiday
{
  const r = resolveVoiceV2OperatingState({
    schedule: {
      ...schedule,
      holidays: [
        {
          id: "h1",
          name: "Thanksgiving",
          startDate: "2026-11-26",
          endDate: "2026-11-26",
          closedAllDay: true,
        },
      ],
    },
    at: "2026-11-26T15:00:00.000Z",
  });
  assert.equal(r.state, "HOLIDAY");
}

// Temporary closure
{
  const r = resolveVoiceV2OperatingState({
    schedule,
    liveTemporaryClosure: {
      active: true,
      startsAt: "2026-09-16T00:00:00.000Z",
      endsAt: "2026-09-17T00:00:00.000Z",
      reason: "Storm",
    },
    at: "2026-09-16T12:00:00.000Z",
  });
  assert.equal(r.state, "TEMPORARILY_CLOSED");
}

// On-call rotation
{
  const target = resolveActiveOnCallTarget({
    schedule: {
      enabled: true,
      timezone: "America/New_York",
      entries: [
        {
          id: "mon",
          name: "Mike",
          dayOfWeek: 1,
          startTime: "17:00",
          endTime: "08:00",
          priority: 1,
          enabled: true,
          destination: { label: "Mike", phoneE164: "+15551110001" },
        },
      ],
    },
    timestamp: "2026-09-15T02:00:00.000Z", // Mon 10 PM America/New_York
    operatingState: "CLOSED_AFTER_HOURS",
  });
  assert.equal(target?.label, "Mike");
}

// Operational override without republish
{
  const target = resolveActiveOnCallTarget({
    schedule: { enabled: true, timezone: "America/New_York", entries: [] },
    operationalOverride: {
      label: "Susan",
      effectiveUntil: "2026-09-17T12:00:00.000Z",
      destination: { label: "Susan", phoneE164: "+15552220002" },
    },
    timestamp: "2026-09-16T12:00:00.000Z",
  });
  assert.equal(target?.label, "Susan");
  assert.equal(target?.source, "OPERATIONAL_OVERRIDE");
}

// Gating — office transfer off after hours
{
  const ctx: VoiceV2CallContext = {
    sessionKey: "t",
    workspaceId: "w",
    agentId: "a",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: {
      transferToolAvailable: true,
      callbackToolAvailable: true,
      bookingEnabled: true,
      voiceV2PstnLiveBooking: true,
    },
  };
  const gates = gateCapabilitiesForOperatingState({
    ctx,
    operating: {
      state: "CLOSED_AFTER_HOURS",
      source: "WEEKLY_SCHEDULE",
      resolvedAt: new Date().toISOString(),
    },
    behavior: DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.afterHoursBehavior,
  });
  assert.equal(gates.officeTransferAllowed, false);
  assert.equal(gates.onCallEscalationAllowed, true);
}

// Resolution audit
{
  const status = normalizeVoiceV2ResolutionAudit({
    callMeta: { voiceV2MeaningfulUtterances: 0 },
    durationSeconds: 10,
  });
  assert.equal(status, "ABANDONED_BEFORE_INTENT");
}

// Friction re-ask
{
  const ctx: VoiceV2CallContext = {
    sessionKey: "t",
    workspaceId: "w",
    agentId: "a",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: {
      name: { value: "Pat", status: "CAPTURED", source: "CALLER", updatedAt: "" },
    },
    askedFields: { name: { count: 2, lastAskedAt: "" } },
    compiledAt: new Date().toISOString(),
  };
  const signals = detectRealtimeFrictionSignals({ ctx });
  assert.ok(signals.some((s) => s.type === "REPEATED_REASK"));
}

// Callback SLA overdue
{
  const created = new Date("2026-09-16T10:00:00.000Z");
  const deadline = computeCallbackDeadline({
    policy: DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.callbackSla,
    createdAt: created,
    urgency: "URGENT",
  });
  assert.ok(deadline.getTime() > created.getTime());
  const overdue = shouldMarkCallbackOverdue(
    {
      voiceV2CallbackSla: {
        lifecycle: "PENDING",
        promisedDeadline: "2026-09-16T09:00:00.000Z",
      },
    },
    new Date("2026-09-16T12:00:00.000Z"),
  );
  assert.equal(overdue, true);
}

// Quality studio NOT_APPLICABLE / publish blocker
{
  const bad = runQualityStudioHeadless({
    config: {
      ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG,
      onCallSchedule: { enabled: true, timezone: "America/New_York", entries: [] },
      afterHoursBehavior: {
        ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.afterHoursBehavior,
        whenClosed: {
          ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.afterHoursBehavior.whenClosed,
          allowOnCallEscalation: true,
        },
      },
    },
    bookingStrategy: "SEND_LINK",
    transferEnabled: true,
  });
  assert.ok(bad.publishBlockers.length > 0);
}

console.log("test-voice-v2-after-hours-maturity-headless: PASS");
