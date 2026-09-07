#!/usr/bin/env tsx
/**
 * MCTB setup links + request form certification (MCTB-DEFECT-SETUP-LINKS).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import {
  buildMctbRequestFormPublicUrl,
  DEFAULT_MCTB_REQUEST_FORM_FIELDS,
  generateMctbRequestFormToken,
} from "../src/lib/mctb/request-form";
import { resolveMctbLinkDestinationUrl } from "../src/lib/mctb/template-vars";

assert.equal(MCTB_ROUTES.setupLinks, "/mctb/setup/links");
assert.ok(
  existsSync(join(process.cwd(), "src/app/(app)/mctb/setup/links/page.tsx")),
  "setup links page route must exist",
);
assert.ok(
  existsSync(join(process.cwd(), "src/components/mctb/setup/setup-links-view.tsx")),
  "setup links view component must exist",
);

const token = generateMctbRequestFormToken();
assert.ok(token.length >= 16);
const publicUrl = buildMctbRequestFormPublicUrl(token);
assert.match(publicUrl, /\/f\/mctb\//);

const withForm = resolveMctbLinkDestinationUrl({
  requestFormEnabled: true,
  requestFormToken: token,
  defaultLinkUrl: null,
});
assert.equal(withForm, publicUrl);

const withDefault = resolveMctbLinkDestinationUrl({
  requestFormEnabled: false,
  requestFormToken: null,
  defaultLinkUrl: "https://example.com/book",
});
assert.equal(withDefault, "https://example.com/book");

assert.equal(DEFAULT_MCTB_REQUEST_FORM_FIELDS.length >= 2, true);

console.log("test-mctb-setup-links: ok");
