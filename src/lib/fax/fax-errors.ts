const FAX_ERROR_MAP: Record<string, string> = {
  file_size_limit_exceeded: "This file is larger than the maximum allowed size (50 MB).",
  page_limit_exceeded: "This document has more pages than allowed (350 pages).",
  invalid_media: "This file format is not supported. Please upload a PDF.",
  invalid_destination: "The destination fax number is not valid.",
  destination_unreachable: "The destination fax number could not be reached.",
  busy: "The destination fax line was busy. Try again later.",
  no_answer: "The destination did not answer.",
  fax_disabled: "Fax is not enabled on your account. Please check billing.",
  insufficient_pages: "You have used all included fax pages for this billing period.",
};

export function mapFaxError(codeOrMessage: string | null | undefined): string {
  const raw = String(codeOrMessage || "").trim();
  if (!raw) return "Something went wrong sending your fax. Please try again.";
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  for (const [pattern, message] of Object.entries(FAX_ERROR_MAP)) {
    if (key.includes(pattern)) return message;
  }
  if (raw.length < 120 && !raw.includes("telnyx")) return raw;
  return "Something went wrong sending your fax. Please try again.";
}
