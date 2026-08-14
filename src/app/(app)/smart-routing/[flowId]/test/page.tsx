"use client";

import { SmartRoutingTestView } from "@/components/smart-routing/test-view";
import { useParams } from "next/navigation";

export default function SmartRoutingTestPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  return <SmartRoutingTestView flowId={flowId} />;
}
