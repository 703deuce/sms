# CRM Field Mapping Guide

Map Transovo fields to CRM fields in **Integrations → CRM → [provider] → Mappings**. Never edit JSON.

## Suggested mappings

After Connect, intelligent setup applies provider defaults (phone, email, name, lead source/status, call disposition, tags).

## Common maps

| Transovo | Typical Salesforce | Typical Zoho | Typical Pipedrive |
|----------|--------------------|--------------|-------------------|
| Phone | Phone | Phone | phone |
| Email | Email | Email | email |
| First / last name | FirstName / LastName | First_Name / Last_Name | first_name / last_name |
| Lead source | LeadSource | Lead_Source | — |
| Lead status | Status | Lead_Status | deal status |
| Call disposition | CallDisposition | Call_Result | note |
| Tags | Description | Tag | label_ids |

## Tips

- Use CRM **API names**, not UI labels (Salesforce often ends with `__c` for custom fields).  
- Remove a mapping anytime with **Remove**.  
- Pipedrive has no native Leads module — map people to Persons/Deals instead.  
- Call disposition / custom fields must exist (and be writable) in the CRM for logging probes to succeed.
