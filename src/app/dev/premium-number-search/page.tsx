import { PremiumNumberSearchClient } from "./premium-number-search-client";
import { notFound } from "next/navigation";

export default function DevPremiumNumberSearchPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_VANITY_NUMBER_SEARCH !== "1"
  ) {
    notFound();
  }
  return <PremiumNumberSearchClient />;
}
