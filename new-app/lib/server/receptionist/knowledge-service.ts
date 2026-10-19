import { getPrisma } from "@/lib/server/db";

export async function listKnowledgeGaps(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.voiceKnowledgeGap.findMany({
    where: { workspaceId },
    orderBy: { lastAskedAt: "desc" },
    take: 200,
  });
}

export async function listFaqsForWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const bases = await prisma.voiceKnowledgeBase.findMany({
    where: { workspaceId, status: "active" },
    include: {
      sources: {
        where: { sourceType: "faq" },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  return bases.flatMap((kb) =>
    kb.sources.map((s) => ({
      id: s.id,
      knowledgeBaseId: kb.id,
      question: (s.fileMeta as { question?: string })?.question || s.name || "",
      answer: s.contentText || "",
      status: s.status,
      updatedAt: s.updatedAt.toISOString(),
    })),
  );
}

export async function listKnowledgeSources(workspaceId: string) {
  const prisma = getPrisma();
  const bases = await prisma.voiceKnowledgeBase.findMany({
    where: { workspaceId },
    include: { sources: { orderBy: { updatedAt: "desc" } } },
  });
  return bases.flatMap((kb) =>
    kb.sources.map((s) => ({
      id: s.id,
      name: s.name || s.crawlUrl || "Source",
      type: s.sourceType,
      status: s.status,
      knowledgeBaseId: kb.id,
      updatedAt: s.updatedAt.toISOString(),
    })),
  );
}

export async function upsertFaq(
  workspaceId: string,
  input: { id?: string; question: string; answer: string },
) {
  const prisma = getPrisma();
  let kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { workspaceId, status: "active" },
  });
  if (!kb) {
    kb = await prisma.voiceKnowledgeBase.create({
      data: { workspaceId, name: "Receptionist knowledge", status: "active" },
    });
  }

  if (input.id) {
    return prisma.voiceKnowledgeSource.update({
      where: { id: input.id },
      data: {
        name: input.question,
        contentText: input.answer,
        fileMeta: { question: input.question },
        status: "ready",
      },
    });
  }

  return prisma.voiceKnowledgeSource.create({
    data: {
      workspaceId,
      knowledgeBaseId: kb.id,
      sourceType: "faq",
      name: input.question,
      contentText: input.answer,
      fileMeta: { question: input.question },
      status: "ready",
    },
  });
}

export async function deleteFaq(workspaceId: string, id: string) {
  const prisma = getPrisma();
  await prisma.voiceKnowledgeSource.deleteMany({ where: { id, workspaceId } });
}

export async function resolveKnowledgeGap(workspaceId: string, gapId: string, answer: string) {
  const prisma = getPrisma();
  const gap = await prisma.voiceKnowledgeGap.findFirst({ where: { id: gapId, workspaceId } });
  if (!gap) throw new Error("Gap not found");
  await upsertFaq(workspaceId, { question: gap.displayQuestion, answer });
  await prisma.voiceKnowledgeGap.update({
    where: { id: gapId },
    data: { status: "RESOLVED" },
  });
}
