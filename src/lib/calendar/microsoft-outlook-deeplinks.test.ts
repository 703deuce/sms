import { describe, expect, it } from "vitest";
import {
  OUTLOOK_EVENT_COMPOSE_URL,
  buildOutlookEventComposeUrl,
} from "./microsoft-outlook-deeplinks";

describe("microsoft-outlook-deeplinks", () => {
  it("uses documented compose base URL", () => {
    expect(OUTLOOK_EVENT_COMPOSE_URL).toBe(
      "https://outlook.office.com/calendar/deeplink/compose",
    );
  });

  it("appends optional compose query params", () => {
    const url = buildOutlookEventComposeUrl({
      subject: "Service Visit",
      start: "2026-10-09T12:00:00",
    });
    expect(url).toContain("outlook.office.com/calendar/deeplink/compose");
    expect(url).toContain("subject=Service");
  });
});
