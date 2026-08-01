# CRM Support Checklist

Use before escalating to engineering.

1. **Dashboard** — Connected? Token valid? Last sync? Last error?  
2. **Conflicts** — Pending duplicates blocking push?  
3. **Diagnostics → Run core checks** — Env, OAuth, refresh, API, rate limit  
4. **Failed probe** — Expand raw response (field/permission errors)  
5. **Retry failed** / **Force full sync**  
6. **Support tab → Download logs** — share redacted JSON  
7. Confirm workers are running and callback URL matches exactly  
8. Confirm CRM user permissions for Contact/Task/Call objects  

Most “calls not syncing” cases are: preference off, capability unsupported, missing field permission, expired token, or workers down.
