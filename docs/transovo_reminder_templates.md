# Transovo Appointment Reminders — Complete SMS & Email Template Library

**306 ready-to-seed templates** across 17 industries, 9 stages, and SMS/email.

## Implementation and compliance notes

- Draft copy requiring review against the active sender approval, consent model, privacy requirements, and available appointment data.
- C/R/X replies and links may only be offered when the matching workflow is enabled and authorized.
- Follow-up messages are separate from transactional reminders; obtain applicable consent and do not auto-enable.
- Template variables must be validated; hide optional clauses when their data or functionality is unavailable.
- Never disclose sensitive appointment titles or medical details by default.
- Do not allow editable text where the Transovo platform sender approval requires locked templates.
- Cancellation/reschedule notices must only fire after a confirmed completed action, not on request alone.
- Variable tokens displayed as red chips in editor; actual recipient messages are plain text/HTML.
- Business profile name auto-populates business_name; recipient name comes from appointment/contact.
- Insert-variable picker, live rendered preview, fallback and missing-field validation, per-channel preview.
- Show SMS segment count GSM-7/UCS-2; ensure approved sender identification and opt-out footer are applied by policy.
- Editable copy only when sender permissions allow; locked platform templates otherwise.
- Email subject and body separately editable; sanitize HTML, responsive design, branded footer and secure action buttons.
- Support industry pack + tone preset + timing step, with independent customer overrides.

## Variables

- `{first_name}` — appointment recipient; optional
- `{business_name}` — workspace business profile; required
- `{appointment_date}` — appointment start in recipient timezone; required
- `{appointment_time}` — appointment start in recipient timezone; required
- `{location}` — appointment or business location; optional
- `{business_phone}` — verified business contact phone; optional
- `{appointment_link}` — signed appointment-specific link; optional
- `{confirm_link}` — signed confirmation action URL; optional
- `{reschedule_link}` — signed reschedule action URL; optional
- `{cancel_link}` — signed cancellation action URL; optional
- `{directions_link}` — verified address-based directions URL; optional

## General

### Booking Confirmation — SMS

```text
Hi {first_name}, your appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your appointment on {appointment_date}

```text
Hi {first_name},

Your appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your appointment is tomorrow at {appointment_time}. Please arrive a few minutes early.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please arrive a few minutes early.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your appointment

```text
Hi {first_name},

Can you still make your appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your appointment time

```text
Hi {first_name},

Your appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your appointment

```text
Hi {first_name},

Your appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your appointment on {appointment_date} at {appointment_time}: Please arrive a few minutes early. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your appointment

```text
Hi {first_name},

Here are the preparation details for your appointment on {appointment_date} at {appointment_time}:

Please arrive a few minutes early.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your visit. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your visit.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Dental

### Booking Confirmation — SMS

```text
Hi {first_name}, your dental appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your dental appointment on {appointment_date}

```text
Hi {first_name},

Your dental appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your dental visit is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming dental appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your dental visit on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your dental appointment is tomorrow at {appointment_time}. Please bring your insurance card and arrive 10 minutes early.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your dental appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your dental visit is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring your insurance card and arrive 10 minutes early.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your dental visit with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your dental appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your dental visit.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your dental visit with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your dental appointment

```text
Hi {first_name},

Can you still make your dental visit on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your dental appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your dental appointment time

```text
Hi {first_name},

Your dental appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your dental appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your dental appointment

```text
Hi {first_name},

Your dental appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your dental visit on {appointment_date} at {appointment_time}: Please bring your insurance card and arrive 10 minutes early. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your dental appointment

```text
Hi {first_name},

Here are the preparation details for your dental visit on {appointment_date} at {appointment_time}:

Please bring your insurance card and arrive 10 minutes early.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your dental care. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your dental care.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Healthcare

### Booking Confirmation — SMS

```text
Hi {first_name}, your appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your appointment on {appointment_date}

```text
Hi {first_name},

Your appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your visit is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your visit on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your appointment is tomorrow at {appointment_time}. Please bring any required forms and identification.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your visit is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring any required forms and identification.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your visit with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your visit.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your visit with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your appointment

```text
Hi {first_name},

Can you still make your visit on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your appointment time

```text
Hi {first_name},

Your appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your appointment

```text
Hi {first_name},

Your appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your visit on {appointment_date} at {appointment_time}: Please bring any required forms and identification. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your appointment

```text
Hi {first_name},

Here are the preparation details for your visit on {appointment_date} at {appointment_time}:

Please bring any required forms and identification.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your care. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your care.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Salon Spa

### Booking Confirmation — SMS

```text
Hi {first_name}, your salon appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your salon appointment on {appointment_date}

```text
Hi {first_name},

Your salon appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your salon visit is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming salon appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your salon visit on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your salon appointment is tomorrow at {appointment_time}. Please arrive with enough time for check-in.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your salon appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your salon visit is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please arrive with enough time for check-in.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your salon visit with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your salon appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your salon visit.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your salon visit with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your salon appointment

```text
Hi {first_name},

Can you still make your salon visit on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your salon appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your salon appointment time

```text
Hi {first_name},

Your salon appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your salon appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your salon appointment

```text
Hi {first_name},

Your salon appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your salon visit on {appointment_date} at {appointment_time}: Please arrive with enough time for check-in. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your salon appointment

```text
Hi {first_name},

Here are the preparation details for your salon visit on {appointment_date} at {appointment_time}:

Please arrive with enough time for check-in.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next appointment. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next appointment.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Legal

### Booking Confirmation — SMS

```text
Hi {first_name}, your consultation with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your consultation on {appointment_date}

```text
Hi {first_name},

Your consultation with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your consultation is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming consultation — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your consultation on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your consultation is tomorrow at {appointment_time}. Please bring relevant documents to your consultation.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your consultation at {appointment_time}

```text
Hi {first_name},

Just a reminder that your consultation is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring relevant documents to your consultation.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your consultation with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your consultation at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your consultation.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your consultation with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your consultation

```text
Hi {first_name},

Can you still make your consultation on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your consultation to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your consultation time

```text
Hi {first_name},

Your consultation with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your consultation with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your consultation

```text
Hi {first_name},

Your consultation scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your consultation on {appointment_date} at {appointment_time}: Please bring relevant documents to your consultation. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your consultation

```text
Hi {first_name},

Here are the preparation details for your consultation on {appointment_date} at {appointment_time}:

Please bring relevant documents to your consultation.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your legal consultation. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your legal consultation.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Financial

### Booking Confirmation — SMS

```text
Hi {first_name}, your financial consultation with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your financial consultation on {appointment_date}

```text
Hi {first_name},

Your financial consultation with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your financial meeting is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming financial consultation — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your financial meeting on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your financial consultation is tomorrow at {appointment_time}. Please have any requested financial documents ready.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your financial consultation at {appointment_time}

```text
Hi {first_name},

Just a reminder that your financial meeting is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please have any requested financial documents ready.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your financial meeting with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your financial consultation at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your financial meeting.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your financial meeting with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your financial consultation

```text
Hi {first_name},

Can you still make your financial meeting on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your financial consultation to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your financial consultation time

```text
Hi {first_name},

Your financial consultation with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your financial consultation with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your financial consultation

```text
Hi {first_name},

Your financial consultation scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your financial meeting on {appointment_date} at {appointment_time}: Please have any requested financial documents ready. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your financial consultation

```text
Hi {first_name},

Here are the preparation details for your financial meeting on {appointment_date} at {appointment_time}:

Please have any requested financial documents ready.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next financial consultation. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next financial consultation.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Real Estate

### Booking Confirmation — SMS

```text
Hi {first_name}, your property appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your property appointment on {appointment_date}

```text
Hi {first_name},

Your property appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your property appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming property appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your property appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your property appointment is tomorrow at {appointment_time}. Please review the property details before your visit.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your property appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your property appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please review the property details before your visit.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your property appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your property appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your property appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your property appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your property appointment

```text
Hi {first_name},

Can you still make your property appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your property appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your property appointment time

```text
Hi {first_name},

Your property appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your property appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your property appointment

```text
Hi {first_name},

Your property appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your property appointment on {appointment_date} at {appointment_time}: Please review the property details before your visit. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your property appointment

```text
Hi {first_name},

Here are the preparation details for your property appointment on {appointment_date} at {appointment_time}:

Please review the property details before your visit.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your property search. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your property search.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Counseling

### Booking Confirmation — SMS

```text
Hi {first_name}, your session with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your session on {appointment_date}

```text
Hi {first_name},

Your session with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your session is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming session — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your session on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your session is tomorrow at {appointment_time}. Please use your usual check-in instructions.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your session at {appointment_time}

```text
Hi {first_name},

Just a reminder that your session is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please use your usual check-in instructions.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your session with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your session at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your session.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your session with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your session

```text
Hi {first_name},

Can you still make your session on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your session to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your session time

```text
Hi {first_name},

Your session with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your session with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your session

```text
Hi {first_name},

Your session scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your session on {appointment_date} at {appointment_time}: Please use your usual check-in instructions. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your session

```text
Hi {first_name},

Here are the preparation details for your session on {appointment_date} at {appointment_time}:

Please use your usual check-in instructions.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next session. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next session.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Massage

### Booking Confirmation — SMS

```text
Hi {first_name}, your massage appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your massage appointment on {appointment_date}

```text
Hi {first_name},

Your massage appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your massage is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming massage appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your massage on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your massage appointment is tomorrow at {appointment_time}. Please arrive a few minutes early and share any accessibility needs.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your massage appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your massage is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please arrive a few minutes early and share any accessibility needs.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your massage with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your massage appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your massage.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your massage with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your massage appointment

```text
Hi {first_name},

Can you still make your massage on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your massage appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your massage appointment time

```text
Hi {first_name},

Your massage appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your massage appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your massage appointment

```text
Hi {first_name},

Your massage appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your massage on {appointment_date} at {appointment_time}: Please arrive a few minutes early and share any accessibility needs. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your massage appointment

```text
Hi {first_name},

Here are the preparation details for your massage on {appointment_date} at {appointment_time}:

Please arrive a few minutes early and share any accessibility needs.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next massage. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next massage.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Fitness

### Booking Confirmation — SMS

```text
Hi {first_name}, your training session with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your training session on {appointment_date}

```text
Hi {first_name},

Your training session with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your training session is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming training session — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your training session on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your training session is tomorrow at {appointment_time}. Bring water, comfortable workout clothes, and any requested equipment.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your training session at {appointment_time}

```text
Hi {first_name},

Just a reminder that your training session is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Bring water, comfortable workout clothes, and any requested equipment.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your training session with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your training session at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your training session.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your training session with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your training session

```text
Hi {first_name},

Can you still make your training session on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your training session to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your training session time

```text
Hi {first_name},

Your training session with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your training session with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your training session

```text
Hi {first_name},

Your training session scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your training session on {appointment_date} at {appointment_time}: Bring water, comfortable workout clothes, and any requested equipment. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your training session

```text
Hi {first_name},

Here are the preparation details for your training session on {appointment_date} at {appointment_time}:

Bring water, comfortable workout clothes, and any requested equipment.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your fitness goals. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your fitness goals.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Education

### Booking Confirmation — SMS

```text
Hi {first_name}, your lesson with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your lesson on {appointment_date}

```text
Hi {first_name},

Your lesson with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your lesson is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming lesson — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your lesson on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your lesson is tomorrow at {appointment_time}. Please bring your learning materials.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your lesson at {appointment_time}

```text
Hi {first_name},

Just a reminder that your lesson is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring your learning materials.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your lesson with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your lesson at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your lesson.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your lesson with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your lesson

```text
Hi {first_name},

Can you still make your lesson on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your lesson to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your lesson time

```text
Hi {first_name},

Your lesson with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your lesson with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your lesson

```text
Hi {first_name},

Your lesson scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your lesson on {appointment_date} at {appointment_time}: Please bring your learning materials. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your lesson

```text
Hi {first_name},

Here are the preparation details for your lesson on {appointment_date} at {appointment_time}:

Please bring your learning materials.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your learning progress. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your learning progress.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Tattoo

### Booking Confirmation — SMS

```text
Hi {first_name}, your tattoo appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your tattoo appointment on {appointment_date}

```text
Hi {first_name},

Your tattoo appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your tattoo appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming tattoo appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your tattoo appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your tattoo appointment is tomorrow at {appointment_time}. Please follow the preparation instructions provided by your artist.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your tattoo appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your tattoo appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please follow the preparation instructions provided by your artist.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your tattoo appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your tattoo appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your tattoo appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your tattoo appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your tattoo appointment

```text
Hi {first_name},

Can you still make your tattoo appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your tattoo appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your tattoo appointment time

```text
Hi {first_name},

Your tattoo appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your tattoo appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your tattoo appointment

```text
Hi {first_name},

Your tattoo appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your tattoo appointment on {appointment_date} at {appointment_time}: Please follow the preparation instructions provided by your artist. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your tattoo appointment

```text
Hi {first_name},

Here are the preparation details for your tattoo appointment on {appointment_date} at {appointment_time}:

Please follow the preparation instructions provided by your artist.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next visit. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next visit.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Photography

### Booking Confirmation — SMS

```text
Hi {first_name}, your photo session with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your photo session on {appointment_date}

```text
Hi {first_name},

Your photo session with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your photo session is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming photo session — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your photo session on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your photo session is tomorrow at {appointment_time}. Please review your session location and outfit guidance.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your photo session at {appointment_time}

```text
Hi {first_name},

Just a reminder that your photo session is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please review your session location and outfit guidance.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your photo session with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your photo session at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your photo session.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your photo session with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your photo session

```text
Hi {first_name},

Can you still make your photo session on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your photo session to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your photo session time

```text
Hi {first_name},

Your photo session with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your photo session with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your photo session

```text
Hi {first_name},

Your photo session scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your photo session on {appointment_date} at {appointment_time}: Please review your session location and outfit guidance. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your photo session

```text
Hi {first_name},

Here are the preparation details for your photo session on {appointment_date} at {appointment_time}:

Please review your session location and outfit guidance.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your photos. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your photos.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Government

### Booking Confirmation — SMS

```text
Hi {first_name}, your service appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your service appointment on {appointment_date}

```text
Hi {first_name},

Your service appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your service appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming service appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your service appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your service appointment is tomorrow at {appointment_time}. Bring any required documents and identification.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your service appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your service appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Bring any required documents and identification.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your service appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your service appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your service appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your service appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your service appointment

```text
Hi {first_name},

Can you still make your service appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your service appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your service appointment time

```text
Hi {first_name},

Your service appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your service appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your service appointment

```text
Hi {first_name},

Your service appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your service appointment on {appointment_date} at {appointment_time}: Bring any required documents and identification. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your service appointment

```text
Hi {first_name},

Here are the preparation details for your service appointment on {appointment_date} at {appointment_time}:

Bring any required documents and identification.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next visit. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next visit.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Automotive

### Booking Confirmation — SMS

```text
Hi {first_name}, your vehicle service appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your vehicle service appointment on {appointment_date}

```text
Hi {first_name},

Your vehicle service appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your service visit is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming vehicle service appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your service visit on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your vehicle service appointment is tomorrow at {appointment_time}. Please bring your vehicle keys and any relevant service information.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your vehicle service appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your service visit is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring your vehicle keys and any relevant service information.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your service visit with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your vehicle service appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your service visit.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your service visit with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your vehicle service appointment

```text
Hi {first_name},

Can you still make your service visit on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your vehicle service appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your vehicle service appointment time

```text
Hi {first_name},

Your vehicle service appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your vehicle service appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your vehicle service appointment

```text
Hi {first_name},

Your vehicle service appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your service visit on {appointment_date} at {appointment_time}: Please bring your vehicle keys and any relevant service information. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your vehicle service appointment

```text
Hi {first_name},

Here are the preparation details for your service visit on {appointment_date} at {appointment_time}:

Please bring your vehicle keys and any relevant service information.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your vehicle care. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your vehicle care.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Home Services

### Booking Confirmation — SMS

```text
Hi {first_name}, your service visit with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your service visit on {appointment_date}

```text
Hi {first_name},

Your service visit with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your service appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming service visit — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your service appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your service visit is tomorrow at {appointment_time}. Please ensure someone can provide access at the scheduled time.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your service visit at {appointment_time}

```text
Hi {first_name},

Just a reminder that your service appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please ensure someone can provide access at the scheduled time.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your service appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your service visit at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your service appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your service appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your service visit

```text
Hi {first_name},

Can you still make your service appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your service visit to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your service visit time

```text
Hi {first_name},

Your service visit with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your service visit with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your service visit

```text
Hi {first_name},

Your service visit scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your service appointment on {appointment_date} at {appointment_time}: Please ensure someone can provide access at the scheduled time. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your service visit

```text
Hi {first_name},

Here are the preparation details for your service appointment on {appointment_date} at {appointment_time}:

Please ensure someone can provide access at the scheduled time.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your next service visit. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your next service visit.

If you have any questions, reach us at {business_phone}.

{business_name}
```


## Veterinary

### Booking Confirmation — SMS

```text
Hi {first_name}, your veterinary appointment with {business_name} is booked for {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Booking Confirmation — EMAIL
**Subject:** Confirmed: your veterinary appointment on {appointment_date}

```text
Hi {first_name},

Your veterinary appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}.

Location: {location}
Appointment details: {appointment_link}

Questions? Contact us at {business_phone}.

{business_name}
```

### Advance Reminder — SMS

```text
Hi {first_name}, a reminder from {business_name}: your pet’s appointment is on {appointment_date} at {appointment_time}. Need to make a change? {reschedule_link}. Reply STOP to opt out.
```

### Advance Reminder — EMAIL
**Subject:** Upcoming veterinary appointment — {appointment_date}

```text
Hi {first_name},

We look forward to seeing you for your pet’s appointment on {appointment_date} at {appointment_time}.

Location: {location}
Need to make a change? {reschedule_link}

{business_name}
```

### Day Before — SMS

```text
Hi {first_name}, {business_name} here. Your veterinary appointment is tomorrow at {appointment_time}. Please bring any requested records for your pet.. STOP to opt out.
```

### Day Before — EMAIL
**Subject:** Tomorrow: your veterinary appointment at {appointment_time}

```text
Hi {first_name},

Just a reminder that your pet’s appointment is tomorrow, {appointment_date}, at {appointment_time}.

Before you arrive: Please bring any requested records for your pet.
Location: {location}
Confirm: {confirm_link}
Need a different time? {reschedule_link}

{business_name}
```

### Same Day — SMS

```text
Hi {first_name}, Your pet’s appointment with {business_name} is today at {appointment_time}. Location: {location}. Reply STOP to opt out.
```

### Same Day — EMAIL
**Subject:** Today: your veterinary appointment at {appointment_time}

```text
Hi {first_name},

We look forward to seeing you today at {appointment_time} for your pet’s appointment.

Location: {location}
Directions: {directions_link}

{business_name}
```

### Confirmation Request — SMS

```text
Hi {first_name}, please confirm your pet’s appointment with {business_name} on {appointment_date} at {appointment_time}.. STOP to opt out.
```

### Confirmation Request — EMAIL
**Subject:** Please confirm your veterinary appointment

```text
Hi {first_name},

Can you still make your pet’s appointment on {appointment_date} at {appointment_time}?

Confirm: {confirm_link}
Reschedule: {reschedule_link}
Request cancellation: {cancel_link}

Thank you,
{business_name}
```

### Reschedule Notice — SMS

```text
Hi {first_name}, {business_name} has updated your veterinary appointment to {appointment_date} at {appointment_time}. Details: {appointment_link}. Reply STOP to opt out.
```

### Reschedule Notice — EMAIL
**Subject:** Updated: your veterinary appointment time

```text
Hi {first_name},

Your veterinary appointment with {business_name} has been updated.

New date: {appointment_date}
New time: {appointment_time}
Location: {location}
Appointment details: {appointment_link}

{business_name}
```

### Cancellation Notice — SMS

```text
Hi {first_name}, your veterinary appointment with {business_name} on {appointment_date} at {appointment_time} has been canceled. Questions? {business_phone}. STOP to opt out.
```

### Cancellation Notice — EMAIL
**Subject:** Canceled: your veterinary appointment

```text
Hi {first_name},

Your veterinary appointment scheduled for {appointment_date} at {appointment_time} has been canceled.

For questions or to book again, contact {business_phone}.

{business_name}
```

### Preparation — SMS

```text
Hi {first_name}, before your pet’s appointment on {appointment_date} at {appointment_time}: Please bring any requested records for your pet. Questions? {business_phone}. STOP to opt out.
```

### Preparation — EMAIL
**Subject:** How to prepare for your veterinary appointment

```text
Hi {first_name},

Here are the preparation details for your pet’s appointment on {appointment_date} at {appointment_time}:

Please bring any requested records for your pet.

Location: {location}
Questions? {business_phone}

{business_name}
```

### Follow Up — SMS

```text
Hi {first_name}, thanks for visiting {business_name}. We appreciate you choosing us for your pet’s care. Questions? {business_phone}. STOP to opt out.
```

### Follow Up — EMAIL
**Subject:** Thank you for visiting {business_name}

```text
Hi {first_name},

Thank you for visiting {business_name}. We appreciate the opportunity to help with your pet’s care.

If you have any questions, reach us at {business_phone}.

{business_name}
```
