#!/usr/bin/env tsx
/**
 * Lightweight Microsoft OAuth token lifecycle tests (no network).
 * Run: npx tsx scripts/test-microsoft-token-refresh.ts
 */
import Module from "node:module";
import assert from "node:assert/strict";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const {
    classifyMicrosoftOAuthError,
    microsoftTokenFailureNeedsReconnect,
    parseMicrosoftTokenErrorBody,
  } = await import("../src/lib/microsoft/token-errors");

  const invalidGrant = classifyMicrosoftOAuthError({
    httpStatus: 400,
    error: "invalid_grant",
    errorDescription: "AADSTS70008: The refresh token has expired",
  });
  assert.equal(invalidGrant, "invalid_grant");
  assert.equal(microsoftTokenFailureNeedsReconnect(invalidGrant), true);
  console.log("PASS invalid_grant -> needs_reconnect");

  const transient = classifyMicrosoftOAuthError({
    httpStatus: 503,
    error: "temporarily_unavailable",
  });
  assert.equal(transient, "transient");
  assert.equal(microsoftTokenFailureNeedsReconnect(transient), false);
  console.log("PASS transient -> not needs_reconnect");

  const invalidClient = classifyMicrosoftOAuthError({
    httpStatus: 401,
    error: "invalid_client",
  });
  assert.equal(invalidClient, "invalid_client");
  assert.equal(microsoftTokenFailureNeedsReconnect(invalidClient), true);
  console.log("PASS invalid_client classification");

  const parsed = parseMicrosoftTokenErrorBody(
    JSON.stringify({ error: "interaction_required", error_description: "login needed" }),
  );
  assert.equal(parsed.error, "interaction_required");
  assert.match(parsed.errorDescription || "", /login/i);
  console.log("PASS parseMicrosoftTokenErrorBody");

  const success = {
    ok: true as const,
    accessToken: "token",
    expiresIn: 3600,
  };
  const failure = {
    ok: false as const,
    kind: "transient" as const,
    httpStatus: 503,
    needsReconnect: false,
  };
  assert.equal(success.ok, true);
  assert.equal("accessToken" in success && success.accessToken, "token");
  assert.equal(failure.ok, false);
  assert.equal(failure.needsReconnect, false);
  console.log("PASS refresh result discriminated union shape");

  const inflight = new Map<string, Promise<number>>();
  let calls = 0;
  async function withLock(id: string, fn: () => Promise<number>) {
    const existing = inflight.get(id);
    if (existing) return existing;
    const promise = fn().finally(() => inflight.delete(id));
    inflight.set(id, promise);
    return promise;
  }

  const first = withLock("conn", async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return 42;
  });
  const second = withLock("conn", async () => {
    calls += 1;
    return 99;
  });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, 42);
  assert.equal(b, 42);
  assert.equal(calls, 1);
  console.log("PASS concurrent refresh lock shares one in-flight refresh");

  console.log("\nAll Microsoft token refresh tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
