import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { pauseDurationUntil } from "@/lib/smart-routing/destination-availability";

/** Pause or resume routed calls for the authenticated user's mapped destination. */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const prisma = getPrisma();
    const userId = auth.session.userId;

    const authorized = await prisma.smartRoutingAuthorizedCaller.findFirst({
      where: { workspaceId: auth.workspaceId, userId, active: true },
    });

    let destination = await prisma.smartRoutingDestination.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        assignedUserId: userId,
        active: true,
      },
    });

    if (!destination && authorized?.phoneE164) {
      destination = await prisma.smartRoutingDestination.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          phoneNumber: authorized.phoneE164,
          active: true,
        },
      });
    }

    if (!destination) {
      return jsonError(new Error("No Smart Routing destination mapped to your account"), 404);
    }

    if (action === "resume") {
      const row = await prisma.smartRoutingDestination.update({
        where: { id: destination.id },
        data: { availabilityStatus: "available", unavailableUntil: null },
      });
      return NextResponse.json({ data: row });
    }

    if (action === "pause") {
      const preset = (body.preset as "manual" | "1h" | "tomorrow" | "custom") ?? "manual";
      const row = await prisma.smartRoutingDestination.update({
        where: { id: destination.id },
        data: {
          availabilityStatus: "unavailable",
          unavailableUntil: pauseDurationUntil(
            preset,
            body.customUntil ? String(body.customUntil) : undefined,
          ),
        },
      });
      return NextResponse.json({ data: row });
    }

    return jsonError(new Error("action must be pause or resume"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const userId = auth.session.userId;
    const destination = await prisma.smartRoutingDestination.findFirst({
      where: { workspaceId: auth.workspaceId, assignedUserId: userId, active: true },
    });
    return NextResponse.json({ data: destination });
  } catch (err) {
    return jsonError(err);
  }
}
