import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { deleteMctbBookingLink, updateMctbBookingLink } from "@/lib/mctb/booking-links/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      label?: string;
      url?: string;
      description?: string | null;
      active?: boolean;
      isDefault?: boolean;
    };
    const data = await updateMctbBookingLink(auth.workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deleteMctbBookingLink(auth.workspaceId, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
