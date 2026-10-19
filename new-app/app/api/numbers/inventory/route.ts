import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  loadMctbConnections,
  loadOwnedNumbers,
  loadPlatformSender,
  loadPortRequests,
  syncTelnyxIntoWorkspace,
} from "@/lib/server/numbers/inventory";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    if (url.searchParams.get("sync") === "1" || url.searchParams.get("sync") === "true") {
      await syncTelnyxIntoWorkspace(workspaceId);
    }

    const [owned, connections, ports, platform] = await Promise.all([
      loadOwnedNumbers(workspaceId),
      loadMctbConnections(workspaceId),
      loadPortRequests(workspaceId),
      loadPlatformSender(),
    ]);

    return NextResponse.json({
      data: { owned, connections, ports, platform },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
