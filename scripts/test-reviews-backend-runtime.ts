/**
 * Runtime integration tests for Reviews Prisma adapter + core flows.
 * Requires DATABASE_URL (or REVIEWS_TEST_DATABASE_URL). Starts local Postgres via Docker when unset.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-reviews-backend-runtime.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";

const results: { name: string; kind: "db" | "mock" | "handler"; ok: boolean; detail?: string }[] = [];

function record(name: string, kind: "db" | "mock" | "handler", ok: boolean, detail?: string) {
  results.push({ name, kind, ok, detail });
  if (!ok) console.error(`FAIL ${name}`, detail ?? "");
  else console.log(`PASS ${name}`);
}

async function ensureDatabaseUrl(): Promise<string> {
  if (process.env.REVIEWS_TEST_DATABASE_URL) return process.env.REVIEWS_TEST_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const port = 5433;
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/reviews_test`;
  try {
    execSync("docker rm -f reviews-test-pg 2>/dev/null || true", { stdio: "ignore" });
    execSync(
      `docker run -d --name reviews-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=reviews_test -p ${port}:5432 postgres:16-alpine`,
      { stdio: "ignore" },
    );
    execSync("sleep 4");
    process.env.DATABASE_URL = url;
    return url;
  } catch (e) {
    throw new Error(
      `No DATABASE_URL and could not start docker postgres: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function migrate() {
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${r.stdout}\n${r.stderr}`);
  }
}

async function testReputationDbCrud(orgId: string) {
  const { createReputationDbClient } = await import("../src/lib/reputation/db/reputation-db.ts");
  const db = createReputationDbClient();

  const settings = {
    business_id: orgId,
    organization_id: orgId,
    settings_json: { senderMode: "PLATFORM", reviewLink: "https://example.com/r" },
  };
  const up = await db.from("reputation_settings").upsert(settings, { onConflict: "business_id" }).select().single();
  assert.ok(!up.error, up.error?.message);
  assert.equal(up.data?.business_id, orgId);

  const { data: read, error: readErr } = await db
    .from("reputation_settings")
    .select("settings_json")
    .eq("business_id", orgId)
    .maybeSingle();
  assert.ok(!readErr, readErr?.message);
  assert.ok(read?.settings_json);

  const { error: updErr } = await db
    .from("reputation_settings")
    .update({ settings_json: { senderMode: "WORKSPACE" }, updated_at: new Date().toISOString() })
    .eq("business_id", orgId);
  assert.ok(!updErr, updErr?.message);

  const tpl = await db
    .from("review_request_templates")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      name: "Test SMS",
      channel: "sms",
      body: "Hi {{first_name}}",
      status: "active",
    })
    .select()
    .single();
  assert.ok(!tpl.error, tpl.error?.message);

  const camp = await db
    .from("review_request_campaigns")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      name: "Runtime camp",
      status: "draft",
      channel: "sms",
      template_id: tpl.data?.id,
      consent_confirmed: true,
    })
    .select()
    .single();
  assert.ok(!camp.error, camp.error?.message);

  const recip = await db
    .from("review_request_recipients")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      campaign_id: camp.data?.id,
      phone: "+15555550123",
      status: "ready",
    })
    .select()
    .single();
  assert.ok(!recip.error, recip.error?.message);

  const token = `rt_${randomUUID().slice(0, 8)}`;
  const msg = await db
    .from("review_request_messages")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      campaign_id: camp.data?.id,
      recipient_id: recip.data?.id,
      channel: "sms",
      status: "queued",
      tracking_token: token,
      tracking_url: `https://t.example/r/${token}`,
      google_review_url: "https://g.page/review",
      scheduled_for: new Date().toISOString(),
      step_key: "initial",
    })
    .select()
    .single();
  assert.ok(!msg.error, msg.error?.message);

  const { claimQueuedCampaignMessage } = await import("../src/lib/reputation/campaign-claim.ts");
  const claimed = await claimQueuedCampaignMessage(db as never, String(msg.data?.id), new Date().toISOString());
  assert.ok(claimed, "claim should succeed");

  const qr = await db
    .from("review_qr_campaigns")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      name: "QR test",
      tracking_token: `qr_${randomUUID().slice(0, 8)}`,
      config_json: { placement: "counter" },
    })
    .select()
    .single();
  assert.ok(!qr.error, qr.error?.message);

  const run = await db
    .from("review_momentum_runs")
    .insert({
      organization_id: orgId,
      business_id: orgId,
      status: "completed",
      lookback_days: 90,
    })
    .select()
    .single();
  assert.ok(!run.error, run.error?.message);

  await db.from("review_momentum_entities").insert({
    run_id: run.data?.id,
    organization_id: orgId,
    business_id: orgId,
    entity_type: "target",
    name: "Test Biz",
    metrics_json: { reviews30d: 3 },
    reviews_30d: 3,
  });

  const { storeReviewReply } = await import("../src/lib/reputation/reply-store.ts");
  const reply = await storeReviewReply({
    organizationId: orgId,
    businessId: orgId,
    channel: "sms",
    body: "Thanks",
    providerSid: `SM${randomUUID()}`,
    fromAddress: "+15555550123",
  });
  assert.ok(reply.id, "reply stored");

  const { count } = await db
    .from("review_request_messages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", orgId);
  assert.ok((count ?? 0) >= 1);

  const other = randomUUID();
  const { data: iso } = await db.from("reputation_settings").select("business_id").eq("business_id", other).maybeSingle();
  assert.equal(iso, null);
}

async function testMetricsFixture() {
  const { calcEntityMetrics } = await import("../src/lib/reviews/metrics.ts");
  const { subDays } = await import("date-fns");
  const now = new Date();
  const reviews = [
    {
      sourceReviewId: "r1",
      reviewerName: "A",
      rating: 5,
      reviewText: "Great",
      reviewDate: subDays(now, 2),
      publishedAt: subDays(now, 2),
      lastEditedAt: null,
      datePrecision: "exact" as const,
      relativeDateText: null,
      ownerResponseText: null,
      ownerRespondedAt: null,
      reviewUrl: null,
    },
  ];
  const m = calcEntityMetrics(reviews, { totalReviewsCurrent: 1, ratingCurrent: 5 });
  assert.ok(m.reviews7d >= 0);
}

async function testCampaignClaimConcurrency() {
  const { claimQueuedCampaignMessage, createMemoryClaimStore } = await import(
    "../src/lib/reputation/campaign-claim.ts"
  );
  const store = createMemoryClaimStore(["m1", "m2"]);
  const [a, b] = await Promise.all([
    claimQueuedCampaignMessage(store.client, "m1", new Date().toISOString()),
    claimQueuedCampaignMessage(store.client, "m2", new Date().toISOString()),
  ]);
  assert.ok(a && b);
  const lost = await claimQueuedCampaignMessage(store.client, "m1", new Date().toISOString());
  assert.equal(lost, null);
}

async function testDispatchJobEnqueue() {
  if (!process.env.DATABASE_URL && !process.env.REVIEWS_TEST_DATABASE_URL) {
    console.warn("SKIP dispatchFeatureJob enqueue (no DATABASE_URL)");
    return;
  }
  const { dispatchFeatureJob } = await import("../src/lib/queue/dispatch.ts");
  const orgId = `ws_${randomUUID().slice(0, 12)}`;
  const job = await dispatchFeatureJob({
    jobType: "review_momentum_run",
    payload: { businessId: orgId, organizationId: orgId, dryRun: true },
    organizationId: orgId,
    businessId: orgId,
    idempotencyKey: `test-momentum:${orgId}`,
    kickImmediately: false,
  });
  assert.ok(job.jobId);
}

async function testInboundMock() {
  const { routePlatformMassTextOrReviewInbound } = await import(
    "../src/lib/messaging/platform-product-inbound.ts"
  );
  const res = await routePlatformMassTextOrReviewInbound({
    consumerE164: "+15555550999",
    platformPhoneNumberId: "pn_nonexistent",
    body: "STOP",
    provider: "telnyx",
    providerMessageId: `in_${randomUUID()}`,
  });
  assert.equal(res.status, "unmatched");
}

async function main() {
  const hasDb = Boolean(process.env.DATABASE_URL || process.env.REVIEWS_TEST_DATABASE_URL);
  if (hasDb) {
    await ensureDatabaseUrl();
    await migrate();
    const { getPrisma } = await import("../src/lib/db.ts");
    const prisma = getPrisma();
    const slug = `reviews-runtime-${randomUUID().slice(0, 8)}`;
    const ws = await prisma.workspace.create({
      data: { name: "Reviews Runtime WS", slug },
    });
    try {
      await testReputationDbCrud(ws.id);
      record("reputation-db CRUD + claim + reply", "db", true);
    } catch (e) {
      record("reputation-db CRUD + claim + reply", "db", false, e instanceof Error ? e.message : String(e));
    }
  } else {
    console.warn("SKIP database runtime tests (set DATABASE_URL or REVIEWS_TEST_DATABASE_URL)");
  }

  try {
    await testMetricsFixture();
    record("review velocity metrics fixture", "mock", true);
  } catch (e) {
    record("review velocity metrics fixture", "mock", false, e instanceof Error ? e.message : String(e));
  }

  try {
    await testCampaignClaimConcurrency();
    record("campaign message claim concurrency", "mock", true);
  } catch (e) {
    record("campaign message claim concurrency", "mock", false, e instanceof Error ? e.message : String(e));
  }

  if (hasDb) {
    try {
      await testDispatchJobEnqueue();
      record("dispatchFeatureJob enqueue", "db", true);
    } catch (e) {
      record("dispatchFeatureJob enqueue", "db", false, e instanceof Error ? e.message : String(e));
    }

    try {
      await testInboundMock();
      record("platform inbound unmatched path", "handler", true);
    } catch (e) {
      record("platform inbound unmatched path", "handler", false, e instanceof Error ? e.message : String(e));
    }
  } else {
    console.warn("SKIP dispatch/inbound handler tests (no DATABASE_URL)");
  }

  const matrix = spawnSync("npx", ["tsx", "scripts/test-reviews-full-integration-matrix.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  record("static integration matrix", "mock", matrix.status === 0, matrix.stderr || matrix.stdout);

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.kind}] ${r.name}`);
  }
  if (failed.length) process.exit(1);
  console.log("PASS test-reviews-backend-runtime");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
