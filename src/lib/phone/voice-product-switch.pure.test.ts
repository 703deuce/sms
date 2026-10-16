import { describe, expect, it } from "vitest";
import { VOICE_INGRESS_PRODUCT_LABEL } from "./voice-product-switch-types";

describe("voice product switch labels", () => {
  it("exposes human labels for confirmation copy", () => {
    expect(VOICE_INGRESS_PRODUCT_LABEL.mctb).toBe("Missed Call Text Back");
    expect(VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist).toBe("AI Receptionist");
  });
});
