import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  readCallHandlingMode,
  setCallHandlingMode,
  snapshotCallHandlingMode,
  type CallHandlingMode,
} from "@/lib/numbers/call-handling-mode";
import { getPrisma } from "@/lib/db";

const MODES: CallHandlingMode[] = ["none", "mctb", "smart_routing"];

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
      select: { settingsJson: true, e164: true },
    });
    if (!row) return NextResponse.json({ error: "Number not found" }, { status: 404 });
    return NextResponse.json({
      data: {
        e164: row.e164,
        ...snapshotCallHandlingMode(row.settingsJson),
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
    const body = (await request.json()) as { mode?: string };
    const mode = String(body.mode || "").toLowerCase() as CallHandlingMode;
    if (!MODES.includes(mode)) {
      return NextResponse.json(
        { error: `mode must be one of: ${MODES.join(", ")}` },
        { status: 400 },
      );
    }

    const before = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
      select: { settingsJson: true },
    });
    if (!before) return NextResponse.json({ error: "Number not found" }, { status: 404 });

    const result = await setCallHandlingMode({
      workspaceId: auth.workspaceId,
      phoneNumberId: numberId,
      mode,
    });

    return NextResponse.json({
      data: {
        previousMode: readCallHandlingMode(before.settingsJson),
        ...result.snapshot,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
