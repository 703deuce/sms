import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { mergeContacts } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      primaryId?: string;
      mergedId?: string;
      fieldWinners?: Record<string, "primary" | "merged">;
    };
    if (!body.primaryId || !body.mergedId) {
      return NextResponse.json({ error: "primaryId and mergedId required" }, { status: 400 });
    }
    const data = await mergeContacts(
      workspaceId,
      body.primaryId,
      body.mergedId,
      body.fieldWinners,
    );
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
