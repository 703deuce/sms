/**
 * Compiled agent artifacts for multi-tenant voice products.
 *
 * Policy manifest (intents, fields, booking/transfer rules) is authoritative for
 * domain runtime state. Visual workflow graphs are derived for UI only — they are
 * NOT executed turn-by-turn inside LiveKit AgentSession.
 */

export const COMPILED_POLICY_ROLE = "domain_state_policy" as const;
export const COMPILED_WORKFLOW_VISUAL_ROLE = "visualization_only" as const;

export type CompiledArtifactRoles = {
  policy: typeof COMPILED_POLICY_ROLE;
  workflowVisualization: typeof COMPILED_WORKFLOW_VISUAL_ROLE;
};

export const COMPILED_ARTIFACT_ROLES: CompiledArtifactRoles = {
  policy: COMPILED_POLICY_ROLE,
  workflowVisualization: COMPILED_WORKFLOW_VISUAL_ROLE,
};

/** Marker stored on compiled realtor artifacts — workflow graph is not a voice executor. */
export type WorkflowVisualizationMeta = {
  role: typeof COMPILED_WORKFLOW_VISUAL_ROLE;
  generatedFrom: "compiled_policy";
  executableAtVoiceRuntime: false;
};

export function workflowVisualizationMeta(): WorkflowVisualizationMeta {
  return {
    role: COMPILED_WORKFLOW_VISUAL_ROLE,
    generatedFrom: "compiled_policy",
    executableAtVoiceRuntime: false,
  };
}
