#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "../src/lib/mctb/ai-booking/readiness";
import { hasOAuthTokens, type CalendarConfig } from "@/lib/voice/calendar/providers";

async function main() {
  const prisma = getPrisma();
  const conns = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: "ws_1", provider: "microsoft" },
    orderBy: { updatedAt: "desc" },
  });
  console.log("Microsoft VoiceCalendarConnection count:", conns.length);
  for (const c of conns) {
    const cfg = (c.config || {}) as CalendarConfig;
    console.log({
      id: c.id,
      name: c.name,
      status: c.status,
      email: c.email,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
      hasOAuthTokens: hasOAuthTokens(cfg),
      lastTokenRefreshError: cfg.lastTokenRefreshError,
      tokenExpiresAt: cfg.tokenExpiresAt,
      lastTokenRefreshAt: cfg.lastTokenRefreshAt,
      lastTokenRefreshSource: (cfg as Record<string, unknown>).lastTokenRefreshSource,
    });
  }

  const cfg = await loadMctbAiBookingConfig("ws_1");
  console.log("\nMCTB AI booking config:", {
    provider: cfg.provider,
    enabled: cfg.enabled,
    entitled: cfg.entitled,
    calendarId: cfg.calendarId,
    providerConnectionId: cfg.providerConnectionId,
    serviceName: cfg.serviceName,
    eventTypeUri: cfg.eventTypeUri,
  });

  const readiness = await evaluateMctbAiBookingReadiness("ws_1");
  console.log("\nReadiness now:", readiness);

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: "ws_1", e164: "+15714073615" },
    select: { id: true, e164: true, voiceAgentId: true },
  });
  console.log("\nPhone +15714073615:", phone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
