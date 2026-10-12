import assert from "node:assert/strict";
import {
  buildTransovoStatusPlainText,
  mergeTransovoStatusIntoBody,
  stripTransovoStatusSection,
  statusBlockForKind,
  TRANSOVO_STATUS_HTML_BEGIN,
} from "./status-block";

const block = statusBlockForKind({
  kind: "confirmed",
  atIso: "2026-10-13T13:42:00.000Z",
  timezone: "America/New_York",
});
const plain = buildTransovoStatusPlainText(block);
assert.match(plain, /Status: Confirmed/);
assert.match(plain, /TRANSOVO APPOINTMENT STATUS/);

const htmlBody = `<p>Customer notes here</p>${TRANSOVO_STATUS_HTML_BEGIN}<div>old</div><!-- TRANSOVO-AR-STATUS-END -->`;
const merged = mergeTransovoStatusIntoBody(htmlBody, "html", "<!-- TRANSOVO-AR-STATUS-BEGIN -->new<!-- TRANSOVO-AR-STATUS-END -->");
assert.match(merged, /Customer notes here/);
assert.equal((merged.match(/TRANSOVO-AR-STATUS-BEGIN/g) || []).length, 1);

const stripped = stripTransovoStatusSection(plain + "\n\nOriginal notes");
assert.match(stripped, /Original notes/);
assert.doesNotMatch(stripped, /TRANSOVO APPOINTMENT STATUS/);

const rescheduled = statusBlockForKind({
  kind: "rescheduled",
  atIso: "2026-10-11T19:45:00.000Z",
  timezone: "America/New_York",
  previousStartsAtIso: "2026-10-12T14:00:00.000Z",
  newStartsAtIso: "2026-10-13T19:00:00.000Z",
});
assert.match(buildTransovoStatusPlainText(rescheduled), /Previous time:/);
assert.match(buildTransovoStatusPlainText(rescheduled), /New time:/);

console.log("calendar-write-back status-block.test.ts: PASS");
