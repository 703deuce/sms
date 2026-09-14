/**
 * MCTB AI Booking orchestration service.
 * Booking Link = messaging. AI Booking = availability + booking via provider adapters.
 */
import {
  loadMctbAiBookingConfig,
  resolveFallbackBookingUrl,
  type MctbAiBookingWorkspaceConfig,
} from "@/lib/mctb/ai-booking/config";
import { getBookingProviders, auditMctbAiBookingProvider } from "@/lib/mctb/ai-booking/capabilities";
import { getMctbAiBookingAdapter } from "@/lib/mctb/ai-booking/providers/registry";
import { getMctbAiBookingSessionStore, recordOfferedSlots } from "@/lib/mctb/ai-booking/session-store";
import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbBookingContext,
  BookingStatusResult,
} from "@/lib/mctb/ai-booking/types";

export { getBookingProviders };

export async function getBookingContext(workspaceId: string): Promise<{
  config: MctbAiBookingWorkspaceConfig;
  context: MctbBookingContext;
  capabilities: Awaited<ReturnType<typeof auditMctbAiBookingProvider>>;
  fallbackUrl: string | null;
}> {
  const config = await loadMctbAiBookingConfig(workspaceId);
  const adapter = getMctbAiBookingAdapter(config.provider);
  const context = await adapter.getBookingContext(workspaceId, config);
  const capabilities = await auditMctbAiBookingProvider(workspaceId, config.provider);
  const fallbackUrl = await resolveFallbackBookingUrl(workspaceId, config);
  return {
    config,
    context: { ...context, fallbackBookingUrl: fallbackUrl },
    capabilities,
    fallbackUrl,
  };
}

export async function findAvailableTimes(
  req: FindAvailableTimesRequest,
): Promise<FindAvailableTimesResult> {
  const { config, context, capabilities, fallbackUrl } = await getBookingContext(req.workspaceId);

  if (!config.enabled || !config.entitled || config.upgradeRequired) {
    return {
      ok: false,
      reason: "AI Booking is not enabled for this workspace",
      fallbackRecommended: true,
    };
  }
  if (!capabilities.aiBookingSupported || !context.connected || !context.healthy) {
    return {
      ok: false,
      reason: "Provider is not connected or does not support AI Booking",
      fallbackRecommended: true,
    };
  }

  const adapter = getMctbAiBookingAdapter(config.provider);
  const result = await adapter.findAvailableTimes(context, config, req);

  if (
    result.ok &&
    req.conversationId &&
    result.slots.length > 0
  ) {
    await recordOfferedSlots({
      workspaceId: req.workspaceId,
      conversationId: req.conversationId,
      provider: config.provider,
      slots: result.slots,
      window: result.queriedWindow,
    });
  }

  if (!result.ok && fallbackUrl) {
    return result;
  }
  return result;
}

const certBookingIdempotency = new Map<string, string>();

export function resetCertBookingIdempotency(): void {
  certBookingIdempotency.clear();
}

export async function createBooking(req: CreateBookingRequest): Promise<CreateBookingResult> {
  const certE2e = process.env.LR_CERT_E2E === "1";

  const idempotencyKeyEarly = `mctb-book:${req.conversationId}:${req.slotId}`;
  const { loadLeadRecoveryState } = await import("@/lib/mctb/lead-recovery/state-store");
  const lrBefore = await loadLeadRecoveryState({
    workspaceId: req.workspaceId,
    conversationId: req.conversationId,
  });
  if (lrBefore.processedActionKeys?.includes(idempotencyKeyEarly)) {
    const replayId = certE2e ? certBookingIdempotency.get(idempotencyKeyEarly) : null;
    if (replayId) {
      const session = await getMctbAiBookingSessionStore().get(req.conversationId);
      const slot =
        session?.offeredSlots.find((s) => s.slotId === req.slotId) ??
        ({ startUtc: "", endUtc: "" } as { startUtc: string; endUtc: string });
      return {
        ok: true,
        provider: (await getBookingContext(req.workspaceId)).config.provider,
        providerBookingId: replayId,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        timezone: (await getBookingContext(req.workspaceId)).context.timezone,
        status: "confirmed",
      };
    }
  }

  if (req.writeEpoch !== undefined) {
    const { preflightConsequentialAction } = await import(
      "@/lib/mctb/lead-recovery/provider-write-gate"
    );
    const pre = await preflightConsequentialAction({
      workspaceId: req.workspaceId,
      conversationId: req.conversationId,
      mutation: "CREATE_BOOKING",
      writeEpoch: req.writeEpoch,
      idempotencyKey: idempotencyKeyEarly,
    });
    if (!pre.ok && pre.condition !== "DUPLICATE_ACTION") {
      return {
        ok: false,
        reason: pre.condition,
        fallbackRecommended: true,
      };
    }
  }

  const { config, context, capabilities } = await getBookingContext(req.workspaceId);
  if (!config.enabled || !config.entitled || config.upgradeRequired) {
    return {
      ok: false,
      reason: "AI Booking is not enabled",
      fallbackRecommended: true,
    };
  }
  if (!capabilities.aiBookingSupported) {
    return {
      ok: false,
      reason: "Provider cannot create bookings",
      fallbackRecommended: true,
    };
  }

  const session = await getMctbAiBookingSessionStore().get(req.conversationId);
  const slot =
    session?.offeredSlots.find((s) => s.slotId === req.slotId) ?? null;
  if (!slot) {
    return {
      ok: false,
      reason: "Slot was not in the last provider availability response — re-check availability",
      fallbackRecommended: true,
    };
  }

  const idempotencyKey = `mctb-book:${req.conversationId}:${req.slotId}`;
  if (certE2e) {
    const replay = certBookingIdempotency.get(idempotencyKey);
    if (replay) {
      return {
        ok: true,
        provider: config.provider,
        providerBookingId: replay,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        timezone: context.timezone,
        status: "confirmed",
      };
    }
  } else {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    if (prisma.mctbAiBookingSession?.findUnique) {
      const existing = await prisma.mctbAiBookingSession.findUnique({
        where: { conversationId: req.conversationId },
      });
      if (existing?.idempotencyKey === idempotencyKey && existing.providerBookingId) {
        return {
          ok: true,
          provider: config.provider,
          providerBookingId: existing.providerBookingId,
          startUtc: slot.startUtc,
          endUtc: slot.endUtc,
          timezone: context.timezone,
          status: "confirmed",
        };
      }
    }
  }

  const revalidate = await findAvailableTimes({
    workspaceId: req.workspaceId,
    conversationId: req.conversationId,
    windowStartUtc: new Date(new Date(slot.startUtc).getTime() - 30 * 60_000).toISOString(),
    windowEndUtc: new Date(new Date(slot.startUtc).getTime() + 30 * 60_000).toISOString(),
    timezone: context.timezone,
    maxResults: 8,
  });
  if (revalidate.ok) {
    const still = revalidate.slots.some((s) => s.slotId === slot.slotId || s.startUtc === slot.startUtc);
    if (!still) {
      return {
        ok: false,
        reason: "slot_taken",
        fallbackRecommended: false,
      };
    }
  }

  if (!certE2e) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    if (prisma.mctbAiBookingSession?.updateMany) {
      await prisma.mctbAiBookingSession.updateMany({
        where: { conversationId: req.conversationId },
        data: { stage: "BOOKING", idempotencyKey },
      });
    }
  }

  const adapter = getMctbAiBookingAdapter(config.provider);
  const result = await adapter.createBooking(context, config, req, {
    slotId: slot.slotId,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
  });

  if (result.ok) {
    if (certE2e) {
      certBookingIdempotency.set(idempotencyKey, result.providerBookingId);
    }
    await getMctbAiBookingSessionStore().clear(req.conversationId);
    const { loadLeadRecoveryState, saveLeadRecoveryState } = await import(
      "@/lib/mctb/lead-recovery/state-store"
    );
    const lr = await loadLeadRecoveryState({
      workspaceId: req.workspaceId,
      conversationId: req.conversationId,
    });
    const keys = [...(lr.processedActionKeys ?? []), idempotencyKey].slice(-100);
    await saveLeadRecoveryState({
      ...lr,
      processedActionKeys: keys,
      pendingAction: null,
      phase: "COMPLETE",
    });
  }
  return result;
}

export async function getBookingStatus(
  workspaceId: string,
  providerBookingId: string,
): Promise<BookingStatusResult> {
  const config = await loadMctbAiBookingConfig(workspaceId);
  const adapter = getMctbAiBookingAdapter(config.provider);
  return adapter.getBookingStatus(workspaceId, config, providerBookingId);
}
