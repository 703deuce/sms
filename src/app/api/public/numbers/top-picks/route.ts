import { NextResponse } from "next/server";
import { metroDisplayName } from "@/lib/geo/area-code-markets";
import { getVisitorMarket } from "@/lib/geo/visitor-market";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { getPopularInventory } from "@/lib/premium-numbers/popular-inventory";

export async function GET(request: Request) {
  try {
    const market = await getVisitorMarket(request);
    const shelf = await getPopularInventory({
      areaCodes: market.likelyAreaCodes,
      marketSlug: market.marketSlug,
      maxResults: 12,
    });

    trackNumbersLandingEvent("geo_market_detected", {
      marketSlug: market.marketSlug,
      confidence: market.confidence,
      geoSource: market.geoSource,
      resultCount: shelf.items.length,
    });

    return NextResponse.json({
      market: {
        marketSlug: market.marketSlug,
        metro: market.metro,
        metroLabel: metroDisplayName(market.marketSlug),
        likelyAreaCodes: market.likelyAreaCodes,
        confidence: market.confidence,
        geoSource: market.geoSource,
        region: market.region,
        city: market.city,
      },
      items: shelf.items,
      searchLogId: shelf.searchLogId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load top picks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
