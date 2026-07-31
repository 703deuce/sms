"use client";

import { PublicGrowWidget } from "@/components/grow/public-grow-widget";
import { useParams } from "next/navigation";

export default function EmbedGrowWidgetPage() {
  const params = useParams();
  const slug = params.slug as string;
  return <PublicGrowWidget slug={slug} />;
}
