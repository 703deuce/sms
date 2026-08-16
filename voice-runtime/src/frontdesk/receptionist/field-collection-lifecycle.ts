import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistFieldCollectionResult } from "./field-collection-task";
import {
  formatToolFeedbackForModel,
  TOOL_RESULT_COLLECT_ACTIVE_SILENT,
} from "@/lib/voice/tool-feedback";
import { toolFeedbackFromCollectionResult } from "../../tool-feedback-lifecycle";

export { TOOL_RESULT_COLLECT_ACTIVE_SILENT };

/** Build structured TOOL_FEEDBACK from runtime state — not conversational replay. */
export function buildReceptionistCollectionToolResult(
  ud: FrontDeskUserData,
  result: ReceptionistFieldCollectionResult,
): string {
  return formatToolFeedbackForModel(toolFeedbackFromCollectionResult(ud, result));
}
