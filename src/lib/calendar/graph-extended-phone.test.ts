import assert from "node:assert/strict";
import {
  extractPhoneFromExtendedProperties,
  graphExtendedPhonePropertyKeys,
} from "@/lib/calendar/graph-extended-phone";

const prev = process.env.AR_GRAPH_CUSTOMER_PHONE_PROPERTY_KEYS;
process.env.AR_GRAPH_CUSTOMER_PHONE_PROPERTY_KEYS = "CustomerMobile,clientPhone";

assert.deepEqual(graphExtendedPhonePropertyKeys(), ["CustomerMobile", "clientPhone"]);

assert.equal(
  extractPhoneFromExtendedProperties({ CustomerMobile: "+15551234567" }),
  "+15551234567",
);
assert.equal(extractPhoneFromExtendedProperties({ other: "+15559876543" }), null);

process.env.AR_GRAPH_CUSTOMER_PHONE_PROPERTY_KEYS = prev;

console.log("graph-extended-phone.test.ts PASS");
