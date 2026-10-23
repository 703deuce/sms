import assert from "node:assert/strict";
import { mapCsvRows } from "../lib/server/phone/power-dialer/csv-import";

const rows = mapCsvRows(
  [{ Name: "Ada", Phone: "+13125550199", Email: "ada@example.com" }],
  {
    name: "Name",
    phone: "Phone",
    email: "Email",
    custom: {},
  },
);
assert.equal(rows.length, 1);
assert.equal(rows[0].email, "ada@example.com");
assert.ok(rows[0].phones[0]?.e164);

const badTz = mapCsvRows(
  [{ Name: "Bob", Phone: "+14155550100", TZ: "not-a-tz" }],
  { name: "Name", phone: "Phone", timezone: "TZ", custom: {} },
);
assert.ok(badTz[0].errors.some((e) => e.includes("timezone")));

console.log("test-mini-crm-native: PASS");
