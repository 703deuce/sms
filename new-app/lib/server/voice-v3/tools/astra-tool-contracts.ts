/**
 * Production OpenAI function-tool descriptions for delegated Astra (Voice V3).
 */

export const UPDATE_INTAKE_TOOL_DESCRIPTION = `Save one or more pieces of caller-provided information in the authoritative state for the current call. Use this whenever the caller clearly provides or corrects configured caller/intake information such as their name, email address, phone number, service reason, or another configured business field. When the caller clearly provides or corrects such information, call this tool during the current delegated work rather than intentionally carrying that information only in conversation for later persistence. Save every clearly provided configured field from the same caller statement in one call when possible. Fields may be provided in any order. If the caller clearly corrects an earlier value, save the newest clear value. Do not guess incomplete or uncertain information. This function updates caller/intake information only. It does not search availability, find an existing appointment, book, reschedule, cancel, transfer, or end the call. Do not use it merely because the caller mentions a scheduling date or time.`;

export const SET_SCHEDULING_PREFERENCE_TOOL_DESCRIPTION = `Set or correct the caller's scheduling preference for an appointment availability search. Use this when the caller provides or changes scheduling information such as a date, relative date, weekday, daypart, exact time, approximate time, before/after constraint, or time range. Translate the caller's natural scheduling language into the structured semantic scheduling fields defined by this function — for example "Tuesday afternoon" → THIS_WEEKDAY + TUESDAY + DAYPART + AFTERNOON; "tomorrow at 3" → TOMORROW + EXACT + exact_time; "next Wednesday morning" → NEXT_WEEKDAY + WEDNESDAY + DAYPART + MORNING; "Tuesday around four" → weekday + EXACT or approximate exact_time as supported; "after three" → AFTER + start_time; "between two and five" → BETWEEN + start_time and end_time; explicit calendar dates → EXPLICIT_DATE + explicit_date. Do not calculate calendar dates from weekdays or relative expressions when date_relation and weekday fields express the semantics. Do not calculate UTC timestamps, timezone offsets, DST, or Microsoft calendar identifiers — Transovo resolves meaning deterministically using the current business date, timezone, and scheduling configuration. When the caller clearly corrects a scheduling preference, call again with the newest clear preference. Do not call merely because a date or time is mentioned in unrelated conversation.`;

export const FIND_AVAILABILITY_TOOL_DESCRIPTION = `Search the connected scheduling calendar for real appointment times using the authoritative normalized scheduling preference already stored for this call (via set_scheduling_preference). Call set_scheduling_preference first when the caller provides or changes date/time semantics, wait for a successful result, then call find_availability with no date/time arguments. Use this when the caller asks what times are open or wants to schedule and scheduling preference is already established. This is a read/search operation and does not create or modify an appointment. Do not pass natural-language date or time strings — use set_scheduling_preference for semantics. Do not use it to locate an existing appointment (use find_appointment). Do not use book_appointment to test availability.`;

export const BOOK_APPOINTMENT_TOOL_DESCRIPTION = `Create a new appointment using a specific currently valid appointment slot returned by find_availability. Use this when the caller has selected or clearly accepted an offered slot and wants that new appointment reserved. This function changes the external calendar. Do not use it to check whether a time is available. Do not invent an offer_set_id or slot_id. Use only identifiers from current authoritative availability state. Calling this function does not prove the appointment was booked; treat the appointment as confirmed only when the function returns a verified successful result.`;

export const FIND_APPOINTMENT_TOOL_DESCRIPTION = `Locate and select an existing appointment on the business calendar. Use when the caller asks when their appointment is, wants to cancel or reschedule but the exact appointment is not yet selected, provides identifying information (name, stated phone, email, when the appointment is, service, or address), chooses among appointments you previously presented, or confirms which appointment they mean. Call with whatever the caller has already said — do not invent missing fields and do not require name+phone+email+date together. For when the appointment is scheduled, use the same semantic date/time fields as set_scheduling_preference (date_relation, weekday, explicit_date, time_kind, exact_time, daypart, time_expression, etc.) — these narrow an existing appointment, they do not book a new slot. Inbound caller ID is applied automatically by Transovo; do not pass ANI. If the result is needs_more_information, ask only for a useful_discriminator the tool returned (for example phone, email, appointment_date, appointment_time, service, or location) and call find_appointment again with the new detail. If multiple candidates are returned, ask which appointment they mean using the safe display summaries and pass the matching appointment_selection_id. When the caller clearly confirms one appointment, call again with confirm_selection true and that appointment_selection_id. Never pass a raw Microsoft Graph event id. This tool does not search open times (use find_availability), does not cancel, and does not reschedule.`;

export const RESCHEDULE_APPOINTMENT_TOOL_DESCRIPTION = `Move an existing appointment to a replacement slot that was already offered by find_availability and selected by the caller. Use only after find_appointment has confirmed the exact appointment (confirm_selection), the caller stated a new scheduling preference (set_scheduling_preference), find_availability returned slots, and the caller selected a slot. Provide the authoritative offer_set_id and slot_id from current availability state — never invent timestamps or provider ids. Do not use this to locate the existing appointment or to search availability. Treat reschedule as complete only when this function returns verified success.`;

export const CANCEL_APPOINTMENT_TOOL_DESCRIPTION = `Cancel the exact appointment already identified through find_appointment (confirm_selection). Use only after the caller explicitly confirms they want that appointment cancelled — identity confirmation alone is not cancellation authorization. Do not use this to search for appointments. Do not pass Microsoft Graph event ids. Provide appointment_selection_id when required and confirmed true only after explicit cancel consent. Treat cancellation as complete only when this function returns verified success.`;

export const TRANSFER_CALL_TOOL_DESCRIPTION = `transfer_call — authoritative telephony action to connect the caller to a configured human, team, or transfer route.

WHAT THIS TOOL DOES
This function performs a real live call transfer (direct, warm, or configured waterfall sequence) to an authorized destination published for this business. Calling this tool is how a transfer actually starts — not conversational reassurance, not describing who you will connect them to without invoking the tool, and not narrating a transfer that has not been authorized by the backend. Only a successful tool/runtime result means transfer execution was accepted; connection completion may still depend on telephony — follow the returned result before telling the caller they are connected.

WHEN YOU MUST USE THIS TOOL
Use transfer_call when the caller clearly wants to speak with a human now, a specific configured person or department, billing, the front desk, a nurse, the manager, or any published transfer target. Examples of caller phrasing (guidance for you — not code matching): "Can I talk to someone?"; "Transfer me to the office"; "I need to speak with a real person"; "Connect me to billing"; "Put me through to Dr. Smith's team"; "I want a human"; when you offered a transfer and they said yes ("Sure", "Please", "Okay"); when published after-hours or escalation policy requires human handoff for their request.

WHEN NOT TO USE THIS TOOL
Do NOT use transfer_call when: the caller wants the business to call them back later (use request_callback); they want to leave a written message without immediate connection (use take_message); they want to book via text link (use send_booking_link on SEND_LINK lines); they want live calendar booking (use find_availability / book_appointment on direct-booking lines); they only asked a factual question you can answer; they are mid-intake and have not asked for a human yet; you do not have an authorized route_id or destination_id from the published catalog. Do not invent phone numbers, SIP URIs, extensions, or transfer modes.

WHILE THE TOOL RUNS
You may give a brief, natural hold line before or as the tool runs (for example "One moment while I connect you." or "Let me transfer you now."). Do not claim they are already speaking with the destination, that the transfer succeeded, or that someone picked up until the tool result supports that wording. For warm transfer, follow configured behavior in the result.

SUCCESS BOUNDARY
Do not tell the caller they are connected, on the line with someone, transferred, or speaking with the department until the tool returns success (or the runtime result explicitly authorizes that wording). A planned or attempted transfer is not success by itself.

FAILURE / NON-SUCCESS
If the tool returns failure, no answer, not available, unauthorized destination, or the caller remains with you, explain plainly using the result, offer alternatives (callback, message, retry), and do not pretend the transfer completed.

ARGUMENTS
route_id — required when multiple routes exist; use the published authorized route id; for waterfall routes call once with route_id and let Transovo run the sequence. destination_id — when the caller names a specific configured person/department from the catalog. reason — optional short logging context. Use only ids from your instructions; null when a single route applies.`;

export const END_CALL_TOOL_DESCRIPTION = `end_call — authoritative telephony action to terminate the live PSTN call.

WHAT THIS TOOL DOES
This function ends the telephone call through the application/telephony layer. It is not a conversational goodbye alone — it actually hangs up when appropriate.

WHEN YOU MUST USE THIS TOOL
Use when the caller clearly has no remaining request, explicitly says goodbye and ends the interaction, or policy requires terminating the call. Examples: "That's all, thanks"; "Goodbye"; "I'm done"; after you completed their request and they decline further help.

WHEN NOT TO USE THIS TOOL
Do not use end_call while the caller is still asking questions, mid-tool workflow, waiting on an SMS you just sent, or might continue speaking. Do not use it as a substitute for a polite closing — say goodbye naturally, then end when appropriate. Do not use transfer_call or end_call to avoid finishing a task.

WHILE THE TOOL RUNS
You may say a brief closing ("Thanks for calling. Goodbye.") in the same turn as the tool when the conversation is truly complete.

SUCCESS BOUNDARY
Treat the call as ended only after the tool succeeds. Do not tell them "I've ended the call" before success unless you are simultaneously invoking the tool.

FAILURE / NON-SUCCESS
If end_call fails, remain professional, apologize briefly, and try again or offer callback — do not assume the call ended.

ARGUMENTS
reason — optional short note for logging; null if none.`;

export const SEND_BOOKING_LINK_TOOL_DESCRIPTION = `send_booking_link — authoritative action to text the business booking link by SMS from the Transovo platform sender.

WHAT THIS TOOL DOES
This function sends the configured self-service scheduling URL to the caller's mobile number via SMS. It does not book a calendar appointment, check availability, or reserve a slot. Calling this tool is how the text is actually sent — not saying "I'm texting you now" without invoking the tool.

WHEN YOU MUST USE THIS TOOL
Use on lines where the published booking strategy is Send booking link when the caller wants to schedule or receive the link by text and agrees to receive the SMS. Caller phrasing examples (guidance only): "I'd like to book an appointment"; "Can you text me the link?"; "Send me the scheduling link"; "Yeah, text it to this number"; "This number is fine"; "Send it to the number I'm calling from". Call in the same turn once they agree to the text — do not delay until after you narrate success. If configured required intake fields are still missing, call collect_caller_intake with volunteered_values first (or in the same turn before this tool).

WHEN NOT TO USE THIS TOOL
Do NOT use on Microsoft/direct calendar booking lines (use set_scheduling_preference → find_availability → book_appointment instead). Do not call find_availability or book_appointment before or instead of this tool on SEND_LINK lines. Do not use when the caller refuses SMS or has not agreed to receive the text (when a consent gate applies, confirmed must be true only after agreement and any required disclosure). Do not use for immediate human transfer (transfer_call) or callback requests (request_callback). Do not invent URLs, sender numbers, or claim the message was sent without tool success.

WHILE THE TOOL RUNS
Use a brief natural line ("One moment while I send that text." / "I'll text that link to you now."). Do not say the link was sent, is on the way, or that they should check their phone until the tool returns sent or already_sent.

SUCCESS BOUNDARY
Only after the tool returns sent or already_sent may you tell the caller the booking link was texted. Never claim an appointment is booked or a time is held — only that the link was sent.

FAILURE / NON-SUCCESS
If the tool returns an error, needs_information, blocked sender, or missing intake, explain using the result, collect missing fields with collect_caller_intake if needed, and retry — do not claim the text was sent.

ARGUMENTS
confirmed — true when the caller agreed to receive the booking link by SMS (required true when a verbal SMS consent gate applies; on platform-sender lines default true once they want the link texted). destination_phone — omit/null to use the trusted inbound caller ID (default for "this number", "the number I'm calling from"); set only when they explicitly want a different mobile number (digits they spoke, any format). Never pass placeholders.`;

export function buildSendBookingLinkToolDescription(): string {
  return SEND_BOOKING_LINK_TOOL_DESCRIPTION;
}

export const COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION = `collect_caller_intake — persist and/or collect configured caller intake fields for this business.

WHAT THIS TOOL DOES
Saves volunteered caller facts (name, phone, email, address, custom wizard fields) into authoritative call state and may continue spoken collection in the voice worker when required fields remain. This is how intake is persisted on the LiveKit path — not merely remembering details in conversation.

WHEN YOU MUST USE THIS TOOL
Use when the caller clearly provides one or more configured intake facts, even while also booking, requesting a link, callback, or message. Examples: "My name is Jane Doe"; "It's john@example.com"; "I'm at 555-123-4567"; answering your question for a required field. Pass every clear field in volunteered_values in one call.

WHEN NOT TO USE THIS TOOL
Do not use for calendar dates/times (use set_scheduling_preference on direct booking lines). Do not use when all required intake is already saved and unchanged. Do not use as a substitute for send_booking_link, transfer_call, request_callback, or take_message when those operations are what the caller requested.

WHILE THE TOOL RUNS
Brief acknowledgment is fine ("Thanks, I'll save that."). If the worker continues spoken intake, ask one question at a time per configuration.

SUCCESS BOUNDARY
Treat fields as saved for downstream tools only after success. Do not claim booking, link sent, or callback recorded based on intake alone.

FAILURE / NON-SUCCESS
If collection fails or required fields remain, ask only for what is still missing per the tool result — do not invent values.

ARGUMENTS
volunteered_values — array of {key, value} for every clear configured field from the caller's statement. operation — optional hint (book_appointment, send_booking_link, request_callback, take_message). reason — optional telemetry. caller_turn_hint — optional short hint; usually omit.`;

export const TAKE_MESSAGE_TOOL_DESCRIPTION = `take_message — record a message for staff when the caller wants to leave information without immediate transfer or scheduling.

WHAT THIS TOOL DOES
Creates a durable message for the business team with the caller's content. Not a callback request (unless they also want a return call — then use request_callback).

WHEN YOU MUST USE THIS TOOL
When the caller wants to leave a message, pass along details, or have staff read information later without speaking to someone right now. Examples: "Can you leave a message for the doctor?"; "Tell them I received the forms"; "I need someone to know I'm running late."

WHEN NOT TO USE THIS TOOL
Do not use when they want a return phone call (request_callback), immediate human (transfer_call), or booking link (send_booking_link). Do not invent message content they did not say.

WHILE THE TOOL RUNS
Brief acknowledgment ("I'll pass that along.") is appropriate.

SUCCESS BOUNDARY
Only confirm the message was recorded after tool success.

FAILURE / NON-SUCCESS
Explain failure plainly; offer callback or transfer if appropriate.

ARGUMENTS
message — required substance of what they want staff to know. callback_phone — null when inbound ANI or stored phone suffices; set when they give a different follow-up number. caller_name — null when already in shared intake.`;

export const SEARCH_BUSINESS_KNOWLEDGE_TOOL_DESCRIPTION = `search_business_knowledge — retrieve factual business information from the connected knowledge base.

WHAT THIS TOOL DOES
Runs a search against configured business knowledge (policies, FAQs, services detail beyond hot facts) and returns snippets for you to answer accurately.

WHEN YOU MUST USE THIS TOOL
When the caller asks a factual business question not clearly answered in your BUSINESS FACTS instructions. Examples: specific policy wording, detailed service questions, obscure FAQ topics.

WHEN NOT TO USE THIS TOOL
Do not use for scheduling, availability, booking, transfers, callbacks, or sending links. Do not use when the answer is already in your instructions.

WHILE THE TOOL RUNS
You may say "Let me check that for you." briefly.

SUCCESS BOUNDARY
Answer only from returned content. If empty, say you do not have that information — offer callback or message if appropriate.

FAILURE / NON-SUCCESS
Do not invent facts. Offer human follow-up if needed.

ARGUMENTS
query — natural-language question; not a scheduling request.`;

export const REQUEST_CALLBACK_TOOL_DESCRIPTION = `request_callback — authoritative trusted-backend action to RECORD a human callback request.

WHAT THIS TOOL DOES
This function creates persistent business state: the caller wants someone from the business to contact them later by phone, and Transovo must record that callback request. Calling this tool is how the callback is actually requested — not conversational reassurance, not update_intake alone, not merely thinking about a callback, and not setting an active goal label. Only a successful result from this function (callback_requested) means the callback request was recorded.

WHEN YOU MUST USE THIS TOOL
Use request_callback when the caller clearly wants the business (a person, employee, representative, or the office) to call them back or contact them later by phone, or when they want to leave a message for someone on the team to follow up. Natural variations count as the same operation. Examples include: asking for a callback; asking someone to call them; asking to leave a message for the business; asking to pass information along for follow-up; needing human follow-up by phone when another workflow cannot finish; changing their mind during appointment booking and asking for a callback instead; changing from send-booking-link intent to wanting someone to call them; changing from another operation to requesting a human return call.

OPERATION SWITCHING
If the caller was previously booking, rescheduling, receiving a booking link, or in another workflow and now asks for a callback, treat callback as the CURRENT operation. Reuse caller facts already in shared authoritative state for this call. Do not continue collecting fields required only by the abandoned operation (for example booking-only email, scheduling preference, or booking notes unless they are also configured callback requirements).

WHEN NOT TO USE THIS TOOL
Do NOT use request_callback merely because: the caller asks an ordinary business question Amy can answer; the caller wants to keep talking to Amy; the caller wants to book an appointment and direct booking should continue; the caller wants a booking link and SEND_LINK is the correct workflow; the caller wants an immediate live transfer (use transfer_call); the caller only gives a phone number without requesting a return call; the caller uses the word "call" in conversation but is not asking the business to call them back later.

CONFIGURED REQUIREMENTS (TENANT-SPECIFIC)
Callback-required fields are defined by this business configuration and appear in your runtime instructions — they are NOT universal. Do not assume every tenant requires name, phone, and reason. Reuse shared caller facts already stored (including via update_intake). When inbound ANI is trusted to satisfy phone per configuration, do not unnecessarily ask for another number.

VALIDATOR-DRIVEN LIFECYCLE (CRITICAL)
You do NOT need to wait until you believe every configured callback requirement is satisfied before calling this function. When the caller has clearly requested a callback, invoke request_callback. The trusted Transovo executor validates configured requirements. If the result is needs_information, missingFields is authoritative: (1) callback remains the active operation, (2) have Amy collect ONLY those missing callback fields, (3) preserve previously collected shared facts, (4) invoke request_callback again, (5) repeat only if the backend still reports missing information. Do not claim success during this loop.

WHILE THE TOOL RUNS
You may use a brief natural line ("One moment while I record that for the team."). Do not tell the caller the callback is arranged or confirmed until success.

SUCCESS BOUNDARY
A callback does NOT exist because you or Amy said so. Success requires this function to return authoritative callback_requested. Only then may the caller be told the callback was recorded or arranged. A plain message, collecting fields, update_intake alone, or selecting callback intent without this tool result is NOT success.

FAILURE / NON-SUCCESS
If this function returns needs_information, not_available, an error, persistence failure, or an unknown outcome, do NOT tell the caller the callback was recorded. Respond according to the authoritative tool result.

ARGUMENTS
Use callback_phone, reason, preferred_time, and notes according to their parameter descriptions. Nulls are allowed where described.`;

export const ACTIVE_GOAL_ENUM_DESCRIPTION = `Optional dialog goal when the caller's stated intent is clear and no more specific tool applies yet. Null when unknown or unchanged.`;
