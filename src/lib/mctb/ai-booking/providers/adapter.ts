import type {
  CreateBookingRequest,
  CreateBookingResult,
  FindAvailableTimesRequest,
  FindAvailableTimesResult,
  MctbAiBookingProviderId,
  MctbBookingContext,
  BookingStatusResult,
} from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";

/** Provider adapter — four product operations; no LLM / no direct Graph from conversation layer. */
export type MctbAiBookingProviderAdapter = {
  id: MctbAiBookingProviderId;
  getBookingContext(
    workspaceId: string,
    config: MctbAiBookingWorkspaceConfig,
  ): Promise<MctbBookingContext>;
  findAvailableTimes(
    ctx: MctbBookingContext,
    config: MctbAiBookingWorkspaceConfig,
    req: FindAvailableTimesRequest,
  ): Promise<FindAvailableTimesResult>;
  createBooking(
    ctx: MctbBookingContext,
    config: MctbAiBookingWorkspaceConfig,
    req: CreateBookingRequest,
    resolvedSlot: { startUtc: string; endUtc: string; slotId: string },
  ): Promise<CreateBookingResult>;
  getBookingStatus(
    workspaceId: string,
    config: MctbAiBookingWorkspaceConfig,
    providerBookingId: string,
  ): Promise<BookingStatusResult>;
};
