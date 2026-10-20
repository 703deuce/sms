import type { VoiceV3Goal } from "../state/call-context";
import type {
  AgentBlocker,
  AgentClaim,
  BackendActionKind,
  ConversationAction,
} from "./conversation-action";
import type { VoiceV3Capabilities } from "./capability-state";
import type { AgentOperationSummary } from "./async-operations";
import type { GoalStatus } from "./goal-manager";

export interface AgentStateSnapshot {
  stateVersion: number;
  activeGoal: VoiceV3Goal;
  goalStatus: GoalStatus;
  knownFieldKeys: string[];
  missingRequiredFieldKeys: string[];
  schedulingStatus: string;
  availabilityStatus: string;
  appointmentStatus: string;
  activeOperations: AgentOperationSummary[];
  blocker: AgentBlocker | null;
  nextConversationAction: ConversationAction;
  safeNextBackendActions: BackendActionKind[];
  allowedClaims: AgentClaim[];
  forbiddenClaims: AgentClaim[];
  capabilities: VoiceV3Capabilities;
}
