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

  if (!config.enabled || config.upgradeRequired) {
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

export async function createBooking(req: CreateBookingRequest): Promise<CreateBookingResult> {
  const { config, context, capabilities } = await getBookingContext(req.workspaceId);
  if (!config.enabled || config.upgradeRequired) {
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

  const adapter = getMctbAiBookingAdapter(config.provider);
  const result = await adapter.createBooking(context, config, req, {
    slotId: slot.slotId,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
  });

  if (result.ok) {
    await getMctbAiBookingSessionStore().clear(req.conversationId);
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
