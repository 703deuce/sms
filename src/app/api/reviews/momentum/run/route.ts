import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasFeature } from "@/lib/plans";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, scanBatchId, competitorLimit, lookbackDays } = body as {
      businessId?: string;
      scanBatchId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    if (!(await hasFeature(auth.organizationId, "review_momentum"))) {
      return NextResponse.json(
        { error: "Review Momentum is not included in your plan." },
        { status: 403 }
      );
    }
    const job = await dispatchFeatureJob({
      jobType: "review_momentum_run",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        scanBatchId,
        competitorLimit,
        lookbackDays,
      },
      organizationId: auth.organizationId,
      businessId,
      idempotencyKey: `review-momentum:${businessId}:${Math.floor(Date.now() / 30_000)}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue review momentum run", jobId: job.jobId },
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
    return httpErrorFromException(err, "Review momentum run failed");
  }
}
