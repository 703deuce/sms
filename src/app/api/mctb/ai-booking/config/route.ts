import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadMctbAiBookingConfig,
  saveMctbAiBookingConfig,
} from "@/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { getBookingProviders } from "@/lib/mctb/ai-booking/service";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { listMctbAiBookingSchedulingTargets } from "@/lib/mctb/ai-booking/provider-targets";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    if (url.searchParams.get("targets") === "1") {
      const provider = url.searchParams.get("provider") || "microsoft";
      const targets = await listMctbAiBookingSchedulingTargets(auth.workspaceId, provider);
      return NextResponse.json({ data: { targets } });
    }
    const [config, readiness, providers] = await Promise.all([
      loadMctbAiBookingConfig(auth.workspaceId),
      evaluateMctbAiBookingReadiness(auth.workspaceId),
      getBookingProviders(auth.workspaceId),
    ]);
    return NextResponse.json({
      data: { config, readiness, providers, entitled: await hasMctbAiBookingEntitlement(auth.workspaceId) },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const entitled = await hasMctbAiBookingEntitlement(auth.workspaceId);
    if (body.enabled === true && !entitled) {
      return NextResponse.json({ error: "AI Booking upgrade required" }, { status: 403 });
    }
    const config = await saveMctbAiBookingConfig(auth.workspaceId, {
      enabled: body.enabled === true,
      provider: typeof body.provider === "string" ? (body.provider as "microsoft" | "calendly" | "zoho") : undefined,
      providerConnectionId:
        typeof body.providerConnectionId === "string" ? body.providerConnectionId : undefined,
      eventTypeId: typeof body.eventTypeId === "string" ? body.eventTypeId : undefined,
      eventTypeUri: typeof body.eventTypeUri === "string" ? body.eventTypeUri : undefined,
      calendarId: typeof body.calendarId === "string" ? body.calendarId : undefined,
      serviceName: typeof body.serviceName === "string" ? body.serviceName : undefined,
      durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
      fallbackBookingLinkId:
        typeof body.fallbackBookingLinkId === "string" ? body.fallbackBookingLinkId : undefined,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    });
    const readiness = await evaluateMctbAiBookingReadiness(auth.workspaceId);
    return NextResponse.json({ data: { config, readiness } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
