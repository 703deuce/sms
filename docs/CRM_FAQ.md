# CRM FAQ

**Does Connect work without OAuth apps?**  
No. Your admin must create Salesforce / Zoho / Pipedrive OAuth apps and set env vars. Diagnostics → Env vars shows what’s missing.

**Why can’t I enable Leads on Pipedrive?**  
Pipedrive’s Leads inbox isn’t in the capability matrix. Use Persons + Deals.

**Where do recordings go?**  
As links inside the CRM call/activity note — not binary file upload.

**Sync is queued but nothing happens.**  
Background workers must be running (`npm run worker:all`). Check Dashboard → Pending queue.

**I see “duplicate need review”.**  
Open the Conflicts tab. Choose Use CRM / Use Transovo / Merge / Ignore. Optionally remember the decision.

**Can support see my tokens?**  
No. Support packs redact secrets. Tokens are encrypted at rest when `INTEGRATION_SECRET_KEY` is set.

**How do I start over?**  
Disconnect, Reconnect, or **Restart setup wizard** on the Dashboard.
