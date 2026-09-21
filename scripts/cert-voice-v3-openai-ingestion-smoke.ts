#!/usr/bin/env npx tsx
/**
 * One real OpenAI vector-store ingestion smoke (isolated cert workspace — not a production customer).
 * Requires: DATABASE_URL, OPENAI_API_KEY. Does not crawl websites.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/db.ts";
import {
  ensureOpenAiVectorStoreForKnowledgeBase,
  syncTextSourceToOpenAiVectorStore,
  useGptLiveFileSearchRag,
} from "../src/lib/voice/gpt-live-file-search-rag.ts";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config.ts";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config.ts";
import { resolveAgentKnowledgeRetrieval } from "../src/lib/voice-v3/knowledge/resolve-agent-knowledge-retrieval.ts";

function redactId(id: string): string {
  const t = id.trim();
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("CERT_OPENAI_INGESTION_BLOCKED: missing DATABASE_URL");
    process.exit(2);
  }
  if (!useGptLiveFileSearchRag()) {
    console.error(
      "CERT_OPENAI_INGESTION_BLOCKED: OPENAI_API_KEY missing or VOICE_KNOWLEDGE_TELNYX_RAG=1",
    );
    process.exit(2);
  }

  const prisma = getPrisma();
  const tag = `v3_ingest_cert_${Date.now()}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: `Voice V3 OpenAI ingest cert ${tag}`,
      slug: `v3-ingest-cert-${randomUUID().slice(0, 8)}`,
    },
    select: { id: true },
  });
  const workspaceId = workspace.id;

  const kb = await prisma.voiceKnowledgeBase.create({
    data: {
      workspaceId,
      name: `Cert KB ${tag}`,
      status: "active",
    },
    select: { id: true },
  });

  const source = await prisma.voiceKnowledgeSource.create({
    data: {
      workspaceId,
      knowledgeBaseId: kb.id,
      sourceType: "text",
      name: "cert-snippet.txt",
      status: "ready",
      contentText:
        "Transovo Voice V3 ingestion certification snippet. Business hours: Mon–Fri 9am–5pm ET. Service area: certification only.",
    },
    select: { id: true },
  });

  const started = Date.now();
  let vectorStoreId: string | null = null;
  let fileId: string | null = null;
  let indexed = false;
  let uploadError: string | null = null;

  try {
    vectorStoreId = await ensureOpenAiVectorStoreForKnowledgeBase({
      workspaceId,
      knowledgeBaseId: kb.id,
      displayName: kb.id,
    });

    const sync = await syncTextSourceToOpenAiVectorStore({
      workspaceId,
      knowledgeBaseId: kb.id,
      sourceId: source.id,
      fileName: "cert-snippet.txt",
      text:
        "Transovo Voice V3 ingestion certification snippet. Business hours: Mon–Fri 9am–5pm ET. Service area: certification only.",
    });
    if (!sync) {
      uploadError = "syncTextSourceToOpenAiVectorStore returned null";
    } else {
      fileId = sync.fileId;
      indexed = sync.indexed;
      vectorStoreId = sync.vectorStoreId;
    }
  } catch (err) {
    uploadError = err instanceof Error ? err.message : String(err);
  }

  const elapsedMs = Date.now() - started;

  const kbRow = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: kb.id },
    select: { openaiVectorStoreId: true, openaiVectorStoreStatus: true },
  });
  const srcRow = await prisma.voiceKnowledgeSource.findFirst({
    where: { id: source.id },
    select: { openaiFileId: true },
  });

  const agent = await prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: `Cert agent ${tag}`,
      status: "DRAFT",
      draftConfig: {},
    },
    select: { id: true },
  });

  await prisma.voiceAgentKnowledgeBase.create({
    data: {
      workspaceId,
      agentId: agent.id,
      knowledgeBaseId: kb.id,
    },
  });

  const wizard = {
    agentName: "Cert",
    businessName: "Cert Business",
    bookingStrategy: "MICROSOFT_365",
    linkedKnowledgeBaseId: kb.id,
    knowledgeBaseEnabled: true,
    knowledgeSource: "manual",
    knowledgeItems: [],
    appointmentTypes: [],
    collectFields: [],
  } as import("../src/lib/solutions/appointment-receptionist/types").AppointmentReceptionistWizardState;

  const retrieval = await resolveAgentKnowledgeRetrieval({
    workspaceId,
    agentId: agent.id,
    wizard,
  });

  const compiled = compileVoiceV3AgentConfig({
    wizard,
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
    knowledgeRetrieval: retrieval,
  });

  const report = {
    uploadSucceeded: Boolean(fileId) && !uploadError,
    vectorStoreCreated: Boolean(kbRow?.openaiVectorStoreId),
    indexingCompleted: indexed,
    elapsedMs,
    openaiVectorStoreId: kbRow?.openaiVectorStoreId
      ? redactId(kbRow.openaiVectorStoreId)
      : null,
    openaiFileId: srcRow?.openaiFileId ? redactId(srcRow.openaiFileId) : null,
    openaiVectorStoreStatus: kbRow?.openaiVectorStoreStatus ?? null,
    openaiError: uploadError,
    resolverVectorStoreIds: (retrieval.openaiVectorStoreIds ?? []).map(redactId),
    compiledVectorStoreIds: (compiled.knowledge.retrieval.openaiVectorStoreIds ?? []).map(
      redactId,
    ),
    idsMatch:
      Boolean(kbRow?.openaiVectorStoreId) &&
      compiled.knowledge.retrieval.openaiVectorStoreIds?.includes(
        kbRow.openaiVectorStoreId!,
      ),
  };

  console.log("CERT_VOICE_V3_OPENAI_INGESTION_SMOKE", JSON.stringify(report, null, 2));

  try {
    await prisma.voiceAgentKnowledgeBase.deleteMany({ where: { agentId: agent.id } });
    await prisma.voiceAgent.delete({ where: { id: agent.id } });
    await prisma.voiceKnowledgeSource.delete({ where: { id: source.id } });
    await prisma.voiceKnowledgeBase.delete({ where: { id: kb.id } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
  } catch (cleanupErr) {
    console.warn("CERT_OPENAI_INGESTION_CLEANUP_WARN", {
      workspaceId: redactId(workspaceId),
      message: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
    });
  }

  if (!report.uploadSucceeded || !report.idsMatch) {
    process.exit(1);
  }
  console.log("cert-voice-v3-openai-ingestion-smoke: PASS");
}

main().catch((err) => {
  console.error("cert-voice-v3-openai-ingestion-smoke: FAIL", err);
  process.exit(1);
});
