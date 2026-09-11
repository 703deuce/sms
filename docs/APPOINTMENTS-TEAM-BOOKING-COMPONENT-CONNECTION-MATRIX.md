# Team Booking Component Connection Matrix

| SECTION | COMPONENT | READ | WRITE | API | BOOKING CONSEQUENCE |
|---------|-----------|------|-------|-----|---------------------|
| Overview | Manage | workspace | — | GET workspace | — |
| Rules | Edit team link | service config | service editor | — | Requirements |
| Services | Table | types | — | GET workspace | — |
| Test | Run test | simulate | — | POST simulate | Same engine as slots |
| Activity | Table | appointments metadata.teamStaffIds | — | GET workspace | Read-only |
| Settings | Team pages link | — | — | — | N/A |

**Connected:** 4 | **Read-only:** 2 | **Placeholder UI:** requirement drawer (use Service editor)
