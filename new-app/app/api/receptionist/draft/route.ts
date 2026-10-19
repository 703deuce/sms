import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { patchReceptionistDraft } from "@/lib/server/receptionist/agent-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import type { AgentConfig } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      editor: AgentConfig;
      expectedRevision?: number;
    };
    if (!body.editor) {
      return NextResponse.json({ error: "editor is required" }, { status: 400 });
    }
    const state = await patchReceptionistDraft(
      workspaceId,
      body.editor,
      body.expectedRevision,
    );
    return NextResponse.json({ data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("updated elsewhere")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return jsonError(err, 500);
  }
}
