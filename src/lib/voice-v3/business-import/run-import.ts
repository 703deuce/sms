import { getPrisma } from "@/lib/db";
import { crawlBusinessWebsite } from "./crawl";
import { extractBusinessCandidatesLLM } from "./extract-llm";
import { diffCandidatesAgainstWizard, summarizeReview } from "./diff";
import { snapshotWizardFacts } from "./wizard-snapshot";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { getGoogleMapsPlaceDetails } from "@/lib/scrapingdog/client";
import { candidateFromGooglePlace } from "./google-from-maps";
import type { BusinessExtractionCandidate, BusinessImportTelemetry } from "./types";
import { emitBusinessImportEvent } from "./events";
import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";

export async function runBusinessKnowledgeImport(importId: string): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceV3BusinessKnowledgeImport.findUnique({
    where: { id: importId },
    include: { sourceRecord: true },
  });
  if (!row) throw new Error("Import not found");

  const started = Date.now();
  const telemetry: BusinessImportTelemetry = {
    directPagesFetched: 0,
    scrapingDogStatic: 0,
    scrapingDogDynamic: 0,
    googleMapsRequests: 0,
    llmCalls: 0,
    pagesProcessed: 0,
    acquisitionByUrl: {},
  };

  emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_STARTED", row.workspaceId, {
    importId,
    agentId: row.voiceAgentId,
  });

  await prisma.voiceV3BusinessKnowledgeImport.update({
    where: { id: importId },
    data: { status: "DISCOVERING" },
  });

  const loaded = await loadAppointmentReceptionistSetup(row.workspaceId, {
    agentId: row.voiceAgentId,
  });
  const wizardState = {
    ...createDefaultWizardState(),
    ...(loaded.state || {}),
  } as AppointmentReceptionistWizardState;
  const wizardSnap = snapshotWizardFacts(wizardState);

  let merged: BusinessExtractionCandidate = {};
  const pages: import("./types").ImportPageSnapshot[] = [];
  let googleSnapshot: Record<string, unknown> | null = null;

  const source = row.sourceRecord;
  const types = row.sourceTypes.length ? row.sourceTypes : ["website", "google"];

  try {
    if (types.includes("google") && source) {
      await prisma.voiceV3BusinessKnowledgeImport.update({
        where: { id: importId },
        data: { status: "FETCHING" },
      });
      if (source.googlePlaceId || source.googleDataId || source.googleLudocid) {
        telemetry.googleMapsRequests++;
        googleSnapshot = await getGoogleMapsPlaceDetails({
          placeId: source.googlePlaceId || undefined,
          dataId: source.googleDataId || undefined,
          ludocid: source.googleLudocid || undefined,
        });
        const googleCand = candidateFromGooglePlace(
          {
            title: source.googleDisplayName || undefined,
            address: source.googleAddress || undefined,
            website: source.googleWebsite || undefined,
          },
          googleSnapshot,
        );
        merged = { ...merged, ...googleCand, business: { ...(merged.business || {}), ...(googleCand.business || {}) } };
        emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_SOURCE_FETCHED", row.workspaceId, {
          importId,
          sourceType: "GOOGLE_MAPS",
        });
      }
    }

    const website = source?.websiteRootUrl || source?.websiteFinalUrl;
    if (types.includes("website") && website) {
      await prisma.voiceV3BusinessKnowledgeImport.update({
        where: { id: importId },
        data: { status: "FETCHING" },
      });
      const crawl = await crawlBusinessWebsite(website);
      pages.push(...crawl.pages);
      Object.assign(telemetry, crawl.telemetry);
      merged = {
        ...crawl.jsonLdMerge,
        ...merged,
        business: { ...(crawl.jsonLdMerge.business || {}), ...(merged.business || {}) },
      };
      emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_SOURCE_FETCHED", row.workspaceId, {
        importId,
        sourceType: "WEBSITE",
        pageCount: crawl.pages.length,
      });
    }

    await prisma.voiceV3BusinessKnowledgeImport.update({
      where: { id: importId },
      data: { status: "EXTRACTING", pagesJson: pages },
    });

    const googleText = googleSnapshot ? JSON.stringify(googleSnapshot).slice(0, 8000) : "";
    const { candidate, llmCalls } = await extractBusinessCandidatesLLM(pages, googleText, merged);
    telemetry.llmCalls += llmCalls;
    merged = candidate;

    emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_EXTRACTION_COMPLETED", row.workspaceId, {
      importId,
      llmCalls,
    });

    await prisma.voiceV3BusinessKnowledgeImport.update({
      where: { id: importId },
      data: { status: "COMPARING", candidatesJson: merged, googleSnapshot },
    });

    const review = diffCandidatesAgainstWizard(merged, wizardSnap);
    const summary = summarizeReview(review);

    emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_DIFF_COMPLETED", row.workspaceId, {
      importId,
      ...summary,
    });

    telemetry.durationMs = Date.now() - started;

    await prisma.voiceV3BusinessKnowledgeImport.update({
      where: { id: importId },
      data: {
        status: "REVIEW_READY",
        reviewJson: { candidates: review, summary },
        telemetryJson: telemetry,
        completedAt: new Date(),
      },
    });

    emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_REVIEW_READY", row.workspaceId, {
      importId,
      ...summary,
    });

    if (source) {
      await prisma.voiceV3BusinessKnowledgeSource.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date() },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    telemetry.durationMs = Date.now() - started;
    await prisma.voiceV3BusinessKnowledgeImport.update({
      where: { id: importId },
      data: {
        status: pages.length || googleSnapshot ? "PARTIAL" : "FAILED",
        errorMessage: message,
        telemetryJson: telemetry,
        pagesJson: pages.length ? pages : undefined,
        googleSnapshot,
        completedAt: new Date(),
      },
    });
    emitBusinessImportEvent("VOICE_V3_BUSINESS_IMPORT_FAILED", row.workspaceId, {
      importId,
      message,
    });
    throw err;
  }
}
