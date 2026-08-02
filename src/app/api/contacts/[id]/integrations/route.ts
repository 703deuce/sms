import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getCachedIntegrationContext } from "@/lib/integrations/framework/context-cache";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "1";

    const contact = await getPrisma().contact.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (refresh) {
      const { refreshIntegrationContextCache } = await import(
        "@/lib/integrations/framework/context-cache"
      );
      const summary = await refreshIntegrationContextCache(auth.workspaceId, id);
      return NextResponse.json({
        data: {
          ...(summary as object),
          refreshedAt: new Date().toISOString(),
          stale: false,
          source: "local_db",
        },
      });
    }

    const cached = await getCachedIntegrationContext(auth.workspaceId, id, {
      allowStale: true,
      triggerRefresh: true,
    });
    return NextResponse.json({
      data: {
        ...(cached.summary as object),
        refreshedAt: cached.refreshedAt,
        stale: cached.stale,
        lastError: cached.lastError,
        source: cached.source,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
