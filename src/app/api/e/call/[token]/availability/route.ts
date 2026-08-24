import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { validateEmployeeAccessToken } from "@/lib/smart-routing/employee-access-token-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const grant = await validateEmployeeAccessToken(token);
    if (!grant) return jsonError(new Error("Invalid or expired link"), 401);

    const body = await request.json();
    const action = String(body.action || "");
    const prisma = getPrisma();
    const caller = grant.authorizedCaller;

    const destination = await prisma.smartRoutingDestination.findFirst({
      where: { workspaceId: grant.workspaceId, phoneNumber: caller.phoneE164 },
    });

    if (!destination) {
      return jsonError(new Error("No routing destination linked to this employee"), 400);
    }

    if (action === "pause") {
      await prisma.smartRoutingDestination.update({
        where: { id: destination.id },
        data: {
          availabilityStatus: "paused",
          unavailableUntil: body.until ? new Date(String(body.until)) : null,
        },
      });
    } else if (action === "resume") {
      await prisma.smartRoutingDestination.update({
        where: { id: destination.id },
        data: { availabilityStatus: "available", unavailableUntil: null },
      });
    } else {
      return jsonError(new Error("action must be pause or resume"), 400);
    }

    const updated = await prisma.smartRoutingDestination.findUnique({
      where: { id: destination.id },
      select: { availabilityStatus: true },
    });

    return NextResponse.json({ data: { availabilityStatus: updated?.availabilityStatus } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
