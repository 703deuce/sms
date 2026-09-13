import { getConnection } from "@/lib/integrations/connections";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";
import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbBookingContext,
  BookingStatusResult,
} from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingProviderAdapter } from "@/lib/mctb/ai-booking/providers/adapter";

/**
 * Zoho in Transovo today is CRM (contacts/deals), not a calendar scheduling API.
 * Adapter exists so the product interface is stable when/if calendar scopes ship.
 */
export const zohoAiBookingAdapter: MctbAiBookingProviderAdapter = {
  id: "zoho",

  async getBookingContext(workspaceId, config) {
    const conn = await getConnection(workspaceId, "zoho");
    const connected = Boolean(conn && conn.status === "connected");
    return {
      provider: "zoho",
      connected,
      healthy: false,
      timezone: config.timezone || "America/New_York",
      durationMinutes: 30,
      fallbackBookingLinkId: config.fallbackBookingLinkId,
    };
  },

  async findAvailableTimes(_ctx, _config, _req): Promise<FindAvailableTimesResult> {
    return {
      ok: false,
      reason: "Zoho calendar scheduling is not implemented — CRM connection only",
      fallbackRecommended: true,
    };
  },

  async createBooking(_ctx, _config, _req): Promise<CreateBookingResult> {
    return {
      ok: false,
      reason: "Zoho AI Booking is not supported",
      fallbackRecommended: true,
    };
  },

  async getBookingStatus(): Promise<BookingStatusResult> {
    return { ok: false, reason: "Zoho AI Booking is not supported" };
  },
};
