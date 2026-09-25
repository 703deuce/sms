import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import {
  resolveMctbInboxCapabilities,
  resolveMctbInboxCapabilitiesForConversation,
} from "@/lib/mctb/inbox/resolve-inbox-capabilities";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const conversationId = new URL(req.url).searchParams.get("conversationId");

  const data = conversationId
    ? await resolveMctbInboxCapabilitiesForConversation({
        workspaceId,
        conversationId,
      })
    : await resolveMctbInboxCapabilities(workspaceId);

  return NextResponse.json({ data });
}
