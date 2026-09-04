import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { joinWaitlist } from "@/lib/appointments/waitlist";
import { resolveWorkspaceBySlug } from "@/lib/appointments/settings";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const phone = String(body.phone || "").trim();
    if (!phone) return NextResponse.json({ error: "Phone is required" }, { status: 400 });

    const entry = await joinWaitlist({
      workspaceId: workspace.id,
      appointmentTypeId: body.appointmentTypeId ? String(body.appointmentTypeId) : undefined,
      serviceName: body.serviceName ? String(body.serviceName) : undefined,
      preferredDate: body.preferredDate ? String(body.preferredDate) : undefined,
      preferredTimeStart: body.preferredTimeStart ? String(body.preferredTimeStart) : undefined,
      preferredTimeEnd: body.preferredTimeEnd ? String(body.preferredTimeEnd) : undefined,
      staffPreference: body.staffPreference ? String(body.staffPreference) : undefined,
      locationId: body.locationId ? String(body.locationId) : undefined,
      phone,
      email: body.email ? String(body.email) : undefined,
    });

    return NextResponse.json({ data: { id: entry.id, status: "joined" } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
