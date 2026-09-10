import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  resolveClientPortalSession,
  createClientPortalSession,
  revokeClientPortalSession,
} from "@/lib/appointments/service-booking";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });
    return NextResponse.json({ data: resolved });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.action === "sign_out") {
      const revoked = await revokeClientPortalSession(token);
      if (!revoked) {
        return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });
      }
      return NextResponse.json({ data: { signedOut: true } });
    }

    if (!body.workspaceId || !body.contactId) {
      return NextResponse.json({ error: "workspaceId and contactId required" }, { status: 400 });
    }
    const session = await createClientPortalSession(body.workspaceId, body.contactId);
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
