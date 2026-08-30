import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { traceMctbDebug } from "@/lib/mctb/debug";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    area?: string;
    event?: string;
    at?: string;
    [key: string]: unknown;
  };

  const workspaceId = await getActiveWorkspaceId().catch(() => null);

  traceMctbDebug("client", body.event || "ui_action", {
    uiArea: body.area,
    workspaceId,
    userId: session.userId,
    ...body,
  });

  return NextResponse.json({ ok: true });
}
