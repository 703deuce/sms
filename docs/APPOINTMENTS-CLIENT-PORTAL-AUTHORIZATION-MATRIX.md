# Client Portal Authorization Matrix (summary)

| Resource | Read | Write | Ownership | Tenant | Auth |
|----------|------|-------|-----------|--------|------|
| Workspace home | Session cookie | — | `contactId` on session | `workspaceId` on session | Required |
| Profile | Session | PATCH profile | Same contact | Same workspace | Required |
| Appointment detail | Session | — | `appointment.contactId === session.contactId` | `appointment.workspaceId` | Required |
| Cancel / reschedule / pay | Session | POST actions | `assertAppointmentOwnedBySession` | Same | Required |
| Manage token mint | Session | POST `manage_token` | Ownership check before `ensureManageAppointmentToken` | Same | Required |
| Legacy portal token URL | Bearer token in URL | — | Session row | Session row | Token hash |
| Manage link | Manage token | POST manage API | Token → appointment | Token workspace | Manage token |

**Denied:** 401 no session, 403 wrong appointment/contact, 404 missing row.

**Never trusted from client alone:** `contactId`, `appointmentId`, `workspaceId` in request body for authorization (profile PATCH ignores client-supplied ids).
