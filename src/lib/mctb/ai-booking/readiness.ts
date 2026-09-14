import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { auditMctbAiBookingProvider } from "@/lib/mctb/ai-booking/capabilities";
import { getBookingContext } from "@/lib/mctb/ai-booking/service";
import { getPrisma } from "@/lib/db";
import { hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";

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
  if (process.env.CERTIFICATION_READ_ONLY !== "1") {
    try {
      const { ensureMctbMicrosoftConnectionPointer } = await import(
        "@/lib/mctb/ai-booking/microsoft-connection"
      );
      await ensureMctbMicrosoftConnectionPointer(workspaceId);
    } catch {
      // readiness must not fail on heal errors
    }
  }
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
    let reason = "provider_unsupported";
    if (config.provider === "microsoft") {
      const { isMicrosoftOAuthConfigured } = await import("@/lib/microsoft/oauth-config");
      if (!isMicrosoftOAuthConfigured()) {
        reason = "microsoft_oauth_client_not_configured_on_host";
      } else {
        const connId = config.calendarId || config.providerConnectionId;
        const conn = connId
          ? await getPrisma().voiceCalendarConnection.findFirst({
              where: { id: connId, workspaceId, provider: "microsoft" },
              select: { status: true, config: true },
            })
          : null;
        const calCfg = (conn?.config || {}) as CalendarConfig;
        if (conn?.status === "needs_reauth") {
          reason = "microsoft_needs_reconnect";
        } else if (hasOAuthTokens(calCfg) && calCfg.lastTokenRefreshError) {
          reason = `microsoft_token_refresh_failed:${calCfg.lastTokenRefreshError}`;
        } else if (hasOAuthTokens(calCfg)) {
          reason = "microsoft_valid_access_token_unavailable";
        }
      }
    }
    return {
      ready: false,
      reason,
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
