-- Additive columns for the Transovo campaign library + growth tools.
-- Safe to run on existing databases.

alter table if exists "Campaign"
  add column if not exists "category" text,
  add column if not exists "configJson" jsonb;

create index if not exists "Campaign_workspaceId_category_idx"
  on "Campaign" ("workspaceId", "category");

alter table if exists "Keyword"
  add column if not exists "tagsJson" jsonb,
  add column if not exists "startCampaignId" text,
  add column if not exists "autoReply" text;

alter table if exists "OptInForm"
  add column if not exists "slug" text,
  add column if not exists "disclosureText" text,
  add column if not exists "disclosureVersion" text default 'v1',
  add column if not exists "thankYouMessage" text,
  add column if not exists "doubleOptIn" boolean default false,
  add column if not exists "startCampaignId" text;

create unique index if not exists "OptInForm_workspaceId_slug_key"
  on "OptInForm" ("workspaceId", "slug")
  where "slug" is not null;

alter table if exists "ConsentRecord"
  add column if not exists "disclosureText" text,
  add column if not exists "userAgent" text,
  add column if not exists "formUrl" text,
  add column if not exists "doubleOptInStatus" text;

create index if not exists "ConsentRecord_workspaceId_phone_idx"
  on "ConsentRecord" ("workspaceId", "phone");

create table if not exists "QrCode" (
  "id" text primary key,
  "workspaceId" text not null references "Workspace"("id") on delete cascade,
  "name" text not null,
  "targetType" text not null,
  "targetUrl" text not null,
  "scans" integer not null default 0,
  "status" text not null default 'Active',
  "createdAt" timestamptz not null default now()
);

create index if not exists "QrCode_workspaceId_idx" on "QrCode" ("workspaceId");

create table if not exists "ClickToTextLink" (
  "id" text primary key,
  "workspaceId" text not null references "Workspace"("id") on delete cascade,
  "name" text not null,
  "phoneE164" text not null,
  "body" text not null,
  "href" text not null,
  "clicks" integer not null default 0,
  "status" text not null default 'Active',
  "createdAt" timestamptz not null default now()
);

create index if not exists "ClickToTextLink_workspaceId_idx" on "ClickToTextLink" ("workspaceId");
