# Calendar component connection matrix (summary)

| Component | Read | Write / action |
|-----------|------|----------------|
| Toolbar Today/Prev/Next | client cursor | local state |
| View toggle | localStorage | refetch range |
| Filter bar | workspace API + query params | `/api/calendar/events` |
| Week/Day/Month grid | events API | drawer on click |
| Agenda table | events API | drawer |
| Event drawer | GET `/api/appointments/[id]` | PATCH cancel |
| New appointment | — | `/appointments/new` |
| Block time link | — | `/appointments/availability` |
| Collect balance | metadata | POS route |

**Connected:** 9 primary controls. **No-op removed:** staff columns toggle (deferred). **Placeholder:** 0.
