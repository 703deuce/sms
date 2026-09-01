import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createFaxPortOutRequest,
  listFaxPortOutRequests,
} from "@/lib/fax/fax-port-out";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listFaxPortOutRequests(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const data = await createFaxPortOutRequest({
      workspaceId: auth.workspaceId,
      faxNumberId: body.faxNumberId,
      notes: body.notes,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
