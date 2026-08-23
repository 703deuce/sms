import type { Metadata } from "next";
import { ReviewReplyGenerator } from "@/components/tools/review-reply-generator";

export const metadata: Metadata = {
  title: "AI Review Reply Generator (Free) | Local SEO Express",
  description:
    "Generate a professional Google review reply free. Paste the customer review, choose a tone, and copy your response.",
  alternates: {
    canonical: "https://localseoexpress.com/tools/review-response-generator/",
  },
};

export default async function ReviewResponseGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  return <ReviewReplyGenerator embed={embed} />;
}
