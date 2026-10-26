# Service booking parity schema

Applied to the development database on 2026-09-08 via `npx prisma db push` after `prisma migrate dev` failed on shadow-database replay.

For fresh environments, run:

```bash
npx prisma db push
# or replay this migration after fixing shadow DB:
# npx prisma migrate deploy
```

Tables introduced in this pass include booking categories, manage-appointment tokens, package/gift/membership commerce, class series, webhook endpoints/deliveries, client portal sessions, household accounts, intake forms, and related ledger tables.
