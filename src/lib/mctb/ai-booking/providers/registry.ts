import type { MctbAiBookingProviderId } from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingProviderAdapter } from "@/lib/mctb/ai-booking/providers/adapter";
import { calendlyAiBookingAdapter } from "@/lib/mctb/ai-booking/providers/calendly";
import { microsoftAiBookingAdapter } from "@/lib/mctb/ai-booking/providers/microsoft";
import { zohoAiBookingAdapter } from "@/lib/mctb/ai-booking/providers/zoho";

const ADAPTERS: Record<MctbAiBookingProviderId, MctbAiBookingProviderAdapter> = {
  microsoft: microsoftAiBookingAdapter,
  calendly: calendlyAiBookingAdapter,
  zoho: zohoAiBookingAdapter,
};

export function getMctbAiBookingAdapter(
  provider: MctbAiBookingProviderId,
): MctbAiBookingProviderAdapter {
  const { isRecordingBookingMode, recordingAiBookingAdapter } = require(
    "@/lib/mctb/lead-recovery/testing/recording/recording-booking",
  ) as typeof import("@/lib/mctb/lead-recovery/testing/recording/recording-booking");
  if (isRecordingBookingMode()) {
    return recordingAiBookingAdapter;
  }
  return ADAPTERS[provider];
}

export function listMctbAiBookingAdapters(): MctbAiBookingProviderAdapter[] {
  return Object.values(ADAPTERS);
}
