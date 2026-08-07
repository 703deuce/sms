/**
 * Workflow Architect candidate versioning — immutable versions, never mutate in place.
 */
import type { CanonicalWorkflowSpec } from "../workflow-dsl/types";
import type { ArchitectBuildResponse } from "../owner-runtime/change-requests";

export type WorkflowCandidateVersion = {
  workflow_id: string;
  version: number;
  spec: CanonicalWorkflowSpec;
  change_request_id: string;
  status: "candidate" | "validated" | "tests_passed" | "published" | "superseded" | "rejected";
  validation_passed: boolean;
  tests_passed: boolean;
  created_at: string;
  published_at?: string | null;
};

export type WorkflowVersionPointer = {
  workflow_id: string;
  production_version: number | null;
  candidates: WorkflowCandidateVersion[];
};

export function createCandidateVersion(input: {
  workflow_id: string;
  next_version: number;
  spec: CanonicalWorkflowSpec;
  change_request_id: string;
  validation_passed: boolean;
}): WorkflowCandidateVersion {
  const now = new Date().toISOString();
  return {
    workflow_id: input.workflow_id,
    version: input.next_version,
    spec: {
      ...input.spec,
      version: input.next_version,
      metadata: { ...input.spec.metadata, candidate: true, change_request_id: input.change_request_id },
    },
    change_request_id: input.change_request_id,
    status: input.validation_passed ? "validated" : "candidate",
    validation_passed: input.validation_passed,
    tests_passed: false,
    created_at: now,
  };
}

export function toArchitectBuildResponse(
  candidate: WorkflowCandidateVersion,
  tests?: { passed: number; failed: number },
  summary?: string[],
): ArchitectBuildResponse {
  if (!candidate.validation_passed) {
    return {
      status: "build_failed",
      error_code: "UNRESOLVED_WORKFLOW_VALIDATION",
      details: [{ code: "VALIDATION_FAILED", message: "Candidate failed validation" }],
    };
  }
  return {
    status: "candidate_ready",
    candidate_version: candidate.version,
    validation: "passed",
    tests,
    summary,
  };
}

export function activateProductionVersion(
  pointer: WorkflowVersionPointer,
  version: number,
): WorkflowVersionPointer {
  const candidate = pointer.candidates.find((c) => c.version === version);
  if (!candidate || !candidate.validation_passed) {
    throw new Error(`Version ${version} is not a validated candidate`);
  }
  return {
    workflow_id: pointer.workflow_id,
    production_version: version,
    candidates: pointer.candidates.map((c) => ({
      ...c,
      status: c.version === version ? "published" : c.status === "published" ? "superseded" : c.status,
      published_at: c.version === version ? new Date().toISOString() : c.published_at,
    })),
  };
}

export function rollbackProductionVersion(
  pointer: WorkflowVersionPointer,
  toVersion: number,
): WorkflowVersionPointer {
  const target = pointer.candidates.find((c) => c.version === toVersion);
  if (!target) throw new Error(`Version ${toVersion} not found`);
  return activateProductionVersion(pointer, toVersion);
}
