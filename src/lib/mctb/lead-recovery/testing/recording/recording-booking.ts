import type { MctbAiBookingProviderAdapter } from "@/lib/mctb/ai-booking/providers/adapter";
import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbBookingContext,
  BookingStatusResult,
} from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";
import { isLeadRecoveryE2eMode } from "@/lib/mctb/lead-recovery/testing/recording/e2e-mode";

export type RecordingBookingBehavior =
  | "success"
  | "no_availability"
  | "slot_taken"
  | "disconnected"
  | "timeout"
  | "temporary_failure"
  | "permanent_failure";

export type RecordedBookingCall = {
  kind: "find_slots" | "create_booking" | "status";
  conversationId?: string;
  slotId?: string;
  timestamp: string;
};

const ledger: RecordedBookingCall[] = [];
let behavior: RecordingBookingBehavior = "success";
let findDelayMs = 0;

const DEFAULT_SLOTS = [
  {
    slotId: "cert-slot-1",
    startUtc: "2026-09-14T14:00:00.000Z",
    endUtc: "2026-09-14T15:00:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 10 AM",
  },
  {
    slotId: "cert-slot-2",
    startUtc: "2026-09-14T17:00:00.000Z",
    endUtc: "2026-09-14T18:00:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 1 PM",
  },
  {
    slotId: "cert-slot-3",
    startUtc: "2026-09-14T19:30:00.000Z",
    endUtc: "2026-09-14T20:30:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 3:30 PM",
  },
];

export function resetRecordingBookingLedger() {
  ledger.length = 0;
  behavior = "success";
  findDelayMs = 0;
}

export function getRecordingBookingLedger(): readonly RecordedBookingCall[] {
  return ledger;
}

export function setRecordingBookingBehavior(b: RecordingBookingBehavior) {
  behavior = b;
}

export function setRecordingBookingFindDelay(ms: number) {
  findDelayMs = ms;
}

export function isRecordingBookingMode(): boolean {
  return isLeadRecoveryE2eMode();
}

export const recordingAiBookingAdapter: MctbAiBookingProviderAdapter = {
  id: "microsoft",
  async getBookingContext(_workspaceId, _config): Promise<MctbBookingContext> {
    if (behavior === "disconnected") {
      return {
        provider: "microsoft",
        connected: false,
        healthy: false,
        timezone: "America/New_York",
        durationMinutes: 60,
      };
    }
    return {
      provider: "microsoft",
      connected: true,
      healthy: true,
      timezone: "America/New_York",
      durationMinutes: 60,
    };
  },
  async findAvailableTimes(
    ctx,
    _config,
    req: FindAvailableTimesRequest,
  ): Promise<FindAvailableTimesResult> {
    if (findDelayMs > 0) await new Promise((r) => setTimeout(r, findDelayMs));
    ledger.push({
      kind: "find_slots",
      conversationId: req.conversationId,
      timestamp: new Date().toISOString(),
    });
    if (behavior === "disconnected" || !ctx.connected) {
      return { ok: false, reason: "Provider disconnected", fallbackRecommended: true };
    }
    if (behavior === "timeout") {
      return { ok: false, reason: "Provider timeout", fallbackRecommended: true };
    }
    if (behavior === "no_availability") {
      return { ok: false, reason: "No slots", fallbackRecommended: true };
    }
    if (behavior === "temporary_failure" || behavior === "permanent_failure") {
      return { ok: false, reason: "Provider error", fallbackRecommended: true };
    }
    return {
      ok: true,
      provider: "microsoft",
      slots: DEFAULT_SLOTS,
      queriedWindow: { startUtc: req.windowStartUtc, endUtc: req.windowEndUtc },
    };
  },
  async createBooking(_ctx, _config, req: CreateBookingRequest, resolvedSlot): Promise<CreateBookingResult> {
    ledger.push({
      kind: "create_booking",
      conversationId: req.conversationId,
      slotId: resolvedSlot.slotId,
      timestamp: new Date().toISOString(),
    });
    if (behavior === "slot_taken") {
      return { ok: false, reason: "Slot no longer available", fallbackRecommended: true };
    }
    if (behavior === "permanent_failure") {
      return { ok: false, reason: "Permanent booking failure", fallbackRecommended: false };
    }
    if (behavior === "temporary_failure") {
      return { ok: false, reason: "Temporary booking failure", fallbackRecommended: true };
    }
    return {
      ok: true,
      provider: "microsoft",
      providerBookingId: `cert-booking-${ledger.length}`,
      startUtc: resolvedSlot.startUtc,
      endUtc: resolvedSlot.endUtc,
    };
  },
  async getBookingStatus(): Promise<BookingStatusResult> {
    ledger.push({ kind: "status", timestamp: new Date().toISOString() });
    return { ok: true, status: "confirmed" };
  },
};
