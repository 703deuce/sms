import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { validateAutoAttendantMenu } from "@/lib/server/phone/routing/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const result = await validateAutoAttendantMenu(workspaceId, id);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
