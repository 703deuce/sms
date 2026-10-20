import { createHash } from "node:crypto";

export type VoiceV3PromptFingerprint = {
  amyChars: number;
  astraChars: number;
  amySha256: string;
  astraSha256: string;
  toolSchemaCount: number;
  toolNames: string[];
};

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function buildVoiceV3PromptFingerprint(input: {
  amyInstructions: string;
  astraInstructions: string;
  toolNames: string[];
  toolSchemaCount: number;
}): VoiceV3PromptFingerprint {
  const amy = input.amyInstructions || "";
  const astra = input.astraInstructions || "";
  return {
    amyChars: amy.length,
    astraChars: astra.length,
    amySha256: sha256Hex(amy),
    astraSha256: sha256Hex(astra),
    toolSchemaCount: input.toolSchemaCount,
    toolNames: [...input.toolNames],
  };
}
