import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanSecret, secretFingerprint } from "@/lib/env/secrets";

describe("cleanSecret", () => {
  it("trims whitespace and wrapping quotes", () => {
    assert.equal(cleanSecret("  xkeysib-abc  "), "xkeysib-abc");
    assert.equal(cleanSecret('"xkeysib-abc"'), "xkeysib-abc");
    assert.equal(cleanSecret("'xkeysib-abc'\n"), "xkeysib-abc");
    assert.equal(cleanSecret(""), null);
    assert.equal(cleanSecret(undefined), null);
  });

  it("fingerprints without exposing the secret", () => {
    const fp = secretFingerprint("xkeysib-abcdefgh");
    assert.equal(fp.present, true);
    assert.equal(fp.prefix, "xkey");
    assert.equal(fp.suffix, "efgh");
    assert.equal(fp.hadWhitespace, false);
    assert.equal(secretFingerprint("  abc  ").hadWhitespace, true);
  });
});
