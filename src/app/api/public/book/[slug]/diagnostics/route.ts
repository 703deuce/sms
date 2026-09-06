import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { explainSlotUnavailability } from "@/lib/appointments/slot-diagnostics";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get("serviceName");
    const startsAt = searchParams.get("startsAt");
    if (!serviceName || !startsAt) {
      return NextResponse.json({ error: "serviceName and startsAt required" }, { status: 400 });
    }
    const explanation = await explainSlotUnavailability(workspace.id, serviceName, startsAt);
    return NextResponse.json({ data: { explanation } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
