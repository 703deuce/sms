# CRM Sync Settings Guide

Open **Integrations → CRM → [provider] → Settings** (or the onboarding wizard).

## Defaults

| Setting | Default | Notes |
|---------|---------|-------|
| Contact creation | On | Creates CRM contacts when unmatched |
| Lead creation | Off | Off / N/A on Pipedrive |
| Company creation | On | |
| Call / SMS / Voicemail logging | On | Capability-gated |
| Recording / transcript links | On | URL in activity body |
| AI summary | On | Included on call logs when present |
| Notes / Activities / Tasks | On | |
| Opportunity updates | Off | Enable when deal sync is desired |
| Direction | Bidirectional | |
| Match by phone / email | On | Prevents duplicates |

Unsupported toggles for the connected CRM appear disabled (capability matrix).

## Direction

- **Bidirectional** — pull CRM contacts + push communications  
- **CRM → Transovo** — inbound only  
- **Transovo → CRM** — outbound events only  

## Owners & pipelines

Set defaults in the wizard or Settings. Intelligent setup pre-selects the first active user/pipeline when available.
