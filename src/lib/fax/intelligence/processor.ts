import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { downloadFaxDocument } from "../fax-storage";
import { logFaxActivity } from "../fax-service";
import { runFaxAutomations } from "./automation-engine";

const PDF_TEXT_MARKER = /\/Type\s*\/Page[^s]/;

async function extractTextFromPdf(bytes: Buffer): Promise<{ text: string; method: string }> {
  const raw = bytes.toString("latin1");
  const textChunks: string[] = [];
  const btMatches = raw.match(/\(([^()\\]{3,})\)/g) || [];
  for (const m of btMatches.slice(0, 5000)) {
    const inner = m.slice(1, -1).replace(/\\n/g, "\n").trim();
    if (inner.length > 2 && /[a-zA-Z]/.test(inner)) textChunks.push(inner);
  }
  const joined = textChunks.join("\n").trim();
  if (joined.length > 80) {
    return { text: joined.slice(0, 100_000), method: "pdf_text" };
  }
  if (PDF_TEXT_MARKER.test(raw)) {
    return { text: joined || "(scanned document — limited text extracted)", method: "pdf_partial" };
  }
  return { text: joined, method: "empty" };
}

export async function processFaxIntelligence(transmissionId: string) {
  const prisma = getPrisma();
  const transmission = await prisma.faxTransmission.findUnique({
    where: { id: transmissionId },
    include: { intelligence: true },
  });
  if (!transmission) return { ok: false, error: "not_found" };
  if (transmission.intelligence?.status === "completed") {
    return { ok: true, skipped: true };
  }
  if (transmission.isSpam) {
    return { ok: true, skipped: true, reason: "spam" };
  }
  const fromBlocked = transmission.fromE164
    ? await import("../fax-blocked-senders").then((m) =>
        m.isSenderBlocked(transmission.workspaceId, transmission.fromE164!),
      )
    : false;
  if (fromBlocked) {
    return { ok: true, skipped: true, reason: "blocked_sender" };
  }

  const account = await prisma.faxAccount.findUnique({
    where: { workspaceId: transmission.workspaceId },
  });
  if (!account?.autoAnalyzeInbound && transmission.direction === "inbound") {
    return { ok: true, skipped: true, reason: "auto_analyze_disabled" };
  }

  await prisma.faxIntelligence.upsert({
    where: { faxTransmissionId: transmissionId },
    create: {
      id: createId(),
      workspaceId: transmission.workspaceId,
      faxTransmissionId: transmissionId,
      status: "processing",
    },
    update: { status: "processing", errorMessage: null },
  });

  try {
    if (!transmission.documentStorageBucket || !transmission.documentStoragePath) {
      throw new Error("no_document");
    }

    const bytes = await downloadFaxDocument(
      transmission.documentStorageBucket,
      transmission.documentStoragePath,
    );
    const { text, method } = await extractTextFromPdf(bytes);

    let aiSummary: string | null = null;
    let documentType: string | null = null;
    let structuredData: Record<string, unknown> | null = null;
    let priority: string | null = "normal";
    let priorityReason: string | null = null;

    if (text.length > 40) {
      const summary = await openAiChatCompletion(
        "Summarize this fax document in 2-3 sentences for a business owner. Only use information present in the document. Do not invent details.",
        text.slice(0, 12_000),
        { temperature: 0.2, maxTokens: 200 },
      );
      aiSummary = summary?.trim() || null;

      const classification = await openAiChatCompletion(
        `Classify this fax into ONE category: Invoice, Purchase Order, Referral, Prescription, Lab Result, Medical Record, Insurance Document, Legal Document, Correspondence, Other, Unknown. Reply with only the category name.`,
        text.slice(0, 8000),
        { temperature: 0, maxTokens: 30 },
      );
      documentType = classification?.trim() || "Unknown";

      const extraction = await openAiChatCompletion(
        `Extract structured business fields from this fax as JSON with keys: personNames (array), businessNames (array), phoneNumbers (array), emails (array), dates (array), dollarAmounts (array), invoiceNumbers (array), referenceNumbers (array), requestedActions (array). Only include values clearly present. Return valid JSON only.`,
        text.slice(0, 10_000),
        { temperature: 0, maxTokens: 600 },
      );
      if (extraction) {
        try {
          structuredData = JSON.parse(extraction) as Record<string, unknown>;
        } catch {
          structuredData = { raw: extraction.slice(0, 2000) };
        }
      }

      const urgency = await openAiChatCompletion(
        `Based only on this fax text, reply with JSON: {"priority":"normal|important|urgent","reason":"short reason or null"}. Use urgent only if a deadline within 48 hours or emergency language is explicit.`,
        text.slice(0, 6000),
        { temperature: 0, maxTokens: 80 },
      );
      if (urgency) {
        try {
          const parsed = JSON.parse(urgency) as { priority?: string; reason?: string };
          priority = parsed.priority || "normal";
          priorityReason = parsed.reason || null;
        } catch {
          /* ignore */
        }
      }
    }

    const searchText = [text, aiSummary, documentType, JSON.stringify(structuredData || {})]
      .filter(Boolean)
      .join("\n")
      .slice(0, 200_000);

    await prisma.faxIntelligence.update({
      where: { faxTransmissionId: transmissionId },
      data: {
        status: text.length > 10 ? "completed" : "partially_completed",
        extractedText: text.slice(0, 200_000),
        extractionMethod: method,
        aiSummary,
        documentType,
        structuredDataJson: structuredData as object,
        priority,
        priorityReason,
        searchText,
        processedAt: new Date(),
        modelVersion: "openai",
      },
    });

    if (priority && priority !== "normal") {
      await prisma.faxTransmission.update({
        where: { id: transmissionId },
        data: { priority },
      });
    }

    await logFaxActivity({
      workspaceId: transmission.workspaceId,
      faxTransmissionId: transmissionId,
      eventType: "intelligence_completed",
      message: `Document classified as ${documentType || "Unknown"}`,
    });

    await runFaxAutomations(transmission.workspaceId, transmissionId);

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "intelligence_failed";
    await prisma.faxIntelligence.update({
      where: { faxTransmissionId: transmissionId },
      data: { status: "failed", errorMessage: message, processedAt: new Date() },
    });
    return { ok: false, error: message };
  }
}
