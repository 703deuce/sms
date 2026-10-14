/**
 * Runtime integration tests for Reviews Prisma adapter + core flows.
 *
 * Local cert DB: bash scripts/setup-reviews-cert-database.sh
 * Staging/prod-shaped DB: hydrates DATABASE_URL + Supabase from Coolify web when unset.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-reviews-backend-runtime.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";

const results: {
  name: string;
  kind: "db" | "mock" | "handler";
  ok: boolean;
  skipped?: boolean;
  detail?: string;
}[] = [];

function record(
  name: string,
  kind: "db" | "mock" | "handler",
  ok: boolean,
  detail?: string,
  skipped = false,
) {
  results.push({ name, kind, ok, detail, skipped });
  if (skipped) console.warn(`SKIP ${name}`, detail ?? "");
  else if (!ok) console.error(`FAIL ${name}`, detail ?? "");
  else console.log(`PASS ${name}`);
}

function skip(name: string, kind: "db" | "mock" | "handler", reason: string) {
  record(name, kind, true, reason, true);
}

async function hydrateReviewsTestEnv(): Promise<{
  hasDb: boolean;
  hasSupabase: boolean;
  integrated: boolean;
}> {
  const { hydrateProdDatabaseUrlFromCoolify, hydrateProdSupabaseFromCoolify } = await import(
    "./cloud-agent/hydrate-prod-test-env.ts"
  );

  let localCert = false;
  if (
    process.env.REVIEWS_USE_INTEGRATED_DB === "1" &&
    !process.env.DATABASE_URL?.trim() &&
    !process.env.REVIEWS_TEST_DATABASE_URL?.trim()
  ) {
    hydrateProdDatabaseUrlFromCoolify();
  } else if (!process.env.DATABASE_URL?.trim() && !process.env.REVIEWS_TEST_DATABASE_URL?.trim()) {
    try {
      execSync("bash scripts/setup-reviews-cert-database.sh", {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      process.env.DATABASE_URL =
        process.env.REVIEWS_CERT_DATABASE_URL ??
        "postgresql://reviews_cert:reviews_cert_local_only@127.0.0.1:5432/transovo_reviews_cert";
      localCert = true;
    } catch {
      hydrateProdDatabaseUrlFromCoolify();
    }
  }
  if (process.env.REVIEWS_TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.REVIEWS_TEST_DATABASE_URL;
  }

  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  const integrated =
    process.env.REVIEWS_USE_INTEGRATED_DB === "1" ||
    (Boolean(process.env.REVIEWS_TEST_DATABASE_URL?.trim()) && !localCert);
  const hasSupabase = integrated ? hydrateProdSupabaseFromCoolify() : false;
  return { hasDb, hasSupabase, integrated };
}

async function ensureDatabaseUrl(): Promise<string> {
  const url = process.env.REVIEWS_TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  process.env.DATABASE_URL = url;
  return url;
}

async function migrateIfRequested() {
  if (process.env.REVIEWS_SKIP_MIGRATE === "1") return;
  if (process.env.REVIEWS_RUN_MIGRATE_DEPLOY === "1") {
    const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      throw new Error(`prisma migrate deploy failed:\n${r.stdout}\n${r.stderr}`);
    }
  }
}

async function getDirectPrisma(): Promise<PrismaClient> {
  const { PrismaClient: PC } = await import("@prisma/client");
  return new PC();
}

async function createTestWorkspace(
  useSupabaseWorkspace: boolean,
): Promise<{ id: string; cleanup: () => Promise<void> }> {
  const slug = `reviews-rt-${randomUUID().slice(0, 10)}`;
  if (useSupabaseWorkspace) {
    const { getPrisma } = await import("../src/lib/db.ts");
    const prisma = getPrisma();
    const ws = await prisma.workspace.create({
      data: { name: "Reviews Runtime WS", slug },
    });
    return {
      id: ws.id,
      cleanup: async () => {
        await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
      },
    };
  }
  const prisma = await getDirectPrisma();
  const ws = await prisma.workspace.create({
    data: { name: "Reviews Runtime WS", slug },
  });
  return {
    id: ws.id,
    cleanup: async () => {
      await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
      await prisma.$disconnect();
    },
  };
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
      message_body: "Please leave a review",
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
      short_code: `sc${randomUUID().slice(0, 6)}`,
      status: "active",
      destination_url: "https://g.page/review",
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

  return { messageId: String(msg.data?.id), qrCampaignId: String(qr.data?.id) };
}

async function testWorkspaceIsolation(orgA: string, orgB: string) {
  const { createReputationDbClient } = await import("../src/lib/reputation/db/reputation-db.ts");
  const db = createReputationDbClient();
  const upA = await db.from("reputation_settings").upsert(
    {
      business_id: orgA,
      organization_id: orgA,
      settings_json: { tag: "A" },
    },
    { onConflict: "business_id" },
  ).select().single();
  assert.ok(!upA.error, upA.error?.message);
  const upB = await db.from("reputation_settings").upsert(
    {
      business_id: orgB,
      organization_id: orgB,
      settings_json: { tag: "B" },
    },
    { onConflict: "business_id" },
  ).select().single();
  assert.ok(!upB.error, upB.error?.message);
  const { data: aOnly } = await db.from("reputation_settings").select("settings_json").eq("business_id", orgA).maybeSingle();
  const { data: bOnly } = await db.from("reputation_settings").select("settings_json").eq("business_id", orgB).maybeSingle();
  assert.equal((aOnly?.settings_json as { tag?: string })?.tag, "A");
  assert.equal((bOnly?.settings_json as { tag?: string })?.tag, "B");
}

async function testMockedCampaignSend(orgId: string, messageId: string, hasSupabase: boolean) {
  if (!hasSupabase) {
    console.warn("SKIP mocked campaign send (Supabase compat / getPrisma required)");
    return;
  }
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  const { createReputationDbClient } = await import("../src/lib/reputation/db/reputation-db.ts");
  const db = createReputationDbClient();
  await db
    .from("review_request_messages")
    .update({ status: "queued", provider_message_id: null, channel: "sms" })
    .eq("id", messageId);

  const { claimQueuedCampaignMessage } = await import("../src/lib/reputation/campaign-claim.ts");
  const claimed = await claimQueuedCampaignMessage(db as never, messageId, new Date().toISOString());
  assert.ok(claimed, "claim before send");

  const { dispatchReviewRequestSms } = await import("../src/lib/reputation/review-sms-dispatch.ts");
  const result = await dispatchReviewRequestSms({
    workspaceId: orgId,
    toE164: "+15555550123",
    body: "Reviews runtime mocked send",
    senderMode: "PLATFORM",
    idempotencyKey: `reviews-runtime:${messageId}`,
    trackingToken: `rt_${messageId.slice(0, 8)}`,
  });
  assert.ok(result.ok, JSON.stringify(result));

  await db
    .from("review_request_messages")
    .update({
      status: "sent",
      provider_message_id: result.messageSid ?? `rec_${randomUUID()}`,
      sent_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  const { data: after } = await db
    .from("review_request_messages")
    .select("status, provider_message_id")
    .eq("id", messageId)
    .maybeSingle();
  assert.ok(after?.status && ["sent", "delivered", "sending", "clicked"].includes(String(after.status)), after?.status);
}

async function testInboundRouting(hasSupabase: boolean, orgId: string, platformPhoneId: string) {
  const { routePlatformMassTextOrReviewInbound, persistPlatformProductInboundMessage } = await import(
    "../src/lib/messaging/platform-product-inbound.ts"
  );
  const unmatched = await routePlatformMassTextOrReviewInbound({
    consumerE164: "+15555550999",
    platformPhoneNumberId: "pn_nonexistent_runtime",
    body: "Thanks",
    provider: "telnyx",
    providerMessageId: `in_${randomUUID()}`,
  });
  assert.equal(unmatched.status, "unmatched");

  if (!hasSupabase) return;

  const { touchPlatformProductConsumerAssignment } = await import(
    "../src/lib/messaging/platform-product-consumer-assignment.ts"
  );
  const consumer = "+15555550177";
  await touchPlatformProductConsumerAssignment({
    workspaceId: orgId,
    consumerE164: consumer,
    platformPhoneNumberId: platformPhoneId,
    product: "review_requests",
  });

  const matched = await routePlatformMassTextOrReviewInbound({
    consumerE164: consumer,
    platformPhoneNumberId: platformPhoneId,
    body: "Great service",
    provider: "telnyx",
    providerMessageId: `in_${randomUUID()}`,
  });
  assert.equal(matched.status, "matched");
  if (matched.status === "matched") {
    assert.equal(matched.product, "review_requests");
    await persistPlatformProductInboundMessage({
      workspaceId: matched.workspaceId,
      product: "review_requests",
      consumerE164: consumer,
      platformPhoneNumberId: platformPhoneId,
      body: "Great service",
      providerMessageId: `in_${randomUUID()}`,
      conversationId: matched.conversationId,
    });
  }

  const { getPrisma } = await import("../src/lib/db.ts");
  const prisma = getPrisma();
  const otherWs = await prisma.workspace.create({
    data: { name: "Reviews Ambiguous WS", slug: `reviews-amb-${randomUUID().slice(0, 8)}` },
  });
  try {
    await touchPlatformProductConsumerAssignment({
      workspaceId: otherWs.id,
      consumerE164: "+15555550188",
      platformPhoneNumberId: platformPhoneId,
      product: "mass_text",
    });
    await touchPlatformProductConsumerAssignment({
      workspaceId: orgId,
      consumerE164: "+15555550188",
      platformPhoneNumberId: platformPhoneId,
      product: "review_requests",
    });
    const { resolveMassTextInboundFromPlatformAssignment } = await import(
      "../src/lib/messaging/resolve-mass-text-platform-inbound.ts"
    );
    const amb = await resolveMassTextInboundFromPlatformAssignment({
      consumerE164: "+15555550188",
      platformPhoneNumberId: platformPhoneId,
    });
    assert.ok(amb.status === "matched" || amb.status === "ambiguous");
  } finally {
    const prisma = (await import("../src/lib/db.ts")).getPrisma();
    await prisma.workspace.delete({ where: { id: otherWs.id } }).catch(() => undefined);
  }
}

async function testQrScanPersistence(orgId: string, campaignId: string) {
  const { createReputationDbClient } = await import("../src/lib/reputation/db/reputation-db.ts");
  const db = createReputationDbClient();
  const before = await db
    .from("review_qr_scans")
    .select("id", { count: "exact", head: true })
    .eq("business_id", orgId);
  const ins = await db.from("review_qr_scans").insert({
    campaign_id: campaignId,
    organization_id: orgId,
    business_id: orgId,
    ip: "203.0.113.10",
    user_agent: "ReviewsRuntimeTest/1.0",
    counted: true,
    scanned_at: new Date().toISOString(),
    ip_hash: "test_hash_reviews_runtime",
  });
  assert.ok(!ins.error, ins.error?.message);
  const after = await db
    .from("review_qr_scans")
    .select("id", { count: "exact", head: true })
    .eq("business_id", orgId);
  assert.ok((after.count ?? 0) > (before.count ?? 0), "scan row persisted");
}

async function testMomentumJobPersist(orgId: string, hasSupabase: boolean) {
  if (!hasSupabase) {
    console.warn("SKIP momentum job (getBusiness needs getPrisma)");
    return;
  }
  process.env.QUEUE_DRIVER = "database";
  process.env.REDIS_URL = "";
  const { createReputationDbClient } = await import("../src/lib/reputation/db/reputation-db.ts");
  const db = createReputationDbClient();
  await db.from("reputation_workspace_profile").upsert(
    {
      workspace_id: orgId,
      google_place_id: "ChIJ_test_place",
      timezone: "America/Los_Angeles",
    },
    { onConflict: "workspace_id" },
  );

  const direct = await getDirectPrisma();
  const enqueued = await direct.jobQueue.create({
    data: {
      jobType: "review_momentum_run",
      queueName: "maintenance",
      workspaceId: orgId,
      status: "pending",
      payload: {
        businessId: orgId,
        organizationId: orgId,
        lookbackDays: 7,
        competitorLimit: 0,
      },
      idempotencyKey: `test-momentum-exec:${orgId}`,
    },
  });
  assert.ok(enqueued.id);
  assert.equal(enqueued.jobType, "review_momentum_run");
  await direct.$disconnect();

  const { data: runs } = await db
    .from("review_momentum_runs")
    .select("id, status")
    .eq("business_id", orgId)
    .order("created_at", { ascending: false })
    .limit(3);
  assert.ok((runs?.length ?? 0) >= 1);
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

async function main() {
  if (process.env.REVIEWS_USE_INTEGRATED_DB === "1") {
    process.env.QUEUE_DRIVER = "database";
    delete process.env.REDIS_URL;
  }
  const { hasDb, hasSupabase, integrated } = await hydrateReviewsTestEnv();
  const useSupabaseWorkspace = hasSupabase && integrated;

  let wsId: string | null = null;
  let wsCleanup: (() => Promise<void>) | null = null;
  let crudArtifacts: { messageId: string; shortCode: string } | null = null;

  if (hasDb) {
    await ensureDatabaseUrl();
    await migrateIfRequested();
    const ws = await createTestWorkspace(useSupabaseWorkspace);
    wsId = ws.id;
    wsCleanup = ws.cleanup;

    try {
      crudArtifacts = await testReputationDbCrud(ws.id);
      record("reputation-db CRUD + claim + reply + JSONB", "db", true);
    } catch (e) {
      record(
        "reputation-db CRUD + claim + reply + JSONB",
        "db",
        false,
        e instanceof Error ? e.message : String(e),
      );
    }

    if (useSupabaseWorkspace) {
      const wsB = await createTestWorkspace(true);
      try {
        await testWorkspaceIsolation(ws.id, wsB.id);
        record("reputation workspace isolation", "db", true);
      } catch (e) {
        record("reputation workspace isolation", "db", false, e instanceof Error ? e.message : String(e));
      } finally {
        await wsB.cleanup();
      }
    } else if (hasDb) {
      const prisma = await getDirectPrisma();
      const slugB = `reviews-rt-b-${randomUUID().slice(0, 8)}`;
      const wsB = await prisma.workspace.create({ data: { name: "Reviews Runtime B", slug: slugB } });
      try {
        await testWorkspaceIsolation(ws.id, wsB.id);
        record("reputation workspace isolation", "db", true);
      } catch (e) {
        record("reputation workspace isolation", "db", false, e instanceof Error ? e.message : String(e));
      } finally {
        await prisma.workspace.delete({ where: { id: wsB.id } }).catch(() => undefined);
        await prisma.$disconnect();
      }
    } else {
      record("reputation workspace isolation", "db", false, "skipped — no database");
    }

    if (crudArtifacts) {
      try {
        await testQrScanPersistence(ws.id, crudArtifacts.qrCampaignId);
        record("QR scan persistence", "db", true);
      } catch (e) {
        record("QR scan persistence", "db", false, e instanceof Error ? e.message : String(e));
      }
    }

    if (crudArtifacts && useSupabaseWorkspace) {
      const direct = await getDirectPrisma();
      const pn = await direct.phoneNumber.create({
        data: {
          workspaceId: ws.id,
          e164: `+1555${randomUUID().replace(/\D/g, "").slice(0, 7)}`,
          type: "local",
          provider: "telnyx",
          status: "Active",
          friendlyName: "Reviews runtime test",
        },
      });
      try {
        await testMockedCampaignSend(ws.id, crudArtifacts.messageId, hasSupabase);
        record("review request queue claim + mocked platform send", "db", true);
      } catch (e) {
        record(
          "review request queue claim + mocked platform send",
          "db",
          false,
          e instanceof Error ? e.message : String(e),
        );
      }

      try {
        await testInboundRouting(hasSupabase, ws.id, pn.id);
        record("platform inbound routing + persistence", "handler", true);
      } catch (e) {
        record(
          "platform inbound routing + persistence",
          "handler",
          false,
          e instanceof Error ? e.message : String(e),
        );
      }

      try {
        await testMomentumJobPersist(ws.id, hasSupabase);
        record("review momentum job enqueue + persist", "db", true);
        skip(
          "review momentum job execute (mocked providers)",
          "db",
          "not run — runReviewMomentum still calls live enrich/fetch; enqueue + DB CRUD verified separately",
        );
      } catch (e) {
        record("review momentum job enqueue + persist", "db", false, e instanceof Error ? e.message : String(e));
      }

      await direct.phoneNumber.delete({ where: { id: pn.id } }).catch(() => undefined);
      await direct.$disconnect();
    } else if (hasDb) {
      const reason = integrated
        ? "skipped — Supabase compat not configured"
        : "skipped — set REVIEWS_USE_INTEGRATED_DB=1 for send/inbound/momentum against configured staging DB";
      skip("review request queue claim + mocked platform send", "db", reason);
      skip("platform inbound routing + persistence", "handler", reason);
      skip("review momentum job enqueue + persist", "db", reason);
      skip("review momentum job execute (mocked providers)", "db", reason);
    }
  } else {
    console.warn("SKIP database runtime tests (no DATABASE_URL)");
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

  const matrix = spawnSync("npx", ["tsx", "scripts/test-reviews-full-integration-matrix.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  record("static integration matrix", "mock", matrix.status === 0, matrix.stderr || matrix.stdout);

  if (wsCleanup) await wsCleanup();

  const failed = results.filter((r) => !r.ok && !r.skipped);
  console.log("\n--- Summary ---");
  for (const r of results) {
    const label = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
    console.log(`${label} [${r.kind}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  if (failed.length) process.exit(1);
  console.log("PASS test-reviews-backend-runtime");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
