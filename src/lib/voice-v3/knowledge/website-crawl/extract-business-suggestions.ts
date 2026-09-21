import type { ExtractedPage } from "./extract-html";

export type WebsiteBusinessSuggestions = {
  businessName?: string;
  phone?: string;
  website?: string;
  description?: string;
  services?: string[];
  serviceArea?: string;
  hoursText?: string;
};

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

export function extractBusinessSuggestionsFromPages(
  pages: Array<ExtractedPage & { url: string }>,
): WebsiteBusinessSuggestions {
  const combined = pages.map((p) => p.text).join("\n").slice(0, 80_000);
  const home = pages[0];
  const suggestions: WebsiteBusinessSuggestions = {
    website: home?.url,
    businessName: home?.pageTitle?.split("|")[0]?.trim(),
    description: home?.text.slice(0, 400).trim(),
  };

  const phones = [...combined.matchAll(PHONE_RE)].map((m) => m[0]).filter(Boolean);
  if (phones[0]) suggestions.phone = phones[0];

  const services: string[] = [];
  for (const page of pages) {
    const path = new URL(page.url).pathname.toLowerCase();
    if (path.includes("/service") && page.pageTitle) {
      const title = page.pageTitle.split("|")[0].trim();
      if (title.length > 3 && title.length < 80) services.push(title);
    }
  }
  if (services.length) suggestions.services = [...new Set(services)].slice(0, 12);

  const hoursMatch = combined.match(
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\S]{0,120}(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|closed)/i,
  );
  if (hoursMatch) suggestions.hoursText = hoursMatch[0].slice(0, 200).trim();

  const areaMatch = combined.match(
    /(?:service area|areas we serve|serving)[:\s]+([A-Za-z0-9 ,.-]{4,80})/i,
  );
  if (areaMatch?.[1]) suggestions.serviceArea = areaMatch[1].trim();

  return suggestions;
}
