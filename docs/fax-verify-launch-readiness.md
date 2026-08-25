# V1 Launch Readiness (MCTB + Fax)

> **Verify is dormant for V1** — see `docs/verify-dormant.md`.  
> **Production certification:** `docs/V1-PRODUCTION-CERTIFICATION.md`

## Quick commands

```bash
npm run test:v1-production-readiness   # V1 launch gate
npm run test:verify                    # Dormant Verify (non-blocking)
```

Hermetic fax safeguards (Reddit addendum) are included in `test:v1-api-products`.

## Still required before PRODUCTION READY

Live Telnyx fax send/receive, production Stripe catalog sync, authenticated browser walkthrough, MCTB live smoke — see manual checklists in `docs/V1-PRODUCTION-CERTIFICATION.md`.
