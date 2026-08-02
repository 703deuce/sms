import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listConnections } from "@/lib/integrations/connections";
import {
  CATEGORY_LABELS,
  EXISTING_CRM_UI_ENTRIES,
  NATIVE_PROVIDER_UI_CATALOG,
  connectWithCredentials,
  disconnectExternalIntegration,
  enqueueIntegrationSync,
  getCapabilityMatrix,
  getIntegrationDiagnosticsSnapshot,
  getIntegrationPreferences,
  isExternalProvider,
  oauthEnvReady,
  rotateCredentials,
  runIntegrationAcceptance,
  runIntegrationProbe,
  saveIntegrationPreferences,
  startExternalOAuth,
} from "@/lib/integrations/framework";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const view = url.searchParams.get("view") || "catalog";

    if (provider && isExternalProvider(provider)) {
      if (view === "diagnostics") {
        const snapshot = await getIntegrationDiagnosticsSnapshot(auth.workspaceId, provider);
        return NextResponse.json({ data: snapshot });
      }
      if (view === "settings") {
        const preferences = await getIntegrationPreferences(auth.workspaceId, provider);
        return NextResponse.json({ data: { preferences } });
      }
      if (view === "env") {
        return NextResponse.json({ data: oauthEnvReady(provider) });
      }
    }

    // Always return the catalog even if connection lookup fails — empty UI blocks connect.
    let byProvider: Record<string, Awaited<ReturnType<typeof listConnections>>[number]> = {};
    try {
      const connections = await listConnections(auth.workspaceId);
      byProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));
    } catch (err) {
      console.warn(
        "[integrations/native] listConnections failed",
        err instanceof Error ? err.message : err,
      );
    }

    return NextResponse.json({
      data: {
        catalog: NATIVE_PROVIDER_UI_CATALOG,
        categories: CATEGORY_LABELS,
        existingCrm: EXISTING_CRM_UI_ENTRIES,
        capabilities: getCapabilityMatrix().filter((c) => c.id !== "mailchimp"),
        connections: NATIVE_PROVIDER_UI_CATALOG.map((p) => ({
          ...p,
          connection: byProvider[p.id] || null,
          env: p.authKind === "oauth" ? oauthEnvReady(p.id) : null,
        })),
        crmConnections: EXISTING_CRM_UI_ENTRIES.map((p) => ({
          ...p,
          connection: byProvider[p.id] || null,
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      action?: string;
      credentials?: Record<string, string>;
      preferences?: Record<string, unknown>;
      probe?: string;
    };

    const provider = body.provider?.trim();
    if (!provider || !isExternalProvider(provider)) {
      return NextResponse.json({ error: "Valid native provider required" }, { status: 400 });
    }

    const action = body.action || "connect";

    if (action === "oauth_start") {
      const result = await startExternalOAuth(auth.workspaceId, provider);
      return NextResponse.json({ data: result });
    }

    if (action === "connect_credentials" || action === "connect") {
      const result = await connectWithCredentials({
        workspaceId: auth.workspaceId,
        provider,
        credentials: body.credentials || {},
        actorUserId: auth.session.userId || null,
      });
      return NextResponse.json({ data: result });
    }

    if (action === "rotate") {
      const result = await rotateCredentials({
        workspaceId: auth.workspaceId,
        provider,
        credentials: body.credentials || {},
        actorUserId: auth.session.userId || null,
      });
      return NextResponse.json({ data: result });
    }

    if (action === "disconnect") {
      const result = await disconnectExternalIntegration(
        auth.workspaceId,
        provider,
        auth.session.userId || null,
      );
      return NextResponse.json({ data: result });
    }

    if (action === "sync") {
      const run = await enqueueIntegrationSync({
        workspaceId: auth.workspaceId,
        provider,
        kind: "manual",
        triggeredBy: auth.session.userId || null,
      });
      return NextResponse.json({ data: { syncRunId: run.id } });
    }

    if (action === "save_settings") {
      const preferences = await saveIntegrationPreferences(
        auth.workspaceId,
        provider,
        (body.preferences || {}) as Parameters<typeof saveIntegrationPreferences>[2],
      );
      return NextResponse.json({ data: { preferences } });
    }

    if (action === "probe") {
      const probe = (body.probe || "validate") as Parameters<typeof runIntegrationProbe>[2];
      const result = await runIntegrationProbe(
        auth.workspaceId,
        provider,
        probe,
        auth.session.userId || null,
      );
      return NextResponse.json({ data: result });
    }

    if (action === "acceptance") {
      const result = await runIntegrationAcceptance(auth.workspaceId, provider);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
