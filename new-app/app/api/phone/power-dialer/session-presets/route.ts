import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  deleteSessionPreset,
  listSessionPresets,
  saveSessionPreset,
} from "@/lib/server/phone/power-dialer/session-presets";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listSessionPresets(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      scope?: "user" | "workspace";
      config?: Record<string, unknown>;
    };
    const row = await saveSessionPreset(workspaceId, {
      id: body.id,
      name: String(body.name || ""),
      scope: body.scope === "workspace" ? "workspace" : "user",
      config: (body.config || {}) as import("@/lib/server/phone/power-dialer/session-presets").SessionPresetConfig,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteSessionPreset(workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
