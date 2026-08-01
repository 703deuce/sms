import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isCrmProvider } from "@/lib/crm/registry";
import { ingestCrmWebhook } from "@/lib/crm/runtime/webhooks";
import type { CrmProviderId } from "@/lib/crm/types";

/**
 * Inbound CRM webhooks.
 * Resolve workspace via ?workspaceId= or X-Transovo-Workspace header
 * (provider apps should be configured per-workspace callback with that query).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: raw } = await context.params;
    if (!isCrmProvider(raw)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
    }
    const provider = raw as CrmProviderId;
    const url = new URL(request.url);
    const workspaceId =
      url.searchParams.get("workspaceId")?.trim() ||
      request.headers.get("x-transovo-workspace")?.trim() ||
      "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const exists = await getPrisma().workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Unknown workspace" }, { status: 404 });
    }

    const rawBody = await request.text();
    let body: unknown = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = { raw: rawBody };
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const eventType =
      url.searchParams.get("eventType") ||
      (typeof body === "object" && body && "event" in body
        ? String((body as { event: unknown }).event)
        : null);

    const externalId =
      typeof body === "object" && body && "id" in body
        ? String((body as { id: unknown }).id)
        : null;

    const result = await ingestCrmWebhook({
      workspaceId,
      provider,
      eventType,
      externalId,
      headers,
      body,
      rawBody,
    });

    if (!result.accepted) {
      return NextResponse.json({ error: result.reason || "rejected" }, { status: 401 });
    }
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook failed" },
      { status: 500 },
    );
  }
}
