"use client";

import "@/components/help/kimi-ui/getting-started/reference.css";
import { GettingStartedPage } from "@/components/help/kimi-ui/getting-started/components/GettingStartedPage";
import type { GettingStartedData } from "@/components/help/kimi-ui/getting-started/types";

export function GettingStartedConnected({ data }: { data: GettingStartedData }) {
  return <GettingStartedPage data={data} />;
}
