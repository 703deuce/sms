# Blueprint 41 — Workflows (`/appointments/workflows`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-4 ABSORPTION GAPS

| Feature ID | Feature | Final Section | UI Pattern | Backend | Status |
|---|---|---|---|---|---|
| WFL-01 | Workflow list | List | Existing Kimi list | `appointment-workflows/` | ALREADY_PRESENT |
| WFL-02 | Create/edit | Builder | Existing builder | engine + editor | ALREADY_PRESENT |
| WFL-03 | Template start | List + wizard | Template cards | `templates.ts` | ALREADY_PRESENT |
| WFL-04 | Preview | Builder | Preview modal | `preview.ts` | ABSORBED |
| WFL-05 | Test run | Builder | Test action | test API | ABSORBED |
| WFL-06 | Execution logs | Activity link | View activity | logs API | ABSORBED |
| WFL-07 | Time triggers | Trigger picker | Human labels | `workflow-scanners.ts` | ALREADY_PRESENT |
| WFL-08 | Live booking types | Conditions/scope | API-loaded selectors | booking types API | ABSORBED |
| WFL-09 | Unknown SMS triage | Activity | Settings in activity | unknown-replies API | ABSORBED |
