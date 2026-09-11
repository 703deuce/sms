# Client Portal Security Audit

| Control | Status |
|---------|--------|
| Authentication | PASS — httpOnly cookie + hashed `clientPortalSession` |
| Magic link entropy | PASS — `generateSecureToken` (32 bytes base64url) |
| Token expiration | PASS — 30d session expiry enforced server-side |
| Unauthenticated session mint | FIXED — public portal POST disabled |
| Account enumeration (login) | PASS — neutral copy on send/verify |
| Object-level access | PASS — `assertAppointmentOwnedBySession` on appointment APIs |
| Tenant isolation | PASS — all queries scoped by `session.workspaceId` |
| IDOR (appointment id) | PASS — server rejects cross-contact ids |
| Payment authorization | PASS — pay_balance only after ownership check |
| CSRF | PARTIAL — SameSite=Lax cookie; mutations are POST with cookie |
| Open redirect | PASS — redirects limited to `/client`, `/manage/{token}`, checkout URL from server |
| Secrets in URL | PARTIAL — legacy `/portal/{token}` still supported; prefer cookie after exchange |
| Rate limiting | GAP — not added on login endpoint this pass |
| Logout | PASS — DELETE session + clear cookie |

Remaining: formal rate limits, full availability reschedule in-portal, invoice authorization layer, automated cross-tenant E2E.
