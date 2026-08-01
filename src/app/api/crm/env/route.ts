import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { checkCrmDatabase } from "@/lib/crm/db-check";
import { checkCrmEnvironment } from "@/lib/crm/env-check";
import { isCrmProvider } from "@/lib/crm/registry";
import type { CrmProviderId } from "@/lib/crm/types";

/** Environment + DB readiness for CRM production. Never returns secret values. */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const providerParam = new URL(request.url).searchParams.get("provider")?.trim();
    const provider =
      providerParam && isCrmProvider(providerParam)
        ? (providerParam as CrmProviderId)
        : undefined;

    const env = checkCrmEnvironment(provider);
    let db: Awaited<ReturnType<typeof checkCrmDatabase>> | null = null;
    try {
      db = await checkCrmDatabase();
    } catch (err) {
      db = {
        ok: false,
        items: [
          {
            table: "database",
            ok: false,
            message: err instanceof Error ? err.message : "Database check failed",
          },
        ],
      };
    }

    return NextResponse.json({
      data: {
        env,
        db,
        // Never echo secret values — only presence flags already in env-check.
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
