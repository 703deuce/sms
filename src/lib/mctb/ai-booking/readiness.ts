import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { auditMctbAiBookingProvider } from "@/lib/mctb/ai-booking/capabilities";
import { getBookingContext } from "@/lib/mctb/ai-booking/service";

export type MctbAiBookingReadiness = {
  ready: boolean;
  reason?: string;
  fallbackUrl: string | null;
  providerConnected: boolean;
  schedulingTargetSelected: boolean;
};

export async function evaluateMctbAiBookingReadiness(
  workspaceId: string,
): Promise<MctbAiBookingReadiness> {
  const config = await loadMctbAiBookingConfig(workspaceId);
  const fallbackUrl = await resolveFallbackBookingUrl(workspaceId, config);
  if (!config.enabled) {
    return { ready: false, reason: "disabled", fallbackUrl, providerConnected: false, schedulingTargetSelected: false };
  }
  const caps = await auditMctbAiBookingProvider(workspaceId, config.provider);
  const { context } = await getBookingContext(workspaceId);

  const schedulingTargetSelected =
    config.provider === "calendly"
      ? Boolean(config.eventTypeUri || config.eventTypeId)
      : config.provider === "microsoft"
        ? Boolean(config.calendarId || context.calendarId || config.serviceName)
        : false;

  if (!context.connected) {
    return {
      ready: false,
      reason: "provider_disconnected",
      fallbackUrl,
      providerConnected: false,
      schedulingTargetSelected,
    };
  }
  if (!caps.aiBookingSupported) {
    return {
      ready: false,
      reason: "provider_unsupported",
      fallbackUrl,
      providerConnected: true,
      schedulingTargetSelected,
    };
  }
  if (!schedulingTargetSelected) {
    return {
      ready: false,
      reason: "scheduling_target_missing",
      fallbackUrl,
      providerConnected: true,
      schedulingTargetSelected: false,
    };
  }
  return {
    ready: true,
    fallbackUrl,
    providerConnected: true,
    schedulingTargetSelected: true,
  };
}
