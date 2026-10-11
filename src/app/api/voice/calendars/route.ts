import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createWorkspaceCalendarConnection,
  getWorkspaceCalendarConnection,
  listWorkspaceCalendarConnections,
} from "@/lib/calendar/connections";
import { resolveMicrosoftCalendarConnectionForCreate } from "@/lib/calendar/microsoft-canonical-connection";

/** @deprecated Use /api/integrations/calendars — voice only consumes workspace calendar connections. */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await listWorkspaceCalendarConnections(auth.workspaceId);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

/** @deprecated Use /api/integrations/calendars */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      config?: Record<string, unknown>;
    };
    const provider = body.provider || "internal";
    if (provider === "microsoft") {
      const { connection, created } = await resolveMicrosoftCalendarConnectionForCreate(
        auth.workspaceId,
        body,
      );
      return NextResponse.json({ data: connection }, { status: created ? 201 : 200 });
    }
    const row = await createWorkspaceCalendarConnection(auth.workspaceId, body);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
