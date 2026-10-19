import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getTransferTargets, saveTransferTargets } from "@/lib/server/phone/transfer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getTransferTargets(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { targets?: { id?: string; name?: string; number?: string }[] };
    const targets = Array.isArray(body.targets) ? body.targets : [];
    const data = await saveTransferTargets(
      workspaceId,
      targets.map((t, i) => ({
        id: t.id || `t${i + 1}`,
        name: t.name || "",
        number: t.number || "",
      })),
    );
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
