import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { updateSmartRoutingWorkspaceSettings } from "@/lib/smart-routing/workspace-settings";
import { isWorkspaceInternalSmartRoutingNumber } from "@/lib/smart-routing/ingress-router";
import { pauseDurationUntil } from "@/lib/smart-routing/destination-availability";
import { routeOverridePayload } from "@/lib/smart-routing/route-override";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.smartRoutingDestination.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { label: "asc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const prisma = getPrisma();
    if (body.phoneNumber) {
      const blocked = await isWorkspaceInternalSmartRoutingNumber(
        auth.workspaceId,
        String(body.phoneNumber),
      );
      if (blocked) {
        return jsonError(
          new Error("Cannot route calls to your Transovo Routing or Business Callback Number"),
          400,
        );
      }
    }
    const row = await prisma.smartRoutingDestination.create({
      data: {
        workspaceId: auth.workspaceId,
        label: String(body.label || "Destination").trim(),
        destinationType: String(body.destinationType || "external_phone"),
        phoneNumber: body.phoneNumber ? String(body.phoneNumber).trim() : null,
        contactId: body.contactId ?? null,
        assignedUserId: body.assignedUserId ?? null,
        answerConfirmationEnabled: Boolean(body.answerConfirmationEnabled),
        active: body.active ?? true,
        availabilityStatus: "available",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return jsonError(new Error("id required"), 400);
    const prisma = getPrisma();

    const patch: Record<string, unknown> = {};
    if (body.label !== undefined) patch.label = body.label;
    if (body.phoneNumber !== undefined) patch.phoneNumber = body.phoneNumber;
    if (body.active !== undefined) patch.active = body.active;
    if (body.assignedUserId !== undefined) patch.assignedUserId = body.assignedUserId;
    if (body.answerConfirmationEnabled !== undefined) {
      patch.answerConfirmationEnabled = Boolean(body.answerConfirmationEnabled);
    }
    if (body.availabilityStatus !== undefined) {
      patch.availabilityStatus = String(body.availabilityStatus);
    }
    if (body.unavailableUntil !== undefined) {
      patch.unavailableUntil = body.unavailableUntil ? new Date(body.unavailableUntil) : null;
    }
    if (body.pausePreset) {
      const preset = String(body.pausePreset) as "manual" | "1h" | "tomorrow" | "custom";
      if (preset === "manual" && body.resume) {
        patch.availabilityStatus = "available";
        patch.unavailableUntil = null;
      } else {
        patch.availabilityStatus = "unavailable";
        patch.unavailableUntil = pauseDurationUntil(
          preset,
          body.customUntil ? String(body.customUntil) : undefined,
        );
      }
    }

    const row = await prisma.smartRoutingDestination.update({
      where: { id, workspaceId: auth.workspaceId },
      data: patch,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    if (body.action === "close_now") {
      const until = body.until
        ? new Date(body.until)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
        scheduleOverrideJson: {
          scheduleOverride: { mode: "closed_now", expiresAt: until.toISOString() },
        },
      });
      return NextResponse.json({ data: { mode: "closed_now", until: until.toISOString() } });
    }
    if (body.action === "clear_override") {
      await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
        scheduleOverrideJson: null,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "route_override") {
      const destinationId = String(body.destinationId || "");
      if (!destinationId) return jsonError(new Error("destinationId required"), 400);
      const until = body.until
        ? new Date(body.until)
        : new Date(Date.now() + 4 * 60 * 60 * 1000);
      const existing = await getPrisma().smartRoutingWorkspaceSettings.findUnique({
        where: { workspaceId: auth.workspaceId },
        select: { scheduleOverrideJson: true },
      });
      const base =
        (existing?.scheduleOverrideJson as Record<string, unknown> | null) ?? {};
      await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
        scheduleOverrideJson: {
          ...base,
          ...routeOverridePayload(destinationId, until),
        },
      });
      return NextResponse.json({
        data: { destinationId, until: until.toISOString() },
      });
    }
    if (body.action === "clear_route_override") {
      const existing = await getPrisma().smartRoutingWorkspaceSettings.findUnique({
        where: { workspaceId: auth.workspaceId },
        select: { scheduleOverrideJson: true },
      });
      const base =
        (existing?.scheduleOverrideJson as Record<string, unknown> | null) ?? {};
      const { routeOverride: _, ...rest } = base;
      await updateSmartRoutingWorkspaceSettings(auth.workspaceId, {
        scheduleOverrideJson: Object.keys(rest).length ? rest : null,
      });
      return NextResponse.json({ ok: true });
    }
    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}
