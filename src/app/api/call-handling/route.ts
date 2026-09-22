import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import {
  loadCallHandlingOwnershipState,
  setActiveCallHandler,
} from "@/lib/call-handling/set-active-call-handler";
import type { ActiveCallHandler } from "@/lib/call-handling/types";

const patchSchema = z.object({
  handler: z.enum(["mctb", "ai_receptionist"]),
  phoneNumberId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const phoneNumberId = url.searchParams.get("phoneNumberId");

  const state = await loadCallHandlingOwnershipState({
    workspaceId: auth.workspaceId,
    phoneNumberId,
  });

  if (!state) {
    return NextResponse.json(
      { error: "No call-handling phone configured for this workspace." },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: state });
}

export async function PATCH(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const state = await setActiveCallHandler({
      workspaceId: auth.workspaceId,
      phoneNumberId: parsed.data.phoneNumberId,
      handler: parsed.data.handler as ActiveCallHandler,
      userId: auth.session.userId,
    });
    return NextResponse.json({ data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Switch failed";
    const prior = await loadCallHandlingOwnershipState({
      workspaceId: auth.workspaceId,
      phoneNumberId: parsed.data.phoneNumberId,
    });
    return NextResponse.json(
      {
        error: message,
        data: prior,
      },
      { status: 422 },
    );
  }
}
