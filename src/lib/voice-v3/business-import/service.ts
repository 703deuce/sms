import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  getGoogleMapsPlaceDetails,
  isScrapingDogConfigured,
  searchGoogleMapsBusinesses,
} from "@/lib/scrapingdog/client";
import type { GoogleMapsSearchResult } from "@/lib/voice-v3/business-import/google-types";
import { normalizeWebsiteInput } from "./url-normalize";
import type { BusinessImportTrigger } from "./types";

export async function searchBusinessesForWorkspace(query: string) {
  if (!isScrapingDogConfigured()) {
    throw new Error("Business search is not configured");
  }
  return searchGoogleMapsBusinesses(query);
}

export async function upsertBusinessKnowledgeSource(
  workspaceId: string,
  voiceAgentId: string,
  patch: {
    websiteRootUrl?: string | null;
    googleSelection?: GoogleMapsSearchResult | null;
  },
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: voiceAgentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  let googleFields: Record<string, string | null> = {};
  if (patch.googleSelection) {
    const sel = patch.googleSelection;
    let details: Record<string, unknown> | null = null;
    if (sel.place_id || sel.data_id || sel.ludocid) {
      details = await getGoogleMapsPlaceDetails({
        placeId: sel.place_id,
        dataId: sel.data_id,
        ludocid: sel.ludocid,
      });
    }
    googleFields = {
      googlePlaceId: sel.place_id || null,
      googleDataId: sel.data_id || null,
      googleLudocid: sel.ludocid || null,
      googleDisplayName: sel.title || null,
      googleAddress: sel.address || null,
      googleWebsite: sel.website || (typeof details?.website === "string" ? details.website : null),
    };
  }

  const websiteRootUrl = patch.websiteRootUrl
    ? normalizeWebsiteInput(patch.websiteRootUrl)
    : undefined;

  return prisma.voiceV3BusinessKnowledgeSource.upsert({
    where: { voiceAgentId },
    create: {
      id: createId(),
      workspaceId,
      voiceAgentId,
      websiteRootUrl: websiteRootUrl || null,
      ...googleFields,
    },
    update: {
      ...(websiteRootUrl !== undefined ? { websiteRootUrl } : {}),
      ...(patch.googleSelection ? googleFields : {}),
    },
  });
}

export async function startBusinessImport(opts: {
  workspaceId: string;
  voiceAgentId: string;
  trigger: BusinessImportTrigger;
  sourceTypes?: string[];
}) {
  const prisma = getPrisma();
  const source = await prisma.voiceV3BusinessKnowledgeSource.findUnique({
    where: { voiceAgentId: opts.voiceAgentId },
  });
  if (!source) {
    throw new Error("Configure website or Google business before importing");
  }

  const running = await prisma.voiceV3BusinessKnowledgeImport.findFirst({
    where: {
      voiceAgentId: opts.voiceAgentId,
      status: { in: ["QUEUED", "DISCOVERING", "FETCHING", "EXTRACTING", "COMPARING"] },
    },
  });
  if (running) {
    return running;
  }

  const importRow = await prisma.voiceV3BusinessKnowledgeImport.create({
    data: {
      id: createId(),
      workspaceId: opts.workspaceId,
      voiceAgentId: opts.voiceAgentId,
      sourceRecordId: source.id,
      status: "QUEUED",
      trigger: opts.trigger,
      sourceTypes: opts.sourceTypes || ["website", "google"],
    },
  });

  await enqueueJob({
    workspaceId: opts.workspaceId,
    jobType: "voice_v3_business_import",
    payload: { importId: importRow.id },
    runAt: new Date(),
  });

  return importRow;
}

export async function getImportForWorkspace(workspaceId: string, importId: string) {
  const prisma = getPrisma();
  return prisma.voiceV3BusinessKnowledgeImport.findFirst({
    where: { id: importId, workspaceId },
    include: { sourceRecord: true },
  });
}
