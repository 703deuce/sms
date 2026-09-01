const FAX_ERROR_MAP: Record<string, string> = {
  file_size_limit_exceeded: "The document could not be processed — file is too large (max 50 MB).",
  page_limit_exceeded: "The document could not be processed — too many pages (max 350).",
  invalid_media: "The document could not be processed. Please upload a PDF.",
  invalid_destination: "The destination number appears invalid.",
  invalid_number: "The destination number appears invalid.",
  destination_unreachable: "The destination fax number could not be reached.",
  busy: "Recipient line was busy. Try again later.",
  no_answer: "No fax machine answered.",
  no_fax_machine: "No fax machine answered.",
  timeout: "The transmission timed out.",
  timed_out: "The transmission timed out.",
  fax_disabled: "Fax is not enabled on your account. Please check billing.",
  insufficient_pages: "You have used all included fax pages for this billing period.",
  call_rejected: "The destination rejected the call.",
  communication_error: "A communication error occurred during transmission.",
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
