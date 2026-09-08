import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import { fulfillStoreCheckoutBySessionId } from "@/lib/appointments/service-booking/store-checkout";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sessionId = new URL(request.url).searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const result = await fulfillStoreCheckoutBySessionId(workspace.id, sessionId);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
