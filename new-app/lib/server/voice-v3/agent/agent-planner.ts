import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import { deriveVoiceV3Capabilities } from "./capability-state";
import { chooseNextConversationAction } from "./choose-next-conversation-action";
import { evaluateAllowedClaims } from "./evaluate-claims";
import { evaluateGoals } from "./evaluate-goals";
import { evaluateOperations } from "./evaluate-operations";
import { evaluateRecoveryBlocker } from "./evaluate-recovery-blocker";
import { evaluateRequirements } from "./evaluate-requirements";
import type { AgentStateSnapshot } from "./agent-state-snapshot";

export function planAgentState(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  now?: Date,
): AgentStateSnapshot {
  const rules = evaluateVoiceV3Rules(ctx, config);
  const goals = evaluateGoals(ctx);
  const requirements = evaluateRequirements(ctx, rules, config);
  const operations = evaluateOperations(ctx, rules);
  const recovery = evaluateRecoveryBlocker({ ctx, rules, config, now });
  const claims = evaluateAllowedClaims(ctx);
  const nextConversationAction = chooseNextConversationAction({
    ctx,
    rules,
    config,
    goals,
    requirements,
    operations,
    recovery,
  });

  return {
    stateVersion: ctx.runtime.version,
    activeGoal: goals.active,
    goalStatus: goals.status,
    knownFieldKeys: requirements.known,
    missingRequiredFieldKeys: requirements.missing,
    schedulingStatus: requirements.schedulingStatus,
    availabilityStatus: requirements.availabilityStatus,
    appointmentStatus: requirements.appointmentStatus,
    activeOperations: operations.active,
    blocker: recovery.blocker,
    nextConversationAction,
    safeNextBackendActions: operations.safeNextActions,
    allowedClaims: claims.allowed,
    forbiddenClaims: claims.forbidden,
    capabilities: deriveVoiceV3Capabilities(config),
  };
}
