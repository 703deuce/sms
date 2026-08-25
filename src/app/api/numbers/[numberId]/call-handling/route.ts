import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  readCallHandlingMode,
  setCallHandlingMode,
  type CallHandlingMode,
} from "@/lib/numbers/call-handling-mode";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const row = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
      select: { id: true, e164: true, settingsJson: true, status: true, releasedAt: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status === "Released" || row.releasedAt) {
      return NextResponse.json({ error: "Number has been released" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        numberId: row.id,
        e164: row.e164,
        mode: readCallHandlingMode(row.settingsJson),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const row = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
      select: { status: true, releasedAt: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status === "Released" || row.releasedAt) {
      return NextResponse.json({ error: "Number has been released" }, { status: 400 });
    }
    const body = (await request.json()) as { mode?: CallHandlingMode };
    const mode = body.mode;
    if (
      mode !== "smart_routing" &&
      mode !== "mctb" &&
      mode !== "call_forwarding" &&
      mode !== "unconfigured"
    ) {
      return NextResponse.json(
        { error: "mode must be smart_routing, mctb, call_forwarding, or unconfigured" },
        { status: 400 },
      );
    }
    const data = await setCallHandlingMode(auth.workspaceId, numberId, mode);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
