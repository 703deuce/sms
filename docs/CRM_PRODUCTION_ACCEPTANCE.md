# CRM Production Acceptance Checklist

Mark complete only after **real sandbox** verification. Repeat for each provider.

## Salesforce · Zoho CRM/Bigin · Pipedrive

- [ ] Connect (wizard completes)  
- [ ] OAuth authorize  
- [ ] Validate connection  
- [ ] Account detection (users / pipelines)  
- [ ] Refresh token  
- [ ] Disconnect  
- [ ] Reconnect  
- [ ] Initial sync  
- [ ] Incremental / manual sync  
- [ ] Contacts import  
- [ ] Leads (N/A Pipedrive)  
- [ ] Accounts / companies  
- [ ] Opportunities / deals (if enabled)  
- [ ] Tasks  
- [ ] Call logging  
- [ ] SMS logging  
- [ ] Recording links  
- [ ] Transcript links  
- [ ] Field mapping UI apply  
- [ ] Owner / pipeline defaults  
- [ ] Duplicate resolution UI  
- [ ] Retry failed jobs  
- [ ] Token expiration → reconnect path  
- [ ] Capability matrix disables unsupported settings  

The feature is **not** production ready until every applicable item passes for that provider.
