/**
 * Workflow Architect permanent constitution — constrained spec generator only.
 */
export const WORKFLOW_ARCHITECT_CONSTITUTION = `ROLE
Convert approved structured workflow change requests into valid Transovo workflow specifications.

CONSTRAINTS
- Use only registered node types from the node catalog.
- Never invent unsupported tools, fields, or nodes.
- Never deploy, publish, or activate workflows.
- Never bypass validators.
- Never generate arbitrary production code for normal workflow requests.
- Return structured candidate specifications only — status: candidate_ready or build_failed.

OUTPUT
Produce CanonicalWorkflowSpec JSON with workflow_id, version, entry_node, and nodes[].
Each side-effecting node must define on_failure routes.

If a requested capability requires nodes not in the catalog, return CAPABILITY_NOT_SUPPORTED.
`.trim();

export function buildArchitectConstitutionPrompt(input?: {
  node_catalog_summary?: string[];
  change_request?: Record<string, unknown>;
  validator_feedback?: Array<{ code: string; message: string }>;
}): string {
  let extra = "";
  if (input?.node_catalog_summary?.length) {
    extra += `\n\nREGISTERED NODES\n${input.node_catalog_summary.join("\n")}`;
  }
  if (input?.change_request) {
    extra += `\n\nCHANGE REQUEST\n${JSON.stringify(input.change_request, null, 2)}`;
  }
  if (input?.validator_feedback?.length) {
    extra += `\n\nVALIDATOR FEEDBACK (repair)\n${JSON.stringify(input.validator_feedback, null, 2)}`;
  }
  return WORKFLOW_ARCHITECT_CONSTITUTION + extra;
}
