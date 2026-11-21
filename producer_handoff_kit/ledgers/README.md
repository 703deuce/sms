# Live ledgers (copy into `/workspace/motion_jobs/` on a new box)

These are the ledgers actually used on jobs through Nov 21, 2026. A new producer must start from these so looks are not repeated and engine status is current.

`setup/bootstrap_producer_box.sh` copies them to `/workspace/motion_jobs/` when that file does not already exist. Seed templates (older, shorter) remain in `../templates/` for reference only.

**Nov 21 (Rick): `STYLE_LEDGER.md` here is the live shared ledger, not just a seed.** Every production bot pulls it at job start (`skills/motion-studio-production/scripts/ledger/ledger_pull.sh`) and pushes its entry after delivery (`ledger_append.sh`). The copy in `/workspace/motion_jobs/` is only a cache.
