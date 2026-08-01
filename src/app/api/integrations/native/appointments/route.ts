import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceAppointment.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { startsAt: "desc" },
      take: 100,
    });

    const appointments = (
      rows as Array<{
        id: string;
        serviceName: string | null;
        startsAt: Date;
        endsAt: Date | null;
        status: string;
        contactId: string | null;
        externalId: string | null;
        metadata: unknown;
      }>
    ).map((a) => {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      return {
        id: a.id,
        serviceName: a.serviceName,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() || null,
        status: a.status,
        contactId: a.contactId,
        externalId: a.externalId,
        provider: (meta.provider as string) || null,
        inviteeName: (meta.inviteeName as string) || null,
        inviteeEmail: (meta.inviteeEmail as string) || null,
      };
    });

    return NextResponse.json({ data: { appointments } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
