import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { resolveSegmentContactIds } from "@/lib/contacts/segment-query";

/**
 * Return contacts matching segment conditions (or an existing segment id).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      conditions?: unknown;
      segmentId?: string;
      take?: number;
    };

    let conditions = body.conditions;
    if (body.segmentId) {
      const segment = await getPrisma().segment.findFirst({
        where: { id: body.segmentId, workspaceId: auth.workspaceId },
      });
      if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });
      conditions = segment.conditions;
    }

    const take = Math.min(Math.max(body.take ?? 200, 1), 500);
    const ids = await resolveSegmentContactIds(auth.workspaceId, conditions);
    const slice = ids.slice(0, take);

    if (!slice.length) {
      return NextResponse.json({ data: { contacts: [], total: ids.length } });
    }

    const rows = await getPrisma().contact.findMany({
      where: { workspaceId: auth.workspaceId, id: { in: slice } },
    });

    const contacts = rows.map((c: {
      id: string;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      status: string;
      customFields: unknown;
    }) => {
      const cf =
        c.customFields && typeof c.customFields === "object"
          ? (c.customFields as Record<string, unknown>)
          : {};
      const status =
        c.status === "SUBSCRIBED"
          ? "Subscribed"
          : c.status === "UNSUBSCRIBED"
            ? "Unsubscribed"
            : c.status === "BLOCKED"
              ? "Blocked"
              : "Not Subscribed";
      return {
        id: c.id,
        phone: c.phone || "",
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        email: c.email || "",
        state: String(cf.state || ""),
        age: cf.age != null && cf.age !== "" ? Number(cf.age) : null,
        status,
      };
    });

    return NextResponse.json({ data: { contacts, total: ids.length } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
