"use client";

import { SmartRoutingBuilderView } from "@/components/smart-routing/builder-view";
import { useParams } from "next/navigation";

export default function SmartRoutingBuilderPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  return <SmartRoutingBuilderView flowId={flowId} />;
}
