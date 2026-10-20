/**
 * Suggested field mappings per provider — customers configure via UI, never JSON.
 */

import type { CrmProviderId } from "./types";

export type FieldPreset = {
  objectType: string;
  internalField: string;
  externalField: string;
  label: string;
  transform?: string | null;
};

const SHARED_CONTACT: FieldPreset[] = [
  { objectType: "contact", internalField: "firstName", externalField: "FirstName", label: "First name" },
  { objectType: "contact", internalField: "lastName", externalField: "LastName", label: "Last name" },
  { objectType: "contact", internalField: "phone", externalField: "Phone", label: "Phone", transform: "e164" },
  { objectType: "contact", internalField: "email", externalField: "Email", label: "Email", transform: "lowercase" },
  { objectType: "contact", internalField: "company", externalField: "AccountId", label: "Company / Account" },
];

export function fieldPresetsForProvider(provider: CrmProviderId): FieldPreset[] {
  if (provider === "salesforce") {
    return [
      ...SHARED_CONTACT,
      { objectType: "lead", internalField: "firstName", externalField: "FirstName", label: "Lead first name" },
      { objectType: "lead", internalField: "lastName", externalField: "LastName", label: "Lead last name" },
      { objectType: "lead", internalField: "phone", externalField: "Phone", label: "Lead phone", transform: "e164" },
      { objectType: "lead", internalField: "email", externalField: "Email", label: "Lead email" },
      { objectType: "lead", internalField: "source", externalField: "LeadSource", label: "Lead source" },
      { objectType: "lead", internalField: "status", externalField: "Status", label: "Lead status" },
      {
        objectType: "call",
        internalField: "disposition",
        externalField: "CallDisposition",
        label: "Call disposition",
      },
      { objectType: "contact", internalField: "tags", externalField: "Description", label: "Tags → description" },
    ];
  }
  if (provider === "zoho") {
    return [
      { objectType: "contact", internalField: "firstName", externalField: "First_Name", label: "First name" },
      { objectType: "contact", internalField: "lastName", externalField: "Last_Name", label: "Last name" },
      { objectType: "contact", internalField: "phone", externalField: "Phone", label: "Phone", transform: "e164" },
      { objectType: "contact", internalField: "email", externalField: "Email", label: "Email", transform: "lowercase" },
      { objectType: "contact", internalField: "company", externalField: "Account_Name", label: "Company" },
      { objectType: "lead", internalField: "firstName", externalField: "First_Name", label: "Lead first name" },
      { objectType: "lead", internalField: "lastName", externalField: "Last_Name", label: "Lead last name" },
      { objectType: "lead", internalField: "source", externalField: "Lead_Source", label: "Lead source" },
      { objectType: "lead", internalField: "status", externalField: "Lead_Status", label: "Lead status" },
      {
        objectType: "call",
        internalField: "disposition",
        externalField: "Call_Result",
        label: "Call disposition",
      },
      { objectType: "contact", internalField: "tags", externalField: "Tag", label: "Tags" },
    ];
  }
  // Pipedrive — persons/deals; no native leads
  return [
    { objectType: "contact", internalField: "firstName", externalField: "first_name", label: "First name" },
    { objectType: "contact", internalField: "lastName", externalField: "last_name", label: "Last name" },
    { objectType: "contact", internalField: "phone", externalField: "phone", label: "Phone", transform: "e164" },
    { objectType: "contact", internalField: "email", externalField: "email", label: "Email", transform: "lowercase" },
    { objectType: "contact", internalField: "company", externalField: "org_id", label: "Organization" },
    {
      objectType: "call",
      internalField: "disposition",
      externalField: "note",
      label: "Call disposition → note",
    },
    { objectType: "contact", internalField: "tags", externalField: "label_ids", label: "Tags / labels" },
    { objectType: "deal", internalField: "status", externalField: "status", label: "Deal status" },
  ];
}

/** Common internal fields offered in the mapping UI dropdown. */
export const INTERNAL_FIELD_OPTIONS = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "source", label: "Lead source" },
  { value: "status", label: "Status" },
  { value: "tags", label: "Tags" },
  { value: "disposition", label: "Call disposition" },
  { value: "owner", label: "Owner" },
  { value: "notes", label: "Notes" },
];
