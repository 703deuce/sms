import { createId } from "@/lib/supabase/id";
import type { BusinessExtractionCandidate, ReviewCandidate } from "./types";
import { isSemanticDuplicateFaq, isSemanticDuplicateService, normalizeServiceName } from "./normalize-facts";
import type { WizardFactSnapshot } from "./wizard-snapshot";
import { isWizardEffectivelyEmpty } from "./wizard-snapshot";

function pushCandidate(
  list: ReviewCandidate[],
  input: Omit<ReviewCandidate, "id" | "selectedByDefault"> & { selectedByDefault?: boolean },
  emptyWizard: boolean,
) {
  list.push({
    id: createId(),
    selectedByDefault: input.selectedByDefault ?? (emptyWizard && input.classification === "NEW"),
    ...input,
  });
}

export function diffCandidatesAgainstWizard(
  candidate: BusinessExtractionCandidate,
  snap: WizardFactSnapshot,
): ReviewCandidate[] {
  const emptyWizard = isWizardEffectivelyEmpty(snap);
  const out: ReviewCandidate[] = [];

  const biz = candidate.business;
  if (biz?.name) {
    const current = snap.businessName || null;
    const proposed = biz.name.trim();
    let classification: ReviewCandidate["classification"] = "NEW";
    if (current) {
      if (current.toLowerCase() === proposed.toLowerCase()) classification = "EXACT_DUPLICATE";
      else classification = "CHANGED";
    }
    if (classification !== "EXACT_DUPLICATE") {
      pushCandidate(out, {
        fieldPath: "businessName",
        category: "Business details",
        label: "Business name",
        currentValue: current,
        proposedValue: proposed,
        classification,
        provenance: biz.name
          ? { sourceType: "WEBSITE", confidence: "high", evidence: proposed }
          : { sourceType: "WEBSITE", confidence: "medium" },
      }, emptyWizard);
    }
  }

  if (biz?.website) {
    const current = snap.websiteUrl || null;
    const proposed = biz.website.trim();
    if (!current) {
      pushCandidate(out, {
        fieldPath: "websiteUrl",
        category: "Business details",
        label: "Website",
        currentValue: current,
        proposedValue: proposed,
        classification: "NEW",
        provenance: { sourceType: "WEBSITE", confidence: "high" },
      }, emptyWizard);
    } else if (current.replace(/\/$/, "") !== proposed.replace(/\/$/, "")) {
      pushCandidate(out, {
        fieldPath: "websiteUrl",
        category: "Business details",
        label: "Website",
        currentValue: current,
        proposedValue: proposed,
        classification: "CONFLICT",
        provenance: { sourceType: "WEBSITE", confidence: "high" },
        selectedByDefault: false,
      }, emptyWizard);
    }
  }

  const businessSummaryParts = [
    biz?.description,
    biz?.address,
    biz?.phone ? `Phone: ${biz.phone}` : undefined,
  ].filter(Boolean);
  if (businessSummaryParts.length) {
    const proposed = businessSummaryParts.join(" · ");
    const current = snap.knowledgeById.business || null;
    let classification: ReviewCandidate["classification"] = "NEW";
    if (current) {
      if (current === proposed) classification = "EXACT_DUPLICATE";
      else classification = "CHANGED";
    }
    if (classification !== "EXACT_DUPLICATE") {
      pushCandidate(out, {
        fieldPath: "knowledgeItems.business",
        category: "Business details",
        label: "Business details",
        currentValue: current,
        proposedValue: proposed,
        classification,
        provenance: { sourceType: "WEBSITE", confidence: "high" },
        selectedByDefault: classification === "NEW" && emptyWizard,
      }, emptyWizard);
    }
  }

  if (candidate.hoursProse) {
    const current = snap.knowledgeById.hours || null;
    const proposed = candidate.hoursProse.trim();
    let classification: ReviewCandidate["classification"] = "NEW";
    if (current) {
      if (current === proposed) classification = "EXACT_DUPLICATE";
      else classification = "CHANGED";
    }
    if (classification !== "EXACT_DUPLICATE") {
      pushCandidate(out, {
        fieldPath: "knowledgeItems.hours",
        category: "Hours",
        label: "Business hours",
        currentValue: current,
        proposedValue: proposed,
        classification,
        provenance: { sourceType: "WEBSITE", confidence: "medium" },
        selectedByDefault: false,
      }, emptyWizard);
    }
  }

  const existingServices = [
    ...snap.serviceNames,
    ...(snap.knowledgeById.services || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
  ];

  for (const svc of candidate.services || []) {
    const name = svc.name.trim();
    if (!name) continue;
    const exact = existingServices.some((e) => normalizeServiceName(e) === normalizeServiceName(name));
    if (exact) continue;
    const semantic = existingServices.find((e) => isSemanticDuplicateService(e, name));
    pushCandidate(out, {
      fieldPath: "appointmentTypes",
      category: "Services",
      label: semantic ? `Possible duplicate: ${name}` : `New service: ${name}`,
      currentValue: semantic || null,
      proposedValue: name,
      classification: semantic ? "SEMANTIC_DUPLICATE" : "NEW",
      provenance: svc.provenance,
      semanticMatchId: semantic ? normalizeServiceName(semantic) : undefined,
      selectedByDefault: !semantic && emptyWizard,
    }, emptyWizard);
  }

  if (candidate.serviceAreas?.length) {
    const currentAreas = (snap.knowledgeById.service_area || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    for (const area of candidate.serviceAreas) {
      const name = area.name.trim();
      if (!name) continue;
      if (currentAreas.some((a) => a.toLowerCase() === name.toLowerCase())) continue;
      pushCandidate(out, {
        fieldPath: "knowledgeItems.service_area",
        category: "Service areas",
        label: `Service area: ${name}`,
        currentValue: null,
        proposedValue: name,
        classification: "NEW",
        provenance: area.provenance,
      }, emptyWizard);
    }
  }

  const existingFaqQs = snap.faqLines
    .map((line) => line.replace(/^Q:\s*/i, "").split("?")[0])
    .filter(Boolean);

  for (const faq of candidate.faqs || []) {
    const line = `Q: ${faq.question.trim()}\nA: ${faq.answer.trim()}`;
    const dup = existingFaqQs.some((q) => isSemanticDuplicateFaq(q, faq.question));
    if (dup) continue;
    pushCandidate(out, {
      fieldPath: "knowledgeItems.faqs",
      category: "Frequently asked questions",
      label: faq.question.trim(),
      currentValue: null,
      proposedValue: line,
      classification: "NEW",
      provenance: faq.provenance,
    }, emptyWizard);
  }

  return out.filter((c) => c.classification !== "EXACT_DUPLICATE");
}

export function summarizeReview(candidates: ReviewCandidate[]): {
  newCount: number;
  changedCount: number;
  semanticCount: number;
  conflictCount: number;
  upToDate: boolean;
} {
  const newCount = candidates.filter((c) => c.classification === "NEW").length;
  const changedCount = candidates.filter((c) => c.classification === "CHANGED").length;
  const semanticCount = candidates.filter((c) => c.classification === "SEMANTIC_DUPLICATE").length;
  const conflictCount = candidates.filter((c) => c.classification === "CONFLICT").length;
  return {
    newCount,
    changedCount,
    semanticCount,
    conflictCount,
    upToDate: candidates.length === 0,
  };
}
