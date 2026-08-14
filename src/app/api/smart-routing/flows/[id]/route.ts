import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteFlow,
  duplicateFlow,
  getFlow,
  pauseFlow,
  publishFlow,
  updateFlowDraft,
  validateFlow,
} from "@/lib/smart-routing/flow-service";
import type { DraftConfig } from "@/lib/smart-routing/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const flow = await getFlow(auth.workspaceId, id);
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: flow });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      name?: string;
      draftConfig?: DraftConfig;
      assignedPhoneNumberId?: string | null;
      numberMode?: string;
      businessNumberE164?: string | null;
      routingNumberE164?: string | null;
      triggerMode?: string;
      scheduleJson?: object;
      timezone?: string;
      status?: string;
    };
    const flow = await updateFlowDraft(auth.workspaceId, id, body);
    return NextResponse.json({ data: flow });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    await deleteFlow(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
