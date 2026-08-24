import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { pauseDurationUntil } from "@/lib/smart-routing/destination-availability";
import { findUserRoutingDestination } from "@/lib/smart-routing/user-destination";
import { getPrisma } from "@/lib/db";

/** Pause or resume routed calls for the authenticated user's mapped destination. */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const prisma = getPrisma();

    const destination = await findUserRoutingDestination(
      auth.workspaceId,
      auth.session.userId,
    );

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
    const destination = await findUserRoutingDestination(
      auth.workspaceId,
      auth.session.userId,
    );
    return NextResponse.json({ data: destination });
  } catch (err) {
    return jsonError(err);
  }
}
