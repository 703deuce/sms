import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { WorkflowDefinition, WorkflowFieldSpec, WorkflowNode } from "./schema";

export function manifestToWorkflowFields(
  manifest: RuntimeFieldManifestEntry[],
): WorkflowFieldSpec[] {
  return manifest.map((field) => ({
    id: field.field_id,
    type: field.type,
    required: field.required,
    label: field.label,
    instruction: field.collection_instruction,
  }));
}

/** Merge agent field manifest into manifestDriven collect_fields nodes. */
export function hydrateWorkflowDefinition(
  definition: WorkflowDefinition,
  fieldManifest: RuntimeFieldManifestEntry[],
): WorkflowDefinition {
  const nodes: WorkflowNode[] = definition.nodes.map((node) => {
    if (node.type !== "collect_fields") return node;
    if (!node.metadata?.manifestDriven) return node;
    if (node.fields && node.fields.length > 0) return node;
    return {
      ...node,
      fields: manifestToWorkflowFields(fieldManifest),
    };
  });
  return { ...definition, nodes };
}
