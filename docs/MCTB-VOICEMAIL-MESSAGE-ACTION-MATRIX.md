# MCTB Voicemail — message action matrix

| Action | Prior UI | API / handler | Confirm? | New UI | Status |
|--------|----------|---------------|----------|--------|--------|
| Play/pause | audio controls | recording route | No | Center detail | CONNECTED_AND_WORKING |
| Playback speed | select | client playbackRate | No | Center detail | CONNECTED_AND_WORKING |
| Download | link + menu | recording route | No | Overflow | CONNECTED_AND_WORKING |
| Mark read | on select | mark_read | No | Auto on select | CONNECTED_AND_WORKING |
| Mark unread | overflow | mark_unread | No | Overflow | CONNECTED_AND_WORKING |
| Mark resolved | button | mark_resolved | No | Action bar | CONNECTED_AND_WORKING |
| Needs callback | button | needs_callback | No | Action bar | CONNECTED_AND_WORKING |
| Callback | BusinessCallBackButton | smart callback | No | Primary | CONNECTED_AND_WORKING |
| Block caller | overflow | POST exclusions | confirm | Overflow | CONNECTED_AND_WORKING |
| Retranscribe | overflow + transcript | retranscribe | No | Overflow / transcript | CONNECTED_AND_WORKING |
| Delete | overflow | delete_message | modal | Overflow → modal | CONNECTED_AND_WORKING |
| Notes | textarea blur | update_message_notes | No | Detail bottom | CONNECTED_AND_WORKING |
| Summary | section | GET message | No | Detail | READ_ONLY_BY_DESIGN |
| Translation | English block | GET message | No | Detail | CONNECTED_AND_WORKING |
