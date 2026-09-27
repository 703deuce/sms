import assert from "node:assert/strict";
import { CERT_BUSINESS_LINE } from "@/lib/cert/appointments-mctb-browser-cert-constants";
import { resolveMctbWorkspaceBusinessLineE164 } from "@/lib/mctb/resolve-workspace-business-line";

assert.equal(
  resolveMctbWorkspaceBusinessLineE164(CERT_BUSINESS_LINE, "+17035551234"),
  "+17035551234",
);
assert.equal(
  resolveMctbWorkspaceBusinessLineE164("+17031112222", CERT_BUSINESS_LINE),
  "+17031112222",
);
assert.equal(resolveMctbWorkspaceBusinessLineE164(CERT_BUSINESS_LINE, null), CERT_BUSINESS_LINE);

console.log("resolve-workspace-business-line: ok");
