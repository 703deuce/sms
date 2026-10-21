import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getPhoneMctbSettings, patchPhoneMctbSettings } from "@/lib/server/mctb/api-model";

export async function GET() {
  try {
    const { workspaceId } = await requireSession();
    const data = await getPhoneMctbSettings(workspaceId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load MCTB settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { workspaceId, session } = await requireSession();
    const body = (await req.json()) as Record<string, unknown>;
    const data = await patchPhoneMctbSettings(workspaceId, body, session.userId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save MCTB settings";
    const status = message === "number_not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
