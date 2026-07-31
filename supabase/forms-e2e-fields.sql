-- Forms E2E: views, timestamps, submission rows.
-- Safe to run on existing databases.

alter table if exists "OptInForm"
  add column if not exists "views" integer not null default 0,
  add column if not exists "createdAt" timestamptz not null default now(),
  add column if not exists "updatedAt" timestamptz not null default now();

create table if not exists "FormSubmission" (
  "id" text primary key,
  "workspaceId" text not null references "Workspace"("id") on delete cascade,
  "formId" text not null references "OptInForm"("id") on delete cascade,
  "contactId" text references "Contact"("id") on delete set null,
  "phone" text not null,
  "payload" jsonb,
  "ipAddress" text,
  "userAgent" text,
  "referrer" text,
  "embedHost" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists "FormSubmission_formId_createdAt_idx"
  on "FormSubmission" ("formId", "createdAt");

create index if not exists "FormSubmission_workspaceId_idx"
  on "FormSubmission" ("workspaceId");
