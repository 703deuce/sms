import { NextResponse } from "next/server";
import {
  genericTopPicksMarket,
  resolveUserLocation,
} from "@/lib/geo/resolve-user-location";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { getPopularInventory } from "@/lib/premium-numbers/popular-inventory";

type LocalizeBody = {
  lat?: number;
  lng?: number;
  cityOrZip?: string;
};

/** Generic nationwide picks — no IP geolocation. */
export async function GET() {
  try {
    const market = genericTopPicksMarket();
    const shelf = await getPopularInventory({
      areaCodes: market.likelyAreaCodes,
      marketSlug: market.marketSlug,
      maxResults: 12,
    });

    return NextResponse.json({
      market: { ...market, localized: false },
      items: shelf.items,
      searchLogId: shelf.searchLogId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load top picks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** User-initiated local picks via browser location or city/ZIP. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as LocalizeBody | null;
    const hasCoords = body?.lat != null && body?.lng != null;
    const cityOrZip = body?.cityOrZip?.trim();

    if (!hasCoords && !cityOrZip) {
      return NextResponse.json({ error: "Provide lat/lng or cityOrZip" }, { status: 400 });
    }

    const resolved = await resolveUserLocation({
      lat: body?.lat,
      lng: body?.lng,
      cityOrZip,
      source: hasCoords ? "browser" : "city_or_zip",
    });

    trackNumbersLandingEvent("geo_market_detected", {
      marketSlug: resolved.marketSlug,
      source: resolved.source,
      localized: true,
    });

    const shelf = await getPopularInventory({
      areaCodes: resolved.likelyAreaCodes,
      marketSlug: resolved.marketSlug,
      maxResults: 12,
    });

    return NextResponse.json({
      market: {
        marketSlug: resolved.marketSlug,
        metroLabel: resolved.metroLabel,
        likelyAreaCodes: resolved.likelyAreaCodes,
        city: resolved.city,
        region: resolved.region,
        localized: true,
        source: resolved.source,
      },
      items: shelf.items,
      searchLogId: shelf.searchLogId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load local picks";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
