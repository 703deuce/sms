/**
 * Hermetic callback finish-gap tests.
 * Run: npx tsx scripts/test-transovo-callback.ts
 */
import assert from "node:assert/strict";

import * as callbackService from "../src/lib/callback-requests/service";
import * as workspaceEmail from "../src/lib/notifications/workspace-email";

assert.equal(typeof callbackService.createCallbackRequest, "function");
assert.equal(typeof callbackService.updateCallbackRequestStatus, "function");
assert.equal(typeof workspaceEmail.notifyWorkspaceByEmail, "function");

console.log("test-transovo-callback: ok");
