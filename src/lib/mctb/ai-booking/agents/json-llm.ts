import {
  mctbSemanticModelId,
  mctbSemanticStructuredJson,
  resolveMctbSemanticLlmProvider,
} from "@/lib/mctb/semantic-llm";

export async function aiBookingStructuredJson<T>(input: {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T | null> {
  const provider = resolveMctbSemanticLlmProvider();
  const model =
    provider === "deepseek" ? mctbSemanticModelId() : input.model || mctbSemanticModelId();
  const result = await mctbSemanticStructuredJson<T>({
    system: input.system,
    user: input.user,
    model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
  return result?.data ?? null;
}
