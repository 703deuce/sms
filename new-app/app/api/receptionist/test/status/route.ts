import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistReadiness } from "@/lib/server/receptionist/readiness-service";
import { voiceRuntimeInternalSecret } from "@/lib/server/receptionist/runtime/auth";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const readiness = await getReceptionistReadiness(workspaceId);

    let workerReachable = false;
    let workerDetail = "not_checked";
    const secret = voiceRuntimeInternalSecret();
    if (secret) {
      const base =
        process.env.TRANSOVO_PUBLIC_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        `http://127.0.0.1:${process.env.PORT || "3100"}`;
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/api/internal/voice-runtime`, {
          headers: { Authorization: `Bearer ${secret}` },
          method: "GET",
        });
        workerReachable = res.ok;
        workerDetail = res.ok ? "ok" : `http_${res.status}`;
      } catch (e) {
        workerDetail = e instanceof Error ? e.message : "fetch_failed";
      }
    } else {
      workerDetail = "missing_internal_api_key";
    }

    return NextResponse.json({
      data: {
        readiness,
        worker: { reachable: workerReachable, detail: workerDetail },
        configurationValidated: readiness.checks.every((c) => c.id !== "publish" || c.ok),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
