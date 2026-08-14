"use client";

import { SmartRoutingActivityView } from "@/components/smart-routing/activity-view";
import { useParams } from "next/navigation";

export default function SmartRoutingActivityPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  return <SmartRoutingActivityView flowId={flowId} />;
}
