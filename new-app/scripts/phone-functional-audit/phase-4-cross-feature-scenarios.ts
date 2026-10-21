/**
 * Phase 4 — cross-feature simulations (executable, no PSTN).
 * Invoked by run-full-audit.mjs via tsx.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rejectDirectE164Loop } from "@/lib/server/phone/routing/destination-validation";
import {
  extractGatherDigits,
  simultaneousRaceLost,
  shouldTrySequentialOnHangup,
  parseFallbackJson,
} from "@/lib/server/phone/routing/routing-logic";
import { parseHolidayExceptions } from "@/lib/server/phone/routing/holiday-schedule";

export type AuditRecord = (
  testId: string,
  feature: string,
  executed: string,
  expected: string,
  actual: string,
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_IMPLEMENTED",
  evidence?: string,
) => void;

function runScenario(
  record: AuditRecord,
  testId: string,
  name: string,
  fn: () => void,
) {
  try {
    fn();
    record(testId, "Cross-feature", name, "scenario completes", "ok", "PASS");
  } catch (err) {
    record(
      testId,
      "Cross-feature",
      name,
      "scenario completes",
      err instanceof Error ? err.message : String(err),
      "FAIL",
      err instanceof Error ? err.stack : undefined,
    );
  }
}

export async function runPhase4Scenarios(record: AuditRecord) {
  runScenario(record, "S-01", "Forwarding loop rejected (direct E.164)", () => {
    assert.throws(() => rejectDirectE164Loop("+15551234567", "+15551234567"));
  });

  runScenario(record, "S-02", "Auto-attendant DTMF extract", () => {
    assert.equal(extractGatherDigits({ digits: "12" }), "2");
    assert.equal(extractGatherDigits({}), "");
  });

  runScenario(record, "S-03", "Simultaneous ring first-answer-wins (race lost)", () => {
    assert.equal(simultaneousRaceLost("winner", "loser"), true);
    assert.equal(simultaneousRaceLost("same", "same"), false);
  });

  runScenario(record, "S-04", "Sequential forwarding tries next on hangup", () => {
    assert.equal(
      shouldTrySequentialOnHangup({
        simultaneous: false,
        queueLength: 2,
        outboundControlId: "leg-1",
      }),
      true,
    );
  });

  runScenario(record, "S-05", "Holiday forward fallback parse", () => {
    const fb = parseFallbackJson({ type: "forward_phone", destinationE164: "+15550001111" });
    assert.equal(fb?.destinationE164, "+15550001111");
    const holidays = parseHolidayExceptions([
      { date: "2026-12-25", mode: "forward", destinationRef: { kind: "external_phone", e164PhoneNumber: "+15551230000" } },
    ]);
    assert.equal(holidays[0]?.date, "2026-12-25");
  });

  runScenario(record, "S-06", "Webhook retry dedup (code path present)", () => {
    const webhook = readFileSync(
      path.join(process.cwd(), "app/api/telnyx/phone/route.ts"),
      "utf8",
    );
    assert.match(webhook, /telnyxWebhookDedup/);
    assert.match(webhook, /deduped/);
  });

  const db = Boolean(process.env.DATABASE_URL?.trim());
  if (!db) {
    const dbScenarios: Array<[string, string]> = [
      ["S-07", "Inbound → browser ring → answer → history (DB integration)"],
      ["S-08", "Inbound → forwarding → answer"],
      ["S-09", "Inbound → forwarding → voicemail"],
      ["S-10", "Inbound → ring group → third answers"],
      ["S-11", "Inbound → auto attendant → DTMF → forward"],
      ["S-12", "After hours → conversational IVR → callback"],
      ["S-13", "Power dialer session resume"],
      ["S-14", "Concurrent workspaces isolation"],
      ["S-15", "Indirect forwarding loop guard (graph walk)"],
    ];
    for (const [id, label] of dbScenarios) {
      record(
        id,
        "Cross-feature",
        label,
        "DATABASE_URL",
        "missing",
        "BLOCKED",
        "Run npm run test:phone:audit:server-db (hydrates DATABASE_URL from production web container).",
      );
    }
    return;
  }

  const { runPhase4DbScenarios } = await import("./phase-4-db-scenarios.ts");
  await runPhase4DbScenarios(record);
}
