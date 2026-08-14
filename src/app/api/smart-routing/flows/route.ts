import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createFlow, listFlows, getOverviewMetrics } from "@/lib/smart-routing/flow-service";
import type { SmartRoutingFlowType } from "@/lib/smart-routing/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const [flows, metrics] = await Promise.all([
      listFlows(auth.workspaceId),
      getOverviewMetrics(auth.workspaceId),
    ]);
    return NextResponse.json({ data: flows, metrics });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      type?: SmartRoutingFlowType;
    };
    const flow = await createFlow(auth.workspaceId, {
      name: body.name,
      type: body.type,
      createdBy: auth.session.userId,
    });
    return NextResponse.json({ data: flow }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
