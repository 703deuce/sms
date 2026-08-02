# CRM Customer Setup Guide

Connect Salesforce, Zoho CRM/Bigin, or Pipedrive so calls, SMS, voicemails, recordings, and tasks appear in your CRM without Zapier.

## Before you start

Your Transovo admin must:

1. Set `APP_URL` to the public site URL (no trailing slash).
2. Create OAuth apps in each CRM and set client ID/secret env vars.
3. Register the callback URL exactly as:

   `{APP_URL}/api/crm/salesforce/callback` (or `/api/crm/zoho/callback`, `/api/crm/pipedrive/callback`)

4. Apply database migrations (`npm run db:push`).
5. Run background workers (`npm run worker:all`).

If Connect is disabled or errors immediately, open **Integrations → CRM → [provider] → Diagnostics → Env vars**.

## Connect (customer)

1. Go to **Integrations → CRM**.
2. Click **Connect** on Salesforce, Zoho, or Pipedrive.
3. Sign in to the CRM and approve permissions.
4. Complete the **setup wizard**:
   1. Connected  
   2. Detect account (users, pipelines, modules)  
   3. Sync settings (unsupported options are disabled)  
   4. Field mapping  
   5. Owners & pipelines  
   6. Initial sync  
   7. Summary → Finish  
5. Confirm status on the **Dashboard** tab.

See also: `CRM_FIELD_MAPPING_GUIDE.md`, `CRM_SYNC_SETTINGS_GUIDE.md`, `CRM_FAQ.md`.

## After connect

- New calls and SMS sync automatically when workers are running.
- Use **Sync Now** for a manual pull.
- Use **Reconnect** if you see “Needs Reauthentication”.
- **Disconnect** clears tokens; mappings can be reused after reconnect.

## Permissions checklist (CRM admin)

Grant the authorizing user (or integration user) access to:

| Object | Salesforce | Zoho | Pipedrive |
|--------|------------|------|-----------|
| Contacts / Persons | Contact CRUD | Contacts | contacts:full |
| Companies | Account | Accounts | Organizations |
| Leads | Lead (if used) | Leads | N/A (unsupported) |
| Deals | Opportunity | Deals | deals:full |
| Tasks / Activities | Task | Tasks / Calls | activities:full |
| Users (read) | User | Users READ | users:read |

Recording and transcript sync as **links** in the activity description (not binary file upload).

## What Transovo does not do

- Redesign your CRM pipelines
- Upload recording binary files into CRM storage
- Assume every CRM has the same features (see **Features** tab)
