import assert from "node:assert/strict";
import { ensurePublicActionTokensOnMetadata } from "./public-action-tokens";

const base = ensurePublicActionTokensOnMetadata({});
assert.ok(base.confirmToken && base.confirmToken.length > 8);
assert.ok(base.manageToken && base.manageToken.length > 8);

const preserved = ensurePublicActionTokensOnMetadata({
  confirmToken: "keep-confirm",
  cancelToken: "keep-cancel",
  rescheduleToken: "keep-reschedule",
  manageToken: "keep-manage",
});
assert.equal(preserved.confirmToken, "keep-confirm");
assert.equal(preserved.manageToken, "keep-manage");

const partial = ensurePublicActionTokensOnMetadata({ manageToken: "only-manage" });
assert.equal(partial.manageToken, "only-manage");
assert.ok(partial.cancelToken && partial.cancelToken !== "only-manage");

console.log("public-action-tokens.test.ts: ok");
