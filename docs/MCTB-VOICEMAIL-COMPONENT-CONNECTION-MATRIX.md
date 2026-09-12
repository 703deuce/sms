# MCTB Voicemail — component connection matrix

Abbreviated matrix for `/mctb/voicemail` (`MctbVoicemailWorkspace`).

| Region | Component | Read source | Write / action | API |
|--------|-----------|-------------|----------------|-----|
| Header | Configure voicemail | — | Link | `/mctb/setup/voicemail` |
| Number bar | All numbers / line | `loadPersonalNumbers` | URL `numberId` | `GET /api/phone/voicemail?phoneNumberId=` |
| KPI Total | Count | `messages.length` | — | GET voicemail |
| KPI Unread | Count | `!readAt` | — | GET voicemail |
| KPI Minutes | This month | `voicemailMinutesThisMonth` | — | GET voicemail |
| KPI Transcription | On/Off | `box.transcriptionEnabled` | Save settings | `update_box` |
| Inbox search | Filter client | messages | — | — |
| Inbox chips | All/Unread/Read | client | — | — |
| Inbox sort | Newest/Oldest | client sort | — | — |
| Inbox pagination | Footer | client | page/size | global table standard |
| Inbox row | Select | message | `mark_read` on open | POST voicemail |
| Detail playback | audio | recording route | — | GET `.../recording` |
| Call back | Button | caller E164 | callback runtime | smart-routing |
| Needs callback | Button | — | `needs_callback` | POST voicemail |
| Mark resolved | Button | — | `mark_resolved` | POST voicemail |
| Overflow | read/unread/download/retranscribe/block/delete | — | respective actions | POST voicemail / exclusions |
| Notes | textarea | `internalNotes` | blur save | `update_message_notes` |
| Greeting Preview | audio | `box.greetingUrl` | — | canonical URL |
| Greeting Change | drawer | — | `PersonalGreetingControls` | `update_box` |
| Settings toggles | ON/OFF | local + box | Save changes | `update_box` + number action |
| Forwarding link | — | number settings | Link | `/mctb/setup/phone` |
| Test voicemail | modal | managed number | — | user instruction only |

**TEST RESULT:** Automated unit tests for sort/minutes; full browser matrix requires live session (see directive §61).
