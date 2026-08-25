import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  ensureSmartRoutingWorkspaceSettings,
  loadSmartRoutingWorkspaceSettings,
  updateSmartRoutingWorkspaceSettings,
} from "@/lib/smart-routing/workspace-settings";
import { getCallerIdVerificationStatus } from "@/lib/smart-routing/caller-id-verification";
import { listAuthorizedCallers } from "@/lib/smart-routing/authorized-callers";
import { listApprovedCallerIdentities } from "@/lib/smart-routing/caller-id-resolver";
import { CARRIER_FORWARDING_GUIDES } from "@/lib/smart-routing/forwarding-service";
import { computeSetupReadiness } from "@/lib/smart-routing/setup-readiness";
import { isCustomerSmartRoutingFlow } from "@/lib/smart-routing/flow-kind";
import { evaluateScheduleBranch } from "@/lib/smart-routing/schedule-engine";
import {
  assignCallbackPhoneNumber,
  assignRoutingPhoneNumber,
  ensureCallbackNumberAssigned,
  sanitizeSmartRoutingWorkspaceNumberAssignments,
} from "@/lib/smart-routing/number-provisioning";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await ensureSmartRoutingWorkspaceSettings(auth.workspaceId);
    await sanitizeSmartRoutingWorkspaceNumberAssignments(auth.workspaceId);
    const settings = await ensureCallbackNumberAssigned(auth.workspaceId);
    const callerId = await getCallerIdVerificationStatus(auth.workspaceId);
    const authorizedCallers = await listAuthorizedCallers(auth.workspaceId);
    const callerIdentities = await listApprovedCallerIdentities(auth.workspaceId);
    const prisma = getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { name: true },
    });
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        workspaceId: auth.workspaceId,
        releasedAt: null,
        status: { not: "Released" },
      },
      select: { id: true, e164: true, friendlyName: true, settingsJson: true },
      orderBy: { createdAt: "desc" },
    });
    const flows = await prisma.smartRoutingFlow.findMany({
      where: { workspaceId: auth.workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        routingNumberE164: true,
        businessNumberE164: true,
        scheduleJson: true,
        draftConfigJson: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    const destinations = await prisma.smartRoutingDestination.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { label: "asc" },
    });

    const forwarding = settings.routingNumberE164
      ? CARRIER_FORWARDING_GUIDES.map((guide) => ({
          carrier: guide.carrier,
          modes: Object.fromEntries(
            Object.entries(guide.modes).map(([mode, entry]) => [
              mode,
              {
                ...entry,
                dialCode: entry.dialCode.replace(
                  /\{routingNumber\}/g,
                  settings.routingNumberE164!,
                ),
              },
            ]),
          ),
        }))
      : null;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const forwardedSession = await prisma.smartRoutingCallSession.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        forwardedFromNumber: { not: null },
        startedAt: { gte: since },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, forwardedFromNumber: true, callerNumber: true },
    });

    const inboundTest = await prisma.smartRoutingCallSession.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        startedAt: { gte: since },
        isTest: false,
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, finalOutcome: true },
    });

    const outboundTest = await prisma.smartRoutingOutboundCall.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        createdAt: { gte: since },
        result: { in: ["bridged", "completed", "answered"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, destinationE164: true, businessCallerIdE164: true },
    }).catch(() => null);

    const forwardingOnFlow = flows.some((f: { scheduleJson: unknown }) => {
      const schedule = (f.scheduleJson as Record<string, unknown>) ?? {};
      const fwd = (schedule.forwarding as Record<string, unknown>) ?? {};
      return fwd.status === "verified";
    });

    const activeFlow = flows.find(
      (f: { status: string; type?: string; name?: string }) =>
        f.status === "active" && isCustomerSmartRoutingFlow(f),
    );
    const scheduleBranch = activeFlow
      ? await evaluateScheduleBranch(
          auth.workspaceId,
          "America/New_York",
          activeFlow.scheduleJson as Record<string, unknown>,
        )
      : settings.scheduleOverrideJson
        ? "temporary_closure"
        : "open";

    const scheduleOverride = settings.scheduleOverrideJson as
      | { scheduleOverride?: { mode?: string; expiresAt?: string } }
      | null;

    const readiness = computeSetupReadiness({
      settings,
      callerIdStatus: callerId.status,
      flows,
      destinations,
      authorizedCallers,
      forwardingDetected: Boolean(forwardedSession) || forwardingOnFlow,
      inboundTestDetected: Boolean(inboundTest),
      outboundTestDetected: Boolean(outboundTest),
      scheduleBranch,
    });

    return NextResponse.json({
      data: {
        workspaceName: workspace?.name ?? null,
        settings,
        callerId,
        callerIdentities,
        authorizedCallers,
        phoneNumbers,
        flows,
        destinations,
        forwarding,
        readiness,
        scheduleOverride: scheduleOverride?.scheduleOverride ?? null,
        routeOverride:
          (settings.scheduleOverrideJson as { routeOverride?: { destinationId?: string; expiresAt?: string } } | null)
            ?.routeOverride ?? null,
        forwardingTest: forwardedSession
          ? {
              detected: true,
              at: forwardedSession.startedAt.toISOString(),
              forwardedFrom: forwardedSession.forwardedFromNumber,
              callerNumber: forwardedSession.callerNumber,
            }
          : { detected: false },
        recentInbound: inboundTest
          ? {
              at: inboundTest.startedAt.toISOString(),
              outcome: inboundTest.finalOutcome,
            }
          : null,
        recentOutbound: outboundTest
          ? {
              at: outboundTest.createdAt.toISOString(),
              destination: outboundTest.destinationE164,
              businessCallerId: outboundTest.businessCallerIdE164,
            }
          : null,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();

    if (body.publicBusinessE164 !== undefined || body.routingMode !== undefined || body.outboundEnabled !== undefined || body.markComplete) {
      await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
        publicBusinessE164: body.publicBusinessE164,
        routingMode: body.routingMode,
        outboundEnabled: body.outboundEnabled,
        setupCompletedAt: body.markComplete ? new Date() : undefined,
      });
    }

    if (body.assignedPhoneNumberId) {
      const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
      await grantWorkspaceProductFeature(auth.workspaceId, "smart_routing", "trial");
      await assignRoutingPhoneNumber(auth.workspaceId, String(body.assignedPhoneNumberId));
    } else if (body.assignedPhoneNumberId === null || body.assignedPhoneNumberId === "") {
      const ws = await loadSmartRoutingWorkspaceSettings(auth.workspaceId);
      if (ws?.assignedPhoneNumberId) {
        const priorId = ws.assignedPhoneNumberId;
        await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
          assignedPhoneNumberId: null,
          routingNumberE164: null,
        });
        const { releaseRoutingRuntimeForAssignedNumber } = await import(
          "@/lib/smart-routing/flow-service"
        );
        await releaseRoutingRuntimeForAssignedNumber(auth.workspaceId, priorId);
      }
    }
    if (body.assignedCallbackPhoneNumberId) {
      await assignCallbackPhoneNumber(
        auth.workspaceId,
        String(body.assignedCallbackPhoneNumberId),
      );
    } else if (body.assignedCallbackPhoneNumberId === null || body.assignedCallbackPhoneNumberId === "") {
      const ws = await loadSmartRoutingWorkspaceSettings(auth.workspaceId);
      if (ws?.assignedCallbackPhoneNumberId) {
        const { transitionNumberService } = await import("@/lib/numbers/state-service");
        await transitionNumberService(
          auth.workspaceId,
          ws.assignedCallbackPhoneNumberId,
          "clear_smart_routing_callback_owner",
        );
        await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
          assignedCallbackPhoneNumberId: null,
          callbackNumberE164: null,
        });
      }
    }

    const refreshed = await loadSmartRoutingWorkspaceSettings(auth.workspaceId);
    return NextResponse.json({ data: refreshed });
  } catch (err) {
    return jsonError(err, 400);
  }
}
