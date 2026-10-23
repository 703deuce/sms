# Power Dialer Phase 4 migration — production notes

Migration: `20261023150000_power_dialer_phase4`

## Table names (Postgres)

Prisma models map to:

- `Workspace` (not `workspaces`)
- `Contact` (not `contacts`)
- `ContactList` (not `contact_lists`)

A failed deploy that referenced `workspaces` / `contacts` / `contact_lists` required manual repair.

## Repair procedure (one-time)

1. `npx prisma migrate resolve --rolled-back 20261023150000_power_dialer_phase4`
2. Run `scripts/power-dialer-phase4-migration-repair.sql` via `prisma db execute --schema prisma/schema.prisma --stdin`
3. Redeploy so `prisma migrate deploy` applies the **fixed** migration SQL (checksum in `_prisma_migrations` must match the file in git at deploy time).

## Verification (read-only)

```bash
cd new-app && npx tsx scripts/verify-power-dialer-phase4-migration-readonly.ts
```

Checks: migration row finished, Phase 4 tables, `ContactList.filtersJson`, attempt columns, callback backfill vs `callbackAt`, default disposition labels.

## Future deploys

Once `finished_at` is set and `rolled_back_at` is null, Prisma **does not re-apply** this migration. Editing the SQL file after apply causes checksum drift warnings — avoid changing applied migrations; add a new migration for follow-up DDL.
