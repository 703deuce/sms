"use client";

import { SmartRoutingNewFlowView } from "@/components/smart-routing/new-flow-view";
import { useEffect, useState } from "react";

export default function SmartRoutingNewPage() {
  const [templates, setTemplates] = useState<
    Array<{ type: string; title: string; subtitle: string; bestFor: string[] }>
  >([]);

  useEffect(() => {
    fetch("/api/smart-routing/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.data ?? []));
  }, []);

  return <SmartRoutingNewFlowView templates={templates} />;
}
