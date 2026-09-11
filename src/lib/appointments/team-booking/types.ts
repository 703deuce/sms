import type { AutoAssignmentMethod } from "@/lib/appointments/types";

export type TeamRequirementKind = "primary" | "required" | "optional";

export type TeamRequirementAssignment =
  | { mode: "specific_staff"; staffId: string }
  | { mode: "any_eligible"; staffIds?: string[] }
  | { mode: "staff_pool"; poolId: string };

export type TeamBookingRequirement = {
  id: string;
  label: string;
  kind: TeamRequirementKind;
  required: boolean;
  assignment: TeamRequirementAssignment;
  publicLabel?: string;
};

export type TeamBookingServiceConfig = {
  enabled?: boolean;
  templateId?: string;
  requirements?: TeamBookingRequirement[];
  customerLeadSelection?: "hidden" | "choose_lead" | "choose_lead_or_any";
  publicDisplay?: "hidden" | "lead_only" | "full_team";
  assignmentMethod?: AutoAssignmentMethod;
};

export type TeamBookingTemplate = {
  id: string;
  name: string;
  requirements: TeamBookingRequirement[];
  assignmentMethod?: AutoAssignmentMethod;
  active?: boolean;
};

export type ResolvedTeamAssignment = {
  primaryStaffId: string;
  staffIds: string[];
  assignments: Array<{ requirementId: string; staffId: string; label: string }>;
};

export type TeamCombinationCandidate = {
  staffId: string;
  eligible: boolean;
  available: boolean;
};
