# Appointments Clients — Component Connection Matrix (summary)

Full matrix pattern: one row per interactive control. Counts below.

| Section | Connected | Read-only | Blocked / external |
|---------|-----------|-----------|---------------------|
| Directory search | 1 | 0 | 0 |
| Add client | 1 | 0 | 0 |
| Directory row Open | 1 | 0 | 0 |
| Import link | 0 | 0 | 1 (Contacts import) |
| Detail sections nav | 8 | 0 | 0 |
| Book / Message | 2 | 0 | 0 |
| Merge modal | 2 | 0 | 0 |
| Block / Archive | 2 | 0 | 0 |
| Profile save | 1 | 0 | 0 |
| Add note | 1 | 0 | 0 |
| Appointment Open | 1 | 0 | 0 |
| POS collect | 1 | 0 | 0 |
| Portal row | 0 | 1 | next pass |

**Totals:** ~22 connected, ~2 read-only, ~2 external/deferred. **Broken / NO_OP / PLACEHOLDER:** 0 for wired controls; gaps listed in parity audit.
