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
  voiceIngressPhoneNumberId: z.string().min(1).optional(),
  /** @deprecated use voiceIngressPhoneNumberId */
  phoneNumberId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const voiceIngressPhoneNumberId =
    url.searchParams.get("voiceIngressPhoneNumberId") ?? url.searchParams.get("phoneNumberId");

  const state = await loadCallHandlingOwnershipState({
    workspaceId: auth.workspaceId,
    voiceIngressPhoneNumberId,
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
    const voiceIngressPhoneNumberId =
      parsed.data.voiceIngressPhoneNumberId ?? parsed.data.phoneNumberId;
    const state = await setActiveCallHandler({
      workspaceId: auth.workspaceId,
      voiceIngressPhoneNumberId,
      handler: parsed.data.handler as ActiveCallHandler,
      userId: auth.session.userId,
    });
    return NextResponse.json({ data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Switch failed";
    const voiceIngressPhoneNumberId =
      parsed.data.voiceIngressPhoneNumberId ?? parsed.data.phoneNumberId;
    const prior = await loadCallHandlingOwnershipState({
      workspaceId: auth.workspaceId,
      voiceIngressPhoneNumberId,
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
