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
import { CARRIER_FORWARDING_GUIDES } from "@/lib/smart-routing/forwarding-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const settings = await ensureSmartRoutingWorkspaceSettings(auth.workspaceId);
    const callerId = await getCallerIdVerificationStatus(auth.workspaceId);
    const authorizedCallers = await listAuthorizedCallers(auth.workspaceId);
    const prisma = getPrisma();
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      select: { id: true, e164: true, friendlyName: true },
      orderBy: { createdAt: "desc" },
    });
    const flows = await prisma.smartRoutingFlow.findMany({
      where: { workspaceId: auth.workspaceId },
      select: { id: true, name: true, status: true, routingNumberE164: true, businessNumberE164: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
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
    return NextResponse.json({
      data: {
        settings,
        callerId,
        authorizedCallers,
        phoneNumbers,
        flows,
        forwarding,
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
    const settings = await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
      publicBusinessE164: body.publicBusinessE164,
      routingNumberE164: body.routingNumberE164,
      assignedPhoneNumberId: body.assignedPhoneNumberId,
      routingMode: body.routingMode,
      outboundEnabled: body.outboundEnabled,
      setupCompletedAt: body.markComplete ? new Date() : undefined,
    });
    if (body.assignedPhoneNumberId && body.routingNumberE164) {
      const prisma = getPrisma();
      const pn = await prisma.phoneNumber.findFirst({
        where: { id: body.assignedPhoneNumberId, workspaceId: auth.workspaceId },
      });
      if (pn) {
        await prisma.smartRoutingWorkspaceSettings.update({
          where: { workspaceId: auth.workspaceId },
          data: { routingNumberE164: pn.e164 },
        });
      }
    }
    return NextResponse.json({ data: settings });
  } catch (err) {
    return jsonError(err, 400);
  }
}
