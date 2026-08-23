import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { updateSmartRoutingWorkspaceSettings } from "@/lib/smart-routing/workspace-settings";
import { isWorkspaceInternalSmartRoutingNumber } from "@/lib/smart-routing/ingress-router";

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
        active: body.active ?? true,
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
    const row = await prisma.smartRoutingDestination.update({
      where: { id, workspaceId: auth.workspaceId },
      data: {
        label: body.label,
        phoneNumber: body.phoneNumber,
        active: body.active,
      },
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
    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}
