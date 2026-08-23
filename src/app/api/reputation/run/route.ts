import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, lookbackDays, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const rate = await assertRateLimit({
      key: `reputation-run:${auth.organizationId}`,
      maxPerWindow: 25,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }
    const job = await dispatchFeatureJob({
      jobType: "reputation_audit",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        competitorLimit,
        lookbackDays,
        forceRefresh,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `reputation-audit:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue reputation audit", jobId: job.jobId },
        { status: 503 }
      );
    }

    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      queueDriver: job.driver,
    });
  } catch (err) {
    return httpErrorFromException(err, "Reputation audit failed");
  }
}
