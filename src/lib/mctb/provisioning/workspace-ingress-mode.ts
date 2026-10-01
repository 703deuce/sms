import "server-only";

/** ws_1 production model: Telnyx toll-free + TeXML CFNA ingress. */
export type MctbWorkspaceIngressMode = "toll_free_texml" | "telnyx_local";

export function resolveMctbWorkspaceIngressMode(): MctbWorkspaceIngressMode {
  const raw = process.env.MCTB_WORKSPACE_INGRESS_MODE?.trim().toLowerCase();
  if (raw === "telnyx_local" || raw === "local") return "telnyx_local";
  return "toll_free_texml";
}
