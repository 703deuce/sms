| # | When · source | step | provider msg | OK | What to verify |
|---:|---|---|---|:---:|---|
| 1 | 2026-10-08T19:56:43.879Z · ar-pipeline-web:1 | `webhook_dispatch_start` | 59c0d003… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 2 | 2026-10-08T19:56:44.304Z · ar-pipeline-web:2 | `inbound_receipt_recorded` | 59c0d003… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 3 | 2026-10-08T19:56:44.430Z · ar-pipeline-web:3 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 4 | 2026-10-08T19:56:44.674Z · ar-pipeline-web:4 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 5 | 2026-10-08T19:56:44.674Z · ar-pipeline-web:5 | `route_matched` | 59c0d003… | ✓ | Workspace + primary session + conversationId resolved |
| 6 | 2026-10-08T19:56:44.675Z · ar-pipeline-web:6 | `ingress_accept_start` | 59c0d003… | ✓ | Ingress path entered for matched session |
| 7 | 2026-10-08T19:56:45.922Z · ar-pipeline-web:7 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 8 | 2026-10-08T19:56:46.164Z · ar-pipeline-web:8 | `ingress_message_persisted` | 59c0d003… | ✓ | Inbound stored in conversation_message |
| 9 | 2026-10-08T19:56:46.413Z · ar-pipeline-web:9 | `ingress_accepted` | 59c0d003… | ✓ | Ingress OK; processingJobId assigned |
| 10 | 2026-10-08T19:56:46.413Z · ar-pipeline-web:10 | `ingress_job_enqueued` | 59c0d003… | ✓ | ar_process_inbound_sms job durable |
| 11 | 2026-10-08T19:56:47.726Z · ar-pipeline-web:11 | `inbound_job_process_start` | 59c0d003… | ✓ | Worker processing inbound |
| 12 | 2026-10-08T19:56:47.873Z · ar-pipeline-web:12 | `inbound_job_session_verified` | 59c0d003… | ✓ | Session lifecycle allows this handler |
| 13 | 2026-10-08T19:56:48.995Z · ar-pipeline-web:13 | `inbound_handler_branch` | 59c0d003… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 14 | 2026-10-08T19:56:49.248Z · ar-pipeline-web:14 | `inbound_job_completed` | 59c0d003… | ✓ | ok:true |
| 15 | 2026-10-08T19:56:49.248Z · ar-pipeline-web:15 | `inbound_outbound_enqueued` | 59c0d003… | ✓ | ar_send_customer_sms queued |
| 16 | 2026-10-08T19:56:49.396Z · ar-pipeline-worker:1 | `outbound_reply_job_start` | 59c0d003… | ✓ | Outbound send job running |
| 17 | 2026-10-08T19:56:56.371Z · ar-pipeline-worker:2 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 18 | 2026-10-08T19:57:13.757Z · ar-pipeline-web:16 | `webhook_dispatch_start` | 411291fa… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 19 | 2026-10-08T19:57:14.159Z · ar-pipeline-web:17 | `inbound_receipt_recorded` | 411291fa… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 20 | 2026-10-08T19:57:14.290Z · ar-pipeline-web:18 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 21 | 2026-10-08T19:57:14.553Z · ar-pipeline-web:19 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 22 | 2026-10-08T19:57:14.553Z · ar-pipeline-web:20 | `route_matched` | 411291fa… | ✓ | Workspace + primary session + conversationId resolved |
| 23 | 2026-10-08T19:57:14.554Z · ar-pipeline-web:21 | `ingress_accept_start` | 411291fa… | ✓ | Ingress path entered for matched session |
| 24 | 2026-10-08T19:57:15.680Z · ar-pipeline-web:22 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 25 | 2026-10-08T19:57:15.958Z · ar-pipeline-web:23 | `ingress_message_persisted` | 411291fa… | ✓ | Inbound stored in conversation_message |
| 26 | 2026-10-08T19:57:16.206Z · ar-pipeline-web:24 | `ingress_accepted` | 411291fa… | ✓ | Ingress OK; processingJobId assigned |
| 27 | 2026-10-08T19:57:16.206Z · ar-pipeline-web:25 | `ingress_job_enqueued` | 411291fa… | ✓ | ar_process_inbound_sms job durable |
| 28 | 2026-10-08T19:57:16.211Z · ar-pipeline-web:26 | `inbound_job_process_start` | 411291fa… | ✓ | Worker processing inbound |
| 29 | 2026-10-08T19:57:16.336Z · ar-pipeline-web:27 | `inbound_job_session_verified` | 411291fa… | ✓ | Session lifecycle allows this handler |
| 30 | 2026-10-08T19:57:18.752Z · ar-pipeline-web:28 | `luna_context_loaded` | 411291fa… | ✓ | historyTurns grows (5→7→9 in this test) |
| 31 | 2026-10-08T19:57:18.871Z · ar-pipeline-web:29 | `luna_turn_start` | 411291fa… | ✓ | Luna V3 turn began |
| 32 | 2026-10-08T19:57:27.569Z · ar-pipeline-web:30 | `inbound_handler_branch` | 411291fa… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 33 | 2026-10-08T19:57:27.569Z · ar-pipeline-web:31 | `luna_turn_completed` | 411291fa… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 34 | 2026-10-08T19:57:27.823Z · ar-pipeline-web:32 | `inbound_job_completed` | 411291fa… | ✓ | ok:true |
| 35 | 2026-10-08T19:57:27.823Z · ar-pipeline-web:33 | `inbound_outbound_enqueued` | 411291fa… | ✓ | ar_send_customer_sms queued |
| 36 | 2026-10-08T19:57:27.846Z · ar-pipeline-web:34 | `outbound_reply_job_start` | 411291fa… | ✓ | Outbound send job running |
| 37 | 2026-10-08T19:57:34.655Z · ar-pipeline-web:35 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 38 | 2026-10-08T19:57:43.710Z · ar-pipeline-web:36 | `webhook_dispatch_start` | f1f6f484… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 39 | 2026-10-08T19:57:44.133Z · ar-pipeline-web:37 | `inbound_receipt_recorded` | f1f6f484… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 40 | 2026-10-08T19:57:44.259Z · ar-pipeline-web:38 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 41 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:39 | `ingress_accept_start` | f1f6f484… | ✓ | Ingress path entered for matched session |
| 42 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:40 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 43 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:41 | `route_matched` | f1f6f484… | ✓ | Workspace + primary session + conversationId resolved |
| 44 | 2026-10-08T19:57:45.618Z · ar-pipeline-web:42 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 45 | 2026-10-08T19:57:45.866Z · ar-pipeline-web:43 | `ingress_message_persisted` | f1f6f484… | ✓ | Inbound stored in conversation_message |
| 46 | 2026-10-08T19:57:46.131Z · ar-pipeline-web:44 | `ingress_accepted` | f1f6f484… | ✓ | Ingress OK; processingJobId assigned |
| 47 | 2026-10-08T19:57:46.131Z · ar-pipeline-web:45 | `ingress_job_enqueued` | f1f6f484… | ✓ | ar_process_inbound_sms job durable |
| 48 | 2026-10-08T19:57:46.906Z · ar-pipeline-worker:3 | `inbound_job_process_start` | f1f6f484… | ✓ | Worker processing inbound |
| 49 | 2026-10-08T19:57:47.035Z · ar-pipeline-worker:4 | `inbound_job_session_verified` | f1f6f484… | ✓ | Session lifecycle allows this handler |
| 50 | 2026-10-08T19:57:49.121Z · ar-pipeline-worker:5 | `luna_context_loaded` | f1f6f484… | ✓ | historyTurns grows (5→7→9 in this test) |
| 51 | 2026-10-08T19:57:49.241Z · ar-pipeline-worker:6 | `luna_turn_start` | f1f6f484… | ✓ | Luna V3 turn began |
| 52 | 2026-10-08T19:57:54.038Z · ar-pipeline-worker:7 | `luna_turn_completed` | f1f6f484… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 53 | 2026-10-08T19:57:54.039Z · ar-pipeline-worker:8 | `inbound_handler_branch` | f1f6f484… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 54 | 2026-10-08T19:57:54.289Z · ar-pipeline-worker:9 | `inbound_job_completed` | f1f6f484… | ✓ | ok:true |
| 55 | 2026-10-08T19:57:54.289Z · ar-pipeline-worker:10 | `inbound_outbound_enqueued` | f1f6f484… | ✓ | ar_send_customer_sms queued |
| 56 | 2026-10-08T19:57:54.291Z · ar-pipeline-web:46 | `outbound_reply_job_start` | f1f6f484… | ✓ | Outbound send job running |
| 57 | 2026-10-08T19:58:01.328Z · ar-pipeline-web:47 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 58 | 2026-10-08T19:58:09.491Z · ar-pipeline-web:48 | `webhook_dispatch_start` | 8ae1b42a… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 59 | 2026-10-08T19:58:09.896Z · ar-pipeline-web:49 | `inbound_receipt_recorded` | 8ae1b42a… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 60 | 2026-10-08T19:58:10.020Z · ar-pipeline-web:50 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 61 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:51 | `ingress_accept_start` | 8ae1b42a… | ✓ | Ingress path entered for matched session |
| 62 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:52 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 63 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:53 | `route_matched` | 8ae1b42a… | ✓ | Workspace + primary session + conversationId resolved |
| 64 | 2026-10-08T19:58:11.347Z · ar-pipeline-web:54 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 65 | 2026-10-08T19:58:11.599Z · ar-pipeline-web:55 | `ingress_message_persisted` | 8ae1b42a… | ✓ | Inbound stored in conversation_message |
| 66 | 2026-10-08T19:58:11.836Z · ar-pipeline-web:56 | `ingress_accepted` | 8ae1b42a… | ✓ | Ingress OK; processingJobId assigned |
| 67 | 2026-10-08T19:58:11.836Z · ar-pipeline-web:57 | `ingress_job_enqueued` | 8ae1b42a… | ✓ | ar_process_inbound_sms job durable |
| 68 | 2026-10-08T19:58:11.841Z · ar-pipeline-web:58 | `inbound_job_process_start` | 8ae1b42a… | ✓ | Worker processing inbound |
| 69 | 2026-10-08T19:58:11.992Z · ar-pipeline-web:59 | `inbound_job_session_verified` | 8ae1b42a… | ✓ | Session lifecycle allows this handler |
| 70 | 2026-10-08T19:58:14.238Z · ar-pipeline-web:60 | `luna_context_loaded` | 8ae1b42a… | ✓ | historyTurns grows (5→7→9 in this test) |
| 71 | 2026-10-08T19:58:14.360Z · ar-pipeline-web:61 | `luna_turn_start` | 8ae1b42a… | ✓ | Luna V3 turn began |
| 72 | 2026-10-08T19:58:18.056Z · ar-pipeline-web:62 | `inbound_handler_branch` | 8ae1b42a… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 73 | 2026-10-08T19:58:18.056Z · ar-pipeline-web:63 | `luna_turn_completed` | 8ae1b42a… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 74 | 2026-10-08T19:58:18.346Z · ar-pipeline-web:64 | `inbound_job_completed` | 8ae1b42a… | ✓ | ok:true |
| 75 | 2026-10-08T19:58:18.346Z · ar-pipeline-web:65 | `inbound_outbound_enqueued` | 8ae1b42a… | ✓ | ar_send_customer_sms queued |
| 76 | 2026-10-08T19:58:18.348Z · ar-pipeline-worker:11 | `outbound_reply_job_start` | 8ae1b42a… | ✓ | Outbound send job running |
| 77 | 2026-10-08T19:58:24.988Z · ar-pipeline-worker:12 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
