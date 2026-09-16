import type { SaveIntakeResult } from "./intake/save-intake-fields";
import { saveIntakePublicFields } from "./intake/format-save-tool-response";

export function formatVoiceV2SaveIntakeTelnyxResponse(
  result: SaveIntakeResult,
  sessionKey?: string,
): Record<string, unknown> {
  return saveIntakePublicFields(result, sessionKey);
}
