import type { BusinessExtractionCandidate, FactProvenance } from "./types";

function prov(url: string): FactProvenance {
  return { sourceType: "JSON_LD", sourceUrl: url, confidence: "high" };
}

export function extractJsonLdCandidates(html: string, pageUrl: string): Partial<BusinessExtractionCandidate> {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // skip invalid JSON-LD
    }
  }

  const out: Partial<BusinessExtractionCandidate> = {};
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const type = String(b["@type"] || "");
    if (!/LocalBusiness|Organization|ProfessionalService|FAQPage|Service/i.test(type)) continue;

    if (/LocalBusiness|Organization|ProfessionalService/i.test(type)) {
      const name = typeof b.name === "string" ? b.name : undefined;
      const phone = typeof b.telephone === "string" ? b.telephone : undefined;
      const desc = typeof b.description === "string" ? b.description : undefined;
      const url = typeof b.url === "string" ? b.url : undefined;
      let address = "";
      if (b.address && typeof b.address === "object") {
        const a = b.address as Record<string, unknown>;
        address = [
          a.streetAddress,
          a.addressLocality,
          a.addressRegion,
          a.postalCode,
        ]
          .filter((x) => typeof x === "string")
          .join(", ");
      }
      out.business = {
        ...(out.business || {}),
        name: out.business?.name || name,
        phone: out.business?.phone || phone,
        description: out.business?.description || desc,
        website: out.business?.website || url,
        address: out.business?.address || address || undefined,
      };
    }

    if (/FAQPage/i.test(type) && Array.isArray(b.mainEntity)) {
      const faqs = (b.mainEntity as unknown[])
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const q = item as Record<string, unknown>;
          const question = typeof q.name === "string" ? q.name : undefined;
          let answer = "";
          if (q.acceptedAnswer && typeof q.acceptedAnswer === "object") {
            const a = q.acceptedAnswer as Record<string, unknown>;
            answer = typeof a.text === "string" ? a.text : "";
          }
          if (!question || !answer) return null;
          return { question, answer, provenance: prov(pageUrl) };
        })
        .filter(Boolean) as NonNullable<BusinessExtractionCandidate["faqs"]>;
      out.faqs = [...(out.faqs || []), ...faqs];
    }
  }
  return out;
}
