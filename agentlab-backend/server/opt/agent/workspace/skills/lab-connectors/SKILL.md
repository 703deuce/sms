---
name: lab-connectors
description: Rick's sign-in connectors: Microsoft 365 (Outlook calendar, mail, Teams, Bookings, OneDrive/SharePoint), Calendly, Salesforce, Zoho CRM
when_to_use: Not for: changing how the after-hours phone agent books or what it says to callers (book live on the calendar vs text them a Calendly/booking link vs take a message only; hours; emergencies; intake; transfers; after-call follow-ups) — that is lab-phone-agent, even when a Calendly URL is in the message. Use when Rick asks to connect Microsoft/Outlook/Teams/OneDrive/SharePoint/Bookings, Calendly, Salesforce or Zoho, or for a task that actually reads or writes his calendar events, Outlook mail, Teams messages, OneDrive files, Bookings appointments, Calendly scheduled events or CRM records.
---

# Connectors (one-click OAuth)

Tokens stay on the server; you call the APIs through `connector`. Never ask Rick for passwords or tokens.

- `connector status`: which providers are connected and the scopes Rick actually granted.
- To connect: `connector link microsoft` (or calendly / salesforce / zoho) and give Rick the link. He signs in, approves, and sees "connected". Links expire in 15 minutes. Then run `connector status` to confirm.
- `connector call <provider> <METHOD> <path> [--query JSON] [--body JSON] [--header 'Name: value']`

## Microsoft Graph (v1.0) recipes
- Calendar for a day: `connector call microsoft GET /me/calendarView --query '{"startDateTime":"2026-11-27T00:00:00-05:00","endDateTime":"2026-11-28T00:00:00-05:00","$select":"subject,start,end,showAs"}' --header 'Prefer: outlook.timezone="America/New_York"'`
- Create event: `POST /me/events` with subject, start/end `{"dateTime":"2026-11-27T10:00:00","timeZone":"America/New_York"}`, attendees. **Always verify** by reading the event back (`GET /me/events/<id>`) and checking date, time, timezone and attendee before telling Rick it's booked. Check the slot is free first (calendarView) so you never double-book.
- Mail: `GET /me/messages --query '{"$top":"10","$select":"subject,from,receivedDateTime"}'`; send: `POST /me/sendMail` with `{"message":{...},"saveToSentItems":true}`; sending as Rick needs his explicit OK for that message.
- Teams: `GET /me/joinedTeams`, `GET /teams/<id>/channels`, `POST /teams/<id>/channels/<id>/messages` (needs his OK to post), chats: `GET /me/chats`.
- Files: `GET /me/drive/root/children`, `GET /me/drive/items/<id>/content`; SharePoint: `GET /sites?search=<name>`.
- Bookings: `GET /solutions/bookingBusinesses`, `GET /solutions/bookingBusinesses/<id>/appointments`.
- If a call returns 403, the scope wasn't granted (check `connector status`) or the tenant needs admin consent; tell Rick which permission.

## Others
- Calendly: `GET /users/me`, then `GET /event_types --query '{"user":"<uri>"}'`, `GET /scheduled_events --query '{"user":"<uri>","min_start_time":"..."}'`.
- Salesforce: `GET /services/data/v62.0/query --query '{"q":"SELECT Id,Name FROM Lead LIMIT 5"}'`, `POST /services/data/v62.0/sobjects/Lead`.
- Zoho CRM (v6 base added): `GET /Leads`, `POST /Leads` with `{"data":[{...}]}`.

## Which Microsoft features exist depends on the ACCOUNT type (checked 2026-11-26)
- The connected account is a **personal Microsoft account** (anthony@transovo.ai is a consumer account: `/me/drive` driveType=personal, ids are 16 hex digits). Verified live on it: Calendar OK, Outlook mail OK, Contacts OK, OneDrive (personal) OK. NOT available for any personal account, whatever scopes are granted: Teams chats/channels/meetings (Graph says "No valid license"), SharePoint sites, Bookings, `/organization` ("not supported for MSA accounts"), online meetings. Don't promise those; no re-consent can fix it.
- Teams, SharePoint/Sites and Bookings need a **work/school (Entra ID / Microsoft 365) account** whose tenant has Teams/Bookings licenses. transovo.ai is not a verified domain of any Microsoft 365 tenant (getuserrealm: Unknown), so there is no work account to connect today. When one exists: `connector link microsoft work` (Teams chats/channels/meetings; asks only user-consentable scopes) then, if wanted, `connector link microsoft work-full` (adds Sites.ReadWrite.All and Bookings.ReadWrite.All; some tenants need an admin to approve these). `connector link microsoft personal` adds To Do (Tasks.ReadWrite) for a personal account. Connecting a different account REPLACES the current Microsoft token (the phone line's live booking would then use that account's calendar), so tell the owner before sending a link.
- Never send a Teams message, create a Teams meeting, or post to a channel without the owner approving that exact message and recipient.
