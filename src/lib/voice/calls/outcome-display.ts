import type { CallOutcomeBadge } from "./display";
import {
  type CallAttentionBadge,
  type CallListOutcomeDisplay,
  type CallRowOutcomeInput,
  deriveAttentionBadge,
  deriveCallDetailMaterialOutcomes,
  deriveCallListOutcomeDisplay,
} from "./outcome-classification";

export type { CallAttentionBadge, CallListOutcomeDisplay, CallRowOutcomeInput };

export {
  deriveAttentionBadge,
  deriveCallDetailMaterialOutcomes,
  deriveCallListOutcomeDisplay,
};

export function deriveCallOutcomeBadge(call: CallRowOutcomeInput): CallOutcomeBadge {
  return deriveCallListOutcomeDisplay(call).primary;
}
