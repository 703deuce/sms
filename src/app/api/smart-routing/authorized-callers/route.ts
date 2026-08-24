import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createAuthorizedCaller,
  deleteAuthorizedCaller,
  listAuthorizedCallers,
  resetAuthorizedCallerPin,
  updateAuthorizedCaller,
} from "@/lib/smart-routing/authorized-callers";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listAuthorizedCallers(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const action = String(body.action || "create");

    if (action === "create") {
      const data = await createAuthorizedCaller({
        workspaceId: auth.workspaceId,
        name: String(body.name || ""),
        phoneE164: String(body.phoneE164 || ""),
        pin: String(body.pin || ""),
        userId: body.userId,
      });
      return NextResponse.json({ data }, { status: 201 });
    }

    if (action === "reset_pin" && body.id) {
      await resetAuthorizedCallerPin(auth.workspaceId, String(body.id), String(body.pin || ""));
      return NextResponse.json({ ok: true });
    }

    if (action === "update" && body.id) {
      const data = await updateAuthorizedCaller(auth.workspaceId, String(body.id), {
        name: body.name,
        active: body.active,
        outboundEnabled: body.outboundEnabled,
        preferredCallbackPhoneE164: body.preferredCallbackPhoneE164,
      });
      return NextResponse.json({ data });
    }

    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(new Error("id required"), 400);
    await deleteAuthorizedCaller(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
