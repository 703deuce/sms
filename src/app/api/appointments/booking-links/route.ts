import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createSingleUseBookingLink,
  embedBookingUrl,
  popupBookingScript,
  revokeSingleUseBookingLink,
} from "@/lib/appointments/booking-links";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const links = (platform as { singleUseLinks?: unknown[] }).singleUseLinks || [];
    const workspace = await import("@/lib/db").then((m) =>
      m.getPrisma().workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { slug: true },
      }),
    );
    const slug = workspace?.slug || "";
    return NextResponse.json({
      data: {
        links,
        embedUrl: slug ? embedBookingUrl(slug) : null,
        popupScript: slug ? popupBookingScript(slug) : null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("id");
    if (!linkId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const ok = await revokeSingleUseBookingLink(auth.workspaceId, linkId);
    if (!ok) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    return NextResponse.json({ data: { revoked: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      appointmentTypeId?: string;
      expiresAt?: string;
      maxUses?: number;
    };
    if (!body.appointmentTypeId) {
      return NextResponse.json({ error: "appointmentTypeId required" }, { status: 400 });
    }
    const link = await createSingleUseBookingLink(auth.workspaceId, {
      appointmentTypeId: body.appointmentTypeId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      maxUses: body.maxUses,
      createdBy: auth.session.userId,
    });
    return NextResponse.json({ data: link }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
