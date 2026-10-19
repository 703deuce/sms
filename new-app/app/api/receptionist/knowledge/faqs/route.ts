import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  deleteFaq,
  listFaqsForWorkspace,
  upsertFaq,
} from "@/lib/server/receptionist/knowledge-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const rows = await listFaqsForWorkspace(workspaceId);
    const data = rows.map((f) => ({
      id: f.id,
      q: f.question,
      a: f.answer,
      status: f.status === "ready" ? "published" : f.status,
      source: "Knowledge base",
    }));
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { question: string; answer: string; id?: string };
    const row = await upsertFaq(workspaceId, body);
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteFaq(workspaceId, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
