import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { getPrisma } from "@/lib/db";
import { directLinksForWorkspace } from "@/lib/appointments/service-booking/scheduler-theme";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const typeId = searchParams.get("typeId") || undefined;
    const staffId = searchParams.get("staffId") || undefined;
    const locationId = searchParams.get("locationId") || undefined;
    const format = searchParams.get("format") || "png";

    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { slug: true },
    });
    if (!workspace?.slug) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const links = directLinksForWorkspace(baseUrl, workspace.slug, {
      typeId,
      staffId,
      locationId,
    });
    const targetUrl = typeId ? links.bookingType || links.bookingPage : links.bookingPage;

    if (format === "svg") {
      const svg = await QRCode.toString(targetUrl, { type: "svg", margin: 1 });
      return new NextResponse(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" },
      });
    }

    const png = await QRCode.toBuffer(targetUrl, { type: "png", margin: 1, width: 512 });
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const body = await request.json();

    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { slug: true },
    });
    if (!workspace?.slug) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const links = directLinksForWorkspace(baseUrl, workspace.slug, {
      typeId: body.typeId,
      staffId: body.staffId,
      locationId: body.locationId,
    });
    const targetUrl = body.typeId ? links.bookingType || links.bookingPage : links.bookingPage;
    const dataUrl = await QRCode.toDataURL(targetUrl, { margin: 1, width: 512 });
    return NextResponse.json({ data: { url: targetUrl, dataUrl } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
