import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteIvrMenu,
  getIvrMenu,
  updateIvrMenu,
} from "@/lib/phone/ivr-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getIvrMenu(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { requireWorkspacePhoneAdmin } = await import("@/lib/phone/softphone-permissions");
    await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    const { id } = await params;
    const body = await request.json();
    const data = await updateIvrMenu(auth.workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { requireWorkspacePhoneAdmin } = await import("@/lib/phone/softphone-permissions");
    await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    const { id } = await params;
    const data = await deleteIvrMenu(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
