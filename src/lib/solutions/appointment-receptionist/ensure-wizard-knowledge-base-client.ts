/** Client-side: ensure a VoiceKnowledgeBase exists for wizard upload/crawl. */
export async function ensureWizardKnowledgeBaseClient(input: {
  linkedKnowledgeBaseId?: string | null;
  solutionName?: string | null;
  businessName?: string | null;
  agentId?: string | null;
}): Promise<string> {
  if (input.linkedKnowledgeBaseId) return input.linkedKnowledgeBaseId;
  const label =
    input.businessName?.trim() ||
    input.solutionName?.trim() ||
    "Receptionist";
  const name = `${label} Knowledge`;
  const res = await fetch("/api/voice/knowledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      description: "Created from AI receptionist setup",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not create knowledge base");
  const id = String(json?.data?.id || "");
  if (!id) throw new Error("Knowledge base id missing");
  if (input.agentId) {
    const linkRes = await fetch(`/api/voice/agents/${input.agentId}/knowledge`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ knowledgeBaseIds: [id] }),
    });
    if (!linkRes.ok) {
      const linkJson = await linkRes.json().catch(() => ({}));
      throw new Error(
        (linkJson as { error?: string }).error ||
          "Knowledge base created but could not link to this receptionist",
      );
    }
  }
  return id;
}
