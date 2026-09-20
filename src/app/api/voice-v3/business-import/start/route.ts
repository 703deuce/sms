import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { startBusinessImport } from "@/lib/voice-v3/business-import/service";
import type { BusinessImportTrigger } from "@/lib/voice-v3/business-import/types";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      voiceAgentId?: string;
      trigger?: BusinessImportTrigger;
      sourceTypes?: string[];
    };
    if (!body.voiceAgentId) {
      return NextResponse.json({ error: "voiceAgentId is required" }, { status: 400 });
    }
    const row = await startBusinessImport({
      workspaceId: auth.workspaceId,
      voiceAgentId: body.voiceAgentId,
      trigger: body.trigger || "refresh",
      sourceTypes: body.sourceTypes,
    });
    return NextResponse.json({ data: { importId: row.id, status: row.status } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
