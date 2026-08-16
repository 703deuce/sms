import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Detect when a prompt asks for more than the active collection field. */
export function otherMissingFieldQuestionsReferenced(
  prompt: string,
  activeFieldId: string,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
): string[] {
  const normalizedPrompt = normalizeForMatch(prompt);
  const hits: string[] = [];

  for (const field of manifest) {
    if (field.id === activeFieldId) continue;
    if (currentFields[field.id]?.trim()) continue;
    const question = field.question?.trim();
    if (!question) continue;
    const normalizedQuestion = normalizeForMatch(question);
    if (normalizedQuestion.length >= 12) {
      if (normalizedPrompt.includes(normalizedQuestion)) {
        hits.push(field.id);
        continue;
      }
      const tail = normalizedQuestion.slice(-24);
      if (tail.length >= 12 && normalizedPrompt.includes(tail)) {
        hits.push(field.id);
        continue;
      }
    }
    const fieldId = field.id.toLowerCase().replace(/_/g, " ");
    const label = field.label.toLowerCase().trim();
    if (fieldId.length >= 3 && normalizedPrompt.includes(fieldId)) {
      hits.push(field.id);
      continue;
    }
    if (label.length >= 4 && normalizedPrompt.includes(label)) {
      hits.push(field.id);
    }
  }

  return hits;
}

export function assertSingleFieldCollectionPrompt(
  prompt: string,
  activeFieldId: string,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
): void {
  const others = otherMissingFieldQuestionsReferenced(prompt, activeFieldId, manifest, currentFields);
  if (others.length > 0) {
    throw new Error(
      `Collection prompt references other missing fields: ${others.join(", ")} (active=${activeFieldId})`,
    );
  }
}
