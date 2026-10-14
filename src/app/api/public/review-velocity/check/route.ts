import { NextResponse } from "next/server";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { enrichTargetBusiness } from "@/lib/jobs/enrich-competitors";
import { fetchReviewsForEntity } from "@/lib/reviews/fetch-reviews";
import { calcEntityMetrics } from "@/lib/reviews/metrics";
import type { NormalizedReview } from "@/lib/reviews/normalize";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rate = await assertRateLimit({
    key: `public-review-velocity:${ip}`,
    maxPerWindow: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    placeId?: string;
    businessName?: string;
    lookbackDays?: number;
  };
  const placeId = body.placeId?.trim();
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const lookbackDays = Math.min(Math.max(body.lookbackDays ?? 90, 30), 180);
  const name = body.businessName?.trim() || "Business";

  try {
    await enrichTargetBusiness({ name, placeId, organizationId: "public" });
    const fetch = await fetchReviewsForEntity({
      placeId,
      name,
      lookbackDays,
      organizationId: "public",
      depth: 2,
    });
    const reviews: NormalizedReview[] = fetch.reviews;
    const metrics = calcEntityMetrics({
      entityName: name,
      reviews,
      lookbackDays,
    });

    return NextResponse.json({
      ok: true,
      placeId,
      lookbackDays,
      metrics,
      velocityWarning: fetch.velocityWarning ?? metrics.velocityWarning ?? null,
      stoppedReason: fetch.stoppedReason,
      providerConfigured: Boolean(process.env.SCRAPINGDOG_API_KEY || process.env.SCRAPING_DOG_API_KEY),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Velocity check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
