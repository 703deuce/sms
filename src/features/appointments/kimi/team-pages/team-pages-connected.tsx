"use client";

import "@/components/appointments/kimi-ui/team-pages/reference.css";
import { TeamPagesClient } from "@/components/appointments/kimi-ui/team-pages/components/TeamPagesClient";

export function TeamPagesConnected({ workspaceSlug }: { workspaceSlug: string }) {
  return <TeamPagesClient workspaceSlug={workspaceSlug} />;
}
