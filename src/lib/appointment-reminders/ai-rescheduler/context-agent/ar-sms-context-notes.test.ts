import { describe, expect, it } from "vitest";
import {
  AR_SMS_CONTEXT_NOTES_HEADER,
  fallbackArSmsContextNotes,
  normalizeArSmsContextNotes,
} from "./ar-sms-context-notes";

describe("arSmsContextNotes", () => {
  it("adds header when missing", () => {
    const notes = normalizeArSmsContextNotes("Customer prefers Tuesday afternoon.");
    expect(notes.startsWith(AR_SMS_CONTEXT_NOTES_HEADER)).toBe(true);
    expect(notes).toContain("Tuesday afternoon");
  });

  it("preserves existing header", () => {
    const raw = `${AR_SMS_CONTEXT_NOTES_HEADER}\n\nNo confirmation yet.`;
    expect(normalizeArSmsContextNotes(raw)).toBe(raw);
  });

  it("fallback explains advisory failure", () => {
    const fb = fallbackArSmsContextNotes("api_error");
    expect(fb).toContain(AR_SMS_CONTEXT_NOTES_HEADER);
    expect(fb).toContain("api_error");
  });
});
