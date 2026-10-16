import { describe, expect, it } from "vitest";
import { isTelnyxResourceNotFound, TelnyxApiError } from "./client";

describe("isTelnyxResourceNotFound", () => {
  it("detects Telnyx error code 10005", () => {
    const err = new TelnyxApiError(
      JSON.stringify([{ code: "10005", title: "Resource not found" }]),
      404,
      { errors: [{ code: "10005", title: "Resource not found" }] },
    );
    expect(isTelnyxResourceNotFound(err)).toBe(true);
  });
});
