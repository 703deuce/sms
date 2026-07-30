-- Additive Telnyx / provider-neutral columns.
-- Safe to run on existing databases. Does NOT drop Twilio columns.

alter table if exists messaging_registrations
  add column if not exists "messagingProvider" text,
  add column if not exists "messagingProfileId" text,
  add column if not exists "phoneNumberId" text,
  add column if not exists "brandId" text,
  add column if not exists "campaignId" text,
  add column if not exists "brandStatusRaw" text,
  add column if not exists "campaignStatusRaw" text,
  add column if not exists "messagingActivationStatus" text,
  add column if not exists "registrationSubmittedAt" timestamptz,
  add column if not exists "registrationApprovedAt" timestamptz,
  add column if not exists "registrationFailureReason" text;

alter table if exists "PhoneNumber"
  add column if not exists "providerNumberId" text;

alter table if exists "ConversationMessage"
  add column if not exists "providerMessageId" text;

create index if not exists messaging_registrations_messaging_profile_id_idx
  on messaging_registrations ("messagingProfileId");

create index if not exists messaging_registrations_brand_id_idx
  on messaging_registrations ("brandId");

create index if not exists messaging_registrations_campaign_id_idx
  on messaging_registrations ("campaignId");

create index if not exists "ConversationMessage_providerMessageId_idx"
  on "ConversationMessage" ("providerMessageId");

create unique index if not exists "ConversationMessage_providerMessageId_key"
  on "ConversationMessage" ("providerMessageId")
  where "providerMessageId" is not null;
