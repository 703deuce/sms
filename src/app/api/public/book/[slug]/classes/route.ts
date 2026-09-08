import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { listClassSeries } from "@/lib/appointments/service-booking/classes";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking disabled" }, { status: 403 });
    }

    const prisma = getPrisma();
    const series = await listClassSeries(workspace.id);
    const active = series.filter((s: { active: boolean }) => s.active);

    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        workspaceId: workspace.id,
        status: "scheduled",
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });

    const enrollmentCounts = await prisma.classEnrollment.groupBy({
      by: ["occurrenceId"],
      where: { workspaceId: workspace.id, status: "enrolled" },
      _count: { occurrenceId: true },
    });
    const countMap = new Map(enrollmentCounts.map((e) => [e.occurrenceId, e._count.occurrenceId]));

    const publicOccurrences = occurrences.map((occ) => ({
      id: occ.id,
      seriesId: occ.seriesId,
      startsAt: occ.startsAt.toISOString(),
      endsAt: occ.endsAt.toISOString(),
      capacity: occ.capacity,
      enrolled: countMap.get(occ.id) || 0,
      remaining: Math.max(0, (occ.capacity || 0) - (countMap.get(occ.id) || 0)),
    }));

    return NextResponse.json({
      data: {
        series: active.map((s: { id: string; name: string; description: string | null; capacity: number; requireFullSeries: boolean }) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          capacity: s.capacity,
          requireFullSeries: s.requireFullSeries,
        })),
        occurrences: publicOccurrences,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    if (!phone || !firstName) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const { resolveContactIdByPhone } = await import(
      "@/lib/appointments/service-booking/booking-entitlements"
    );
    const { enrollInClass } = await import("@/lib/appointments/service-booking/classes");
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();

    let contactId = await resolveContactIdByPhone(workspace.id, phone, body.email ? String(body.email) : undefined);
    if (!contactId) {
      const created = await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          firstName,
          lastName,
          phone,
          email: body.email ? String(body.email) : null,
          status: "SUBSCRIBED",
        },
      });
      contactId = created.id;
    }

    const enrollment = await enrollInClass(workspace.id, {
      contactId,
      occurrenceId: body.occurrenceId ? String(body.occurrenceId) : undefined,
      seriesId: body.seriesId ? String(body.seriesId) : undefined,
      enrollFullSeries: body.enrollFullSeries === true,
    });

    return NextResponse.json({ data: { enrollment } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
