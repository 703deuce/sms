import type { Metadata } from "next";
import { ReviewWidgetGenerator } from "@/components/tools/review-widget-generator";

export const metadata: Metadata = {
  title: "Google Review Widget Generator (Free) | Local SEO Express",
  description:
    "Create an embeddable Google review badge, review bar, or review cards for your website. Free review snippet generator.",
  alternates: {
    canonical: "https://localseoexpress.com/tools/google-review-widget/",
  },
};

export default async function GoogleReviewWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  return <ReviewWidgetGenerator embed={embed} />;
}
