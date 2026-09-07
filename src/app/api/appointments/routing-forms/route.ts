import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listRoutingForms, saveRoutingForm } from "@/lib/appointments/routing-forms";
import type { RoutingForm } from "@/lib/appointments/scheduling-capabilities";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const forms = await listRoutingForms(auth.workspaceId);
    return NextResponse.json({ data: forms });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const form = (await request.json()) as RoutingForm;
    if (!form.id || !form.name) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 });
    }
    const saved = await saveRoutingForm(auth.workspaceId, form);
    return NextResponse.json({ data: saved });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { deleteRoutingForm } = await import("@/lib/appointments/routing-forms");
    await deleteRoutingForm(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
