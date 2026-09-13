import type { E2eTurnTrace } from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import type { RecordedBookingCall } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import type { RecordedPaymentCall } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import type { RecordedHandoffCall } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";

export type CertScenarioTraceRecord = {
  scenarioId: string;
  group: string;
  status: "PASS" | "FAIL";
  failureClass?: string;
  failureDetail?: string;
  turns: E2eTurnTrace[];
  bookingLedger: RecordedBookingCall[];
  paymentLedger: RecordedPaymentCall[];
  handoffLedger: RecordedHandoffCall[];
  notes?: string;
};

let activeScenarioId: string | null = null;
let activeTurns: E2eTurnTrace[] = [];

export function certResultsTraceEnabled(): boolean {
  return process.env.LR_CERT_RESULTS_DUMP === "1";
}

export function beginCertScenarioTrace(scenarioId: string): void {
  if (!certResultsTraceEnabled()) return;
  activeScenarioId = scenarioId;
  activeTurns = [];
}

export function recordCertTurnTrace(turn: E2eTurnTrace): void {
  if (!certResultsTraceEnabled() || !activeScenarioId) return;
  activeTurns.push(turn);
}

export function endCertScenarioTrace(input: {
  scenarioId: string;
  group: string;
  status: "PASS" | "FAIL";
  failureClass?: string;
  failureDetail?: string;
  bookingLedger: RecordedBookingCall[];
  paymentLedger: RecordedPaymentCall[];
  handoffLedger: RecordedHandoffCall[];
  notes?: string;
}): CertScenarioTraceRecord | null {
  if (!certResultsTraceEnabled()) return null;
  const record: CertScenarioTraceRecord = {
    scenarioId: input.scenarioId,
    group: input.group,
    status: input.status,
    failureClass: input.failureClass,
    failureDetail: input.failureDetail,
    turns: [...activeTurns],
    bookingLedger: [...input.bookingLedger],
    paymentLedger: [...input.paymentLedger],
    handoffLedger: [...input.handoffLedger],
    notes: input.notes,
  };
  activeScenarioId = null;
  activeTurns = [];
  return record;
}

const allRecords: CertScenarioTraceRecord[] = [];

export function pushCertScenarioRecord(record: CertScenarioTraceRecord): void {
  if (!certResultsTraceEnabled()) return;
  allRecords.push(record);
}

export function getCertScenarioRecords(): CertScenarioTraceRecord[] {
  return [...allRecords];
}

export function resetCertScenarioRecords(): void {
  allRecords.length = 0;
  activeScenarioId = null;
  activeTurns = [];
}
