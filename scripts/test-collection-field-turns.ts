/**
 * Field-aware collection buffering and single-field prompt enforcement.
 * Run: npx tsx scripts/test-collection-field-turns.ts
 */
import assert from "node:assert/strict";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";
import { captureUsPhoneDigits } from "../src/lib/voice/receptionist/field-validation";
import {
  classifyCollectionUtterance,
} from "../voice-runtime/src/frontdesk/receptionist/collection-utterance-validation";
import {
  mergeSpelledFragments,
  mergeEmailFragments,
  mergeAddressFragments,
  hasIncompleteCollectionBuffer,
} from "../voice-runtime/src/frontdesk/receptionist/collection-fragment-buffer";
import {
  otherMissingFieldQuestionsReferenced,
} from "../voice-runtime/src/frontdesk/receptionist/collection-prompt-guard";
import { buildReceptionistFieldTransitionLine } from "../src/lib/voice/receptionist/field-transition-phrases";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

function phoneField(): AgentFieldDefinition {
  return {
    id: "phone",
    label: "phone number",
    type: "phone",
    required: true,
    question: "What's the best phone number for you?",
  };
}

function emailField(): AgentFieldDefinition {
  return {
    id: "email",
    label: "email",
    type: "email",
    required: true,
    question: "What's your email address?",
  };
}

function lastNameField(): AgentFieldDefinition {
  return {
    id: "last_name",
    label: "last name",
    type: "text",
    required: true,
    question: "Can you spell your last name?",
  };
}

function addressField(): AgentFieldDefinition {
  return {
    id: "address",
    label: "address",
    type: "address",
    required: true,
    question: "What's the street address for the service?",
  };
}

// --- 1. Phone in three groups with pauses ---
let phoneBuffer = "";
const group1 = captureUsPhoneDigits("571", phoneBuffer);
assert.equal(group1.status, "incomplete");
if (group1.status === "incomplete") phoneBuffer = group1.digits;
assert.equal(classifyCollectionUtterance("571", phoneField(), phoneBuffer), "phone_partial");

const group2 = captureUsPhoneDigits("477", phoneBuffer);
assert.equal(group2.status, "incomplete");
if (group2.status === "incomplete") phoneBuffer = group2.digits;

const group3 = captureUsPhoneDigits("6175", phoneBuffer);
assert.equal(group3.status, "complete");
if (group3.status === "complete") {
  assert.equal(group3.normalized, "+15714776175");
}

// --- 2. Spelled last name with pauses ---
let spelled = "";
const letters = ["J", "O", "H", "N", "S", "O", "N"];
for (const letter of letters) {
  const kind = classifyCollectionUtterance(letter, lastNameField(), spelled);
  assert.equal(kind, "fragment_partial", `letter ${letter} should buffer, got ${kind}`);
  spelled = mergeSpelledFragments(spelled, letter);
}
assert.equal(spelled, "JOHNSON");
assert.equal(classifyCollectionUtterance(spelled, lastNameField(), ""), "field_value");

// --- 3. Email fragments ---
let emailBuf = "";
const emailParts = ["john", "at gmail", "dot com"];
for (const part of emailParts.slice(0, 2)) {
  assert.equal(classifyCollectionUtterance(part, emailField(), emailBuf), "fragment_partial");
  emailBuf = mergeEmailFragments(emailBuf, part);
}
emailBuf = mergeEmailFragments(emailBuf, emailParts[2]);
assert.equal(classifyCollectionUtterance(emailBuf, emailField(), ""), "field_value");

// --- 4. Address collected in fragments ---
let addrBuf = "";
assert.equal(classifyCollectionUtterance("123", addressField(), addrBuf), "fragment_partial");
addrBuf = mergeAddressFragments(addrBuf, "123");
assert.equal(classifyCollectionUtterance("Main Street", addressField(), addrBuf), "fragment_partial");
addrBuf = mergeAddressFragments(addrBuf, "Main Street");
assert.equal(classifyCollectionUtterance(addrBuf, addressField(), ""), "field_value");

// --- 5. Normal conversational field — no unnecessary delay classification ---
const reasonField: AgentFieldDefinition = {
  id: "reason",
  label: "reason",
  type: "text",
  required: true,
  question: "What seems to be going on?",
};
assert.equal(
  classifyCollectionUtterance("My AC stopped working yesterday", reasonField, ""),
  "field_value",
);

// --- 6. Single-field prompts ---
const manifest = [phoneField(), emailField()];
const bundled =
  "What's your phone number, and do you have an email?";
const referenced = otherMissingFieldQuestionsReferenced(
  bundled,
  "phone",
  manifest,
  {},
);
assert.ok(referenced.includes("email"), "bundled prompt should reference email field");

const transition = buildReceptionistFieldTransitionLine(
  phoneField(),
  "+15714776175",
  emailField(),
);
assert.ok(!otherMissingFieldQuestionsReferenced(transition, "email", manifest, { phone: "+15714776175" }).includes("phone"));

// --- incomplete buffer blocks advance ---
const ud = {
  workspaceId: "w",
  agentId: "a",
  callId: "c",
  businessName: "Test",
  timezone: "America/New_York",
  cal: {} as FrontDeskUserData["cal"],
  slotUnavailableCount: 0,
  collectionPhoneDigitsBuffer: "571",
} satisfies FrontDeskUserData;
assert.equal(hasIncompleteCollectionBuffer(ud), true);

console.log("✓ collection field turn tests passed");
