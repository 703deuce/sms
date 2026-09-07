"use client";

import "@/components/appointments/kimi-ui/routing-forms/reference.css";
import RoutingFormsClient from "@/components/appointments/kimi-ui/routing-forms/components/RoutingFormsClient";

export function RoutingFormsConnected({ workspaceSlug }: { workspaceSlug: string }) {
  return <RoutingFormsClient workspaceSlug={workspaceSlug} />;
}
