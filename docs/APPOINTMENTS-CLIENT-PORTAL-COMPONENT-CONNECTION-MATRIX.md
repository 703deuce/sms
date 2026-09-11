# Client Portal Component Connection Matrix (summary)

~28 interactive controls across Home, Appointments, Detail, Access, Payments, Profile, Login.

| Area | Connected | Notes |
|------|-----------|-------|
| Login send/verify | 2 | `/api/client/portal/auth/login/[slug]` |
| Session load / logout | 2 | Cookie session |
| Home CTAs | 4 | Book, view, reschedule token |
| Appointment list | 1 | Read session workspace |
| Appointment detail actions | 4 | cancel, reschedule, pay, manage |
| Profile save | 1 | PATCH canonical contact |
| Bottom nav | 6 | Client-side section switch |

**Broken / placeholder / no-op:** 0 on wired controls. Gaps: pending forms UI, invoices, in-portal slot picker.
