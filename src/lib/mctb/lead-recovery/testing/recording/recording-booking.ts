import type { MctbAiBookingProviderAdapter } from "@/lib/mctb/ai-booking/providers/adapter";
import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbBookingContext,
  BookingStatusResult,
  MctbBookingSlot,
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
  | "permanent_failure"
  | "create_timeout";

export type RecordedBookingCall = {
  kind: "find_slots" | "create_booking" | "status";
  conversationId?: string;
  slotId?: string;
  timestamp: string;
};

const ledger: RecordedBookingCall[] = [];
let behavior: RecordingBookingBehavior = "success";
let findDelayMs = 0;
let createDelayMs = 0;
let findCallCount = 0;
let customSlots: MctbBookingSlot[] | null = null;
let revalidateOmitSlotId: string | null = null;
let createFailSlotIds = new Set<string>();

export const CERT_DEFAULT_SLOTS: MctbBookingSlot[] = [
  {
    slotId: "cert-slot-10am",
    startUtc: "2026-09-14T14:00:00.000Z",
    endUtc: "2026-09-14T15:00:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 10 AM",
  },
  {
    slotId: "cert-slot-1pm",
    startUtc: "2026-09-14T17:00:00.000Z",
    endUtc: "2026-09-14T18:00:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 1 PM",
  },
  {
    slotId: "cert-slot-3pm",
    startUtc: "2026-09-14T19:00:00.000Z",
    endUtc: "2026-09-14T20:00:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 3 PM",
  },
  {
    slotId: "cert-slot-430pm",
    startUtc: "2026-09-14T20:30:00.000Z",
    endUtc: "2026-09-14T21:30:00.000Z",
    timezone: "America/New_York",
    label: "Tomorrow 4:30 PM",
  },
];

function activeSlots(): MctbBookingSlot[] {
  return customSlots ? [...customSlots] : [...CERT_DEFAULT_SLOTS];
}

export function resetRecordingBookingLedger() {
  ledger.length = 0;
  behavior = "success";
  findDelayMs = 0;
  createDelayMs = 0;
  findCallCount = 0;
  customSlots = null;
  revalidateOmitSlotId = null;
  createFailSlotIds = new Set();
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

export function setRecordingBookingCreateDelay(ms: number) {
  createDelayMs = ms;
}

export function setRecordingBookingSlots(slots: MctbBookingSlot[]) {
  customSlots = slots;
}

export function setRecordingBookingRevalidateOmitsSlot(slotId: string | null) {
  revalidateOmitSlotId = slotId;
}

export function setRecordingBookingCreateFailsForSlots(slotIds: string[]) {
  createFailSlotIds = new Set(slotIds);
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
    findCallCount += 1;
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
    let slots = activeSlots();
    const wStart = new Date(req.windowStartUtc).getTime();
    const wEnd = new Date(req.windowEndUtc).getTime();
    if (!Number.isNaN(wStart) && !Number.isNaN(wEnd)) {
      slots = slots.filter((s) => {
        const t = new Date(s.startUtc).getTime();
        return t >= wStart && t <= wEnd;
      });
    }
    if (findCallCount > 1 && revalidateOmitSlotId) {
      slots = slots.filter((s) => s.slotId !== revalidateOmitSlotId);
    }
    return {
      ok: true,
      provider: "microsoft",
      slots,
      queriedWindow: { startUtc: req.windowStartUtc, endUtc: req.windowEndUtc },
    };
  },
  async createBooking(_ctx, _config, req: CreateBookingRequest, resolvedSlot): Promise<CreateBookingResult> {
    if (createDelayMs > 0) await new Promise((r) => setTimeout(r, createDelayMs));
    ledger.push({
      kind: "create_booking",
      conversationId: req.conversationId,
      slotId: resolvedSlot.slotId,
      timestamp: new Date().toISOString(),
    });
    if (behavior === "create_timeout") {
      return { ok: false, reason: "Provider timeout", fallbackRecommended: true };
    }
    if (behavior === "slot_taken" || createFailSlotIds.has(resolvedSlot.slotId)) {
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
      providerBookingId: `cert-booking-${ledger.filter((l) => l.kind === "create_booking").length}`,
      startUtc: resolvedSlot.startUtc,
      endUtc: resolvedSlot.endUtc,
    };
  },
  async getBookingStatus(): Promise<BookingStatusResult> {
    ledger.push({ kind: "status", timestamp: new Date().toISOString() });
    return { ok: true, status: "confirmed" };
  },
};
