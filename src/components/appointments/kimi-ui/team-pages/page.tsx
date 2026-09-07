import "./reference.css";
import { AppShell } from "./components/AppShell";
import { TeamPagesClient } from "./components/TeamPagesClient";
import { WORKSPACE_SLUG } from "./types";

export default function ReferencePage() {
  // Cursor: replace mock workspaceSlug with server-fetched workspace slug
  // (requireWorkspaceContext + prisma.workspace.findUnique), and wire
  // load/savePage/saveGroup to /api/appointments/team-pages and /api/appointments/types.
  return (
    <AppShell>
      <TeamPagesClient workspaceSlug={WORKSPACE_SLUG} />
    </AppShell>
  );
}
