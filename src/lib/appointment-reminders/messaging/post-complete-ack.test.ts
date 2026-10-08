import { describe, expect, it } from "vitest";
import { buildArPostCompleteInboundAck } from "./post-complete-ack";

describe("buildArPostCompleteInboundAck", () => {
  it("thanks get a welcome reply", () => {
    expect(buildArPostCompleteInboundAck("Thanks!")).toMatch(/welcome/i);
  });

  it("questions get a short help pointer", () => {
    expect(buildArPostCompleteInboundAck("What time again?")).toMatch(/all set/i);
  });
});
