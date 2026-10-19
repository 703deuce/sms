import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { publishReceptionist } from "@/lib/server/receptionist/agent-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const result = await publishReceptionist(workspaceId);
    if (!result.ok) {
      return NextResponse.json({ data: result, error: result.errors?.join(" ") }, { status: 422 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}
