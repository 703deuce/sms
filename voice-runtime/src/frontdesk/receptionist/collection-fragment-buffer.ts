import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import {
  isAddressField,
  isEmailField,
  isPhoneField,
  looksLikeNameField,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import type { FrontDeskUserData } from "../userdata";

/** Field types where callers naturally pause between fragments — incomplete until validated. */
export function isFragmentAccumulationField(field: AgentFieldDefinition): boolean {
  if (isPhoneField(field) || isEmailField(field) || isAddressField(field)) return true;
  if (looksLikeNameField(field)) return true;
  const q = `${field.question || ""} ${field.label || ""}`;
  if (/\b(spell|letter by letter|digit by digit)\b/i.test(q)) return true;
  return false;
}

export function asksToSpellField(field: AgentFieldDefinition): boolean {
  const q = `${field.question || ""} ${field.label || ""}`;
  return /\bspell/i.test(q);
}

export function getCollectionFragmentBuffer(
  ud: FrontDeskUserData,
  field: AgentFieldDefinition,
): string {
  if (isPhoneField(field)) return ud.collectionPhoneDigitsBuffer ?? "";
  return ud.collectionFieldFragmentBuffers?.[field.id] ?? "";
}

export function setCollectionFragmentBuffer(
  ud: FrontDeskUserData,
  field: AgentFieldDefinition,
  value: string,
): void {
  if (isPhoneField(field)) {
    ud.collectionPhoneDigitsBuffer = value;
    return;
  }
  if (!ud.collectionFieldFragmentBuffers) ud.collectionFieldFragmentBuffers = {};
  if (value) {
    ud.collectionFieldFragmentBuffers[field.id] = value;
  } else {
    delete ud.collectionFieldFragmentBuffers[field.id];
  }
}

export function clearCollectionFragmentBuffer(
  ud: FrontDeskUserData,
  fieldId: string,
  field?: AgentFieldDefinition,
): void {
  if (field && isPhoneField(field)) {
    ud.collectionPhoneDigitsBuffer = undefined;
  }
  if (ud.collectionFieldFragmentBuffers) {
    delete ud.collectionFieldFragmentBuffers[fieldId];
  }
  if (!field) {
    ud.collectionPhoneDigitsBuffer = undefined;
  }
}

export function clearAllCollectionFragmentBuffers(ud: FrontDeskUserData): void {
  ud.collectionPhoneDigitsBuffer = undefined;
  ud.collectionFieldFragmentBuffers = undefined;
}

export function hasIncompleteCollectionBuffer(ud: FrontDeskUserData): boolean {
  if (ud.collectionPhoneDigitsBuffer?.length) return true;
  const buffers = ud.collectionFieldFragmentBuffers;
  if (!buffers) return false;
  return Object.values(buffers).some((v) => Boolean(v?.length));
}

/** Merge spelled letters / hyphenated fragments: "J" + "O" -> "JO" or "J O H N" -> "JOHN". */
export function mergeSpelledFragments(buffer: string, fragment: string): string {
  const left = buffer.trim();
  const right = fragment.trim();
  if (!left) return right;
  if (!right) return left;

  const combined = `${left} ${right}`;
  const letterChunks = combined.match(/[a-zA-Z]/g);
  const nonSpace = combined.replace(/\s+/g, "");
  if (
    letterChunks &&
    letterChunks.length >= 2 &&
    nonSpace.length <= letterChunks.length * 2 &&
    /^[a-zA-Z\s.\-]+$/i.test(combined)
  ) {
    return letterChunks.join("");
  }
  return combined.replace(/\s+/g, " ").trim();
}

export function mergeEmailFragments(buffer: string, fragment: string): string {
  const combined = `${buffer} ${fragment}`.trim();
  return combined
    .replace(/\s+at\s+/gi, " at ")
    .replace(/\s+dot\s+/gi, " dot ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeAddressFragments(buffer: string, fragment: string): string {
  return `${buffer} ${fragment}`.replace(/\s+/g, " ").trim();
}

export function mergeFragmentUtterance(
  field: AgentFieldDefinition,
  buffer: string,
  fragment: string,
): string {
  if (asksToSpellField(field) || (looksLikeNameField(field) && isSpellingFragment(fragment))) {
    return mergeSpelledFragments(buffer, fragment);
  }
  if (isEmailField(field)) return mergeEmailFragments(buffer, fragment);
  if (isAddressField(field)) return mergeAddressFragments(buffer, fragment);
  if (looksLikeNameField(field)) return mergeSpelledFragments(buffer, fragment);
  return `${buffer} ${fragment}`.replace(/\s+/g, " ").trim();
}

export function isSpellingFragment(fragment: string): boolean {
  const t = fragment.trim();
  if (!t) return false;
  if (/^[a-zA-Z]\.?$/i.test(t)) return true;
  if (/^[a-zA-Z](\s+[a-zA-Z]){0,2}\.?$/i.test(t)) return true;
  if (/^[a-zA-Z]([-.][a-zA-Z])+$/i.test(t)) return true;
  return false;
}

export function looksLikeEmailFragment(fragment: string): boolean {
  const t = fragment.trim().toLowerCase();
  if (!t) return false;
  if (/\b(at|dot)\b/.test(t)) return true;
  if (t.includes("@")) return true;
  if (/^[a-z0-9._-]+$/i.test(t) && t.length <= 32) return true;
  return false;
}

export function looksLikeAddressFragment(fragment: string, buffer: string): boolean {
  const combined = `${buffer} ${fragment}`.trim();
  if (/\d/.test(fragment)) return true;
  if (/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|way|blvd)\b/i.test(combined)) {
    return true;
  }
  return fragment.trim().split(/\s+/).length <= 4;
}
