import { NumbersLandingPage } from "@/components/landing/numbers/numbers-landing-page";
import { BRAND_NAME } from "@/lib/brand";
import { getVisitorMarket } from "@/lib/geo/visitor-market";
import { getPopularInventory } from "@/lib/premium-numbers/popular-inventory";
import type { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: `Choose Your Own Phone Number | ${BRAND_NAME}`,
    },
    description:
      "Search available personal and business phone numbers, find memorable patterns with AI, buy your favorite, and transfer it to your carrier.",
    alternates: {
      canonical: "/",
    },
  };
}

export default async function HomePage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const request = new Request(`${proto}://${host}/`, {
    headers: headerList,
  });

  let initialTopPicks: Awaited<ReturnType<typeof getPopularInventory>>["items"] = [];
  let shelfSearchLogId: string | undefined;
  let defaultAreaCodes = ["571", "703"];

  try {
    const market = await getVisitorMarket(request);
    defaultAreaCodes = market.likelyAreaCodes;
    const shelf = await getPopularInventory({
      areaCodes: market.likelyAreaCodes,
      marketSlug: market.marketSlug,
      maxResults: 12,
    });
    initialTopPicks = shelf.items;
    shelfSearchLogId = shelf.searchLogId;
  } catch {
    // Top picks load client-side if server inventory unavailable
  }

  return (
    <NumbersLandingPage
      initialTopPicks={initialTopPicks}
      defaultAreaCodes={defaultAreaCodes}
      shelfSearchLogId={shelfSearchLogId}
    />
  );
}
