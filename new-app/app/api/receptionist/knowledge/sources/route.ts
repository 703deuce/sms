import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  addWebsiteSource,
  listKnowledgeSources,
} from "@/lib/server/receptionist/knowledge-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listKnowledgeSources(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { url?: string; kind?: string };
    if (body.kind === "website" && body.url?.trim()) {
      const row = await addWebsiteSource(workspaceId, body.url.trim());
      return NextResponse.json({ data: row });
    }
    return NextResponse.json({ error: "url required for website source" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 500);
  }
}
