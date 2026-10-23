import { NextResponse } from "next/server";
import {
  authenticatePowerDialerApiKey,
  logApiAudit,
} from "./api-keys";
import { scopeAllows, type PowerDialerApiScope } from "./scopes";

export type PublicApiContext = {
  workspaceId: string;
  apiKeyId: string;
  scopes: string[];
};

export async function withPublicApi(
  request: Request,
  requiredScope: PowerDialerApiScope,
  handler: (ctx: PublicApiContext) => Promise<NextResponse>,
) {
  try {
    const auth = await authenticatePowerDialerApiKey(request.headers.get("authorization"));
    if (!auth) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }
    if (!scopeAllows(requiredScope, auth.scopes)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: `Missing scope: ${requiredScope}` } },
        { status: 403 },
      );
    }
    const idempotencyKey = request.headers.get("idempotency-key");
    const res = await handler(auth);
    await logApiAudit({
      workspaceId: auth.workspaceId,
      apiKeyId: auth.apiKeyId,
      action: "api_request",
      resource: new URL(request.url).pathname,
      detail: { scope: requiredScope, idempotencyKey },
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return NextResponse.json({ error: { code: "error", message: msg } }, { status });
  }
}

export function paginated<T>(items: T[], page: number, limit: number, total: number) {
  return {
    data: items,
    pagination: { page, limit, total, hasMore: (page + 1) * limit < total },
  };
}
