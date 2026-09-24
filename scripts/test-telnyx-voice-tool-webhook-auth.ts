/**
 * Telnyx voice tool webhook auth + tenant binding (no provider mutations).
 */
import assert from "node:assert/strict";
import { POST } from "../src/app/api/telnyx/voice/tools/route";
import {
  createTenantIsoFixture,
  deleteTenantIsoFixture,
  type TenantIsoFixture,
} from "./lib/transovo-tenant-iso-fixture";
const TEST_SECRET = "tenant-iso-telnyx-tool-webhook-test-secret";

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.TRANSOVO_INTERNAL_API_KEY;
  process.env.TRANSOVO_INTERNAL_API_KEY = TEST_SECRET;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.TRANSOVO_INTERNAL_API_KEY;
    else process.env.TRANSOVO_INTERNAL_API_KEY = prev;
  }
}

function toolRequest(
  fx: TenantIsoFixture,
  opts: {
    workspaceId: string;
    agentId: string;
    callControlId?: string;
    authorized?: boolean;
  },
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-transovo-workspace-id": opts.workspaceId,
    "x-transovo-agent-id": opts.agentId,
    "x-transovo-tool-type": "get_runtime_context",
  };
  if (opts.callControlId) {
    headers["x-telnyx-call-control-id"] = opts.callControlId;
  }
  if (opts.authorized) {
    headers.authorization = `Bearer ${TEST_SECRET}`;
  }
  return new Request("http://test.internal/api/telnyx/voice/tools", {
    method: "POST",
    headers,
    body: JSON.stringify(
      opts.callControlId ? { call_control_id: opts.callControlId } : {},
    ),
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  await withSecret(async () => {
    const fx = await createTenantIsoFixture();
    try {
      const unauth = await POST(
        toolRequest(fx, {
          workspaceId: fx.workspaceAId,
          agentId: fx.voiceAgentAId,
          authorized: false,
        }),
      );
      assert.equal(unauth.status, 401, "unauthenticated must be rejected");

      const auth = await POST(
        toolRequest(fx, {
          workspaceId: fx.workspaceAId,
          agentId: fx.voiceAgentAId,
          authorized: true,
        }),
      );
      assert.notEqual(auth.status, 401, "authenticated must not be 401");

      const mismatch = await POST(
        toolRequest(fx, {
          workspaceId: fx.workspaceAId,
          agentId: fx.voiceAgentAId,
          callControlId: fx.voiceCallBCallControlId,
          authorized: true,
        }),
      );
      assert.equal(mismatch.status, 403, "workspace/call binding mismatch must 403");

      console.log("PASS telnyx voice tool webhook auth + binding");
    } finally {
      await deleteTenantIsoFixture(fx);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
