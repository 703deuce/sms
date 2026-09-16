import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { listCalendlyEventTypes } from "@/lib/integrations/adapters/calendly-event-types";
import { getConnection } from "@/lib/integrations/connections";

export async function GET() {
  try {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const workspaceId = auth.workspaceId;
  const conn = await getConnection(workspaceId, "calendly");
  if (!conn || conn.status !== "connected") {
    return NextResponse.json(
      { error: "Calendly is not connected for this workspace." },
      { status: 400 },
    );
  }
  try {
    const ctx = await buildAdapterContext(workspaceId, "calendly");
    const types = await listCalendlyEventTypes(ctx, { activeOnly: true });
    return NextResponse.json({
      data: types.map((t) => ({
        uri: t.uri,
        name: t.name,
        durationMinutes: t.durationMinutes,
        schedulingUrl: t.schedulingUrl,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message.slice(0, 240) }, { status: 502 });
  }
  } catch (err) {
    return jsonError(err, 500);
  }
}
