# Transovo Internationalization & Localization Standards Guide

**Series:** Implementation standards · **Guide #11 of 12**  
**Status:** Active — mandatory hard standard for how Transovo supports different languages, regions, scripts, number/date formats, plurals, text direction, locale fallbacks, translated UI copy, and international user input without breaking layout or meaning  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** Unicode Standard · Unicode CLDR / UTS #35 (LDML) · BCP 47 / RFC 5646 · W3C Internationalization (I18N) · HTML Standard

---

## Master Cursor rule

> **Transovo internationalization must follow Unicode standards, Unicode CLDR/UTS #35 locale data, BCP 47 language tags, W3C internationalization guidance, and standards-based HTML direction/language semantics. Treat language, locale, region, script, timezone, currency, and text direction as separate concepts. All text handling must be Unicode-safe and normal web/API interchange must use UTF-8. User-facing formatting of dates, times, numbers, currencies, percentages, lists, plurals, display names, and collation must use CLDR-backed internationalization APIs rather than hard-coded English/U.S. rules. UI strings must be externalized into stable semantic translation resources; do not concatenate English fragments, store localized enum values, or use live LLM translation as the authoritative production localization layer. Layouts and components must tolerate translation expansion and non-Latin scripts. RTL must be implemented using proper HTML directionality, Unicode bidirectional behavior, CSS logical properties, and semantically appropriate mirroring—not duplicated or manually reversed interfaces. Customer/user-entered content must preserve its original Unicode text. Localization changes presentation only and must never mutate canonical business, security, payment, consent, scheduling, or authorization state. Pseudolocalization, RTL testing, real target-language review, and end-to-end non-Latin data testing are required before claiming production support for a locale.**

**This final standards guide controls how Transovo supports different languages, regions, scripts, number/date formats, plurals, text direction, locale fallbacks, translated UI copy, and international user input without breaking layout or meaning.**

---

## Core principle

**Language, locale, region, script, timezone, currency, and text direction are separate concepts. The product must never assume English, U.S. formatting, left-to-right text, Latin characters, or one global layout model.**

This is not just translation. **Internationalization is the architecture that makes localization possible.**

**Primary authorities**

| Authority | Role |
|-----------|------|
| **Unicode Standard** | Universal character encoding and text processing |
| **Unicode CLDR / UTS #35 (LDML)** | Standardized locale data for dates, numbers, plural rules, display names, calendars, timezones, collation, and related locale behavior |
| **BCP 47 / RFC 5646** | Standard language tags such as `en-US`, `fr-CA`, `es-MX` |
| **W3C Internationalization (I18N)** | Web internationalization guidance including language declaration and bidirectional text |
| **HTML Standard** | `lang`, `dir`, Unicode text handling, forms, document semantics |

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Internationalization and localization are different

**Internationalization (i18n)** — engineering/design work that makes the product capable of supporting multiple languages and locales.

Examples: externalized strings, locale-aware formatting, RTL layout support, Unicode-safe input, flexible layout, pluralization system.

**Localization (l10n)** — adapting the product for a specific locale.

Examples: Spanish translation, Mexican currency formatting, French date format, Arabic RTL interface.

**Cursor rule:** Build internationalization into the architecture. Do not confuse adding translated strings with making the application internationalized.

---

## B. Use Unicode throughout the system

Transovo must safely support names/content such as José, Nguyễn, 李小明, محمد, Олександр, Māori names, emoji where allowed, and combining characters.

**Cursor rule:** All user-facing text storage, APIs, database fields, search, validation, import/export, rendering, and message processing must preserve Unicode correctly. Do not assume ASCII.

---

## C. UTF-8 should be the standard interchange encoding

For web/API/text files, use UTF-8 unless an external standard explicitly requires something else.

Do not maintain Latin-1 assumptions, ASCII-only string handling, or custom transcoding without a real reason.

This protects names, addresses, messages, translated copy, and calendar data.

---

## D. Never validate names using ASCII-only rules

**Bad:** `^[A-Za-z ]+$` — this would reject legitimate users.

Names can contain accents, apostrophes, hyphens, non-Latin scripts, spaces, and culturally specific structures.

**Cursor rule:** Do not implement "real name" validation using English alphabet assumptions.

---

## E. Do not assume first name + last name fits every culture

Some people have one name, multiple family names, patronymics, family name first, or scripts that do not map cleanly to Western name structures.

If product needs First name / Last name for operational reasons, keep it flexible. Where a display name is sufficient, consider Full name.

Do not attempt to infer culture or identity from name structure.

---

## F. Language and locale are separate concepts

Examples: Language English, Locale `en-US` versus Language English, Locale `en-GB`. Both use English but may differ in date format, punctuation, measurement, week conventions, and number formatting.

**Cursor rule:** Do not use a single language = English value as the complete localization setting.

---

## G. Use BCP 47 language tags

Canonical examples: `en`, `en-US`, `en-GB`, `es`, `es-MX`, `fr-CA`, `zh-Hans`, `zh-Hant`, `pt-BR`, `ar`.

BCP 47/RFC 5646 defines the standard language-tag model. Do not invent `english-us`, `Spanish_Mexico`, or `FR_CANADA`.

**Cursor rule:** Store and exchange language/locale identifiers using valid BCP 47 tags.

---

## H. Do not assume country determines language

Canada may use English, French, or other languages. United States users may prefer Spanish, English, Chinese, etc. Country and language remain distinct.

---

## I. Do not assume language determines country

Spanish does not mean Spain. It could be Mexico, Argentina, Colombia, or the United States. Regional conventions differ. Use locale.

---

## J. Script may need explicit representation

Some languages can use different scripts. Examples include `zh-Hans`, `zh-Hant`, `sr-Latn`, `sr-Cyrl`.

Do not assume language always implies one script. BCP 47 supports script subtags for this purpose.

---

## K. Declare document language

HTML should expose the primary language: `<html lang="en">` or `<html lang="es-MX">`.

This helps screen readers, pronunciation, browser language handling, and accessibility tools.

**Cursor rule:** Every rendered document/application shell must expose the correct primary language programmatically.

---

## L. Mark language changes inside content where necessary

If primarily English page includes meaningful French content: `<span lang="fr">...</span>` where appropriate.

This helps assistive technologies pronounce it correctly. Do not mark every product name. Use for real language changes.

---

## M. Never infer language from script alone

A Latin-script sentence could be English, French, Spanish, Vietnamese, or many others. Script and language are distinct metadata.

---

## N. Use Unicode CLDR for locale behavior

CLDR/LDML provides standardized locale data used across modern software platforms for dates, times, numbers, currencies, plurals, calendars, timezone display names, relative time, display names, collation, and week conventions.

**Cursor rule:** Do not manually maintain locale conventions when CLDR-backed platform APIs already provide them.

---

## O. Use platform internationalization APIs

In modern web JavaScript, prefer `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, `Intl.PluralRules`, `Intl.ListFormat`, and `Intl.DisplayNames` where appropriate.

These use standardized locale data. Do not create hand-written localization logic such as `if (locale === "fr") ...` all over the application.

---

## P. Locale formatting must occur at presentation boundaries

Canonical application data remains structured.

Example: `amount = 1234.5`, `currency = USD`. UI in U.S. locale: `$1,234.50`. German locale: `1.234,50 $` depending on locale conventions.

Never store the formatted display string as the monetary value.

---

## Q. Decimal separators vary

U.S.: `1,234.56`. Many locales: `1.234,56`.

Do not parse localized numbers using remove commas + `parseFloat` without locale-aware handling. That can change `1,5` into `15` or fail incorrectly.

---

## R. Grouping separators vary

They may be comma, period, space, or narrow no-break space. Do not assume `,` always means thousands separator. Use locale-aware formatting/parsing strategies.

---

## S. Digits may not always be Latin digits

Some locales may present different numeral systems. Do not hard-code UI assumptions that digits must visually be `0 1 2 3 4 5 6 7 8 9` unless the specific data format requires ASCII digits.

Machine protocols may require Latin digits. Human presentation can be locale-aware.

---

## T. Currency and locale are separate

A user with `locale = en-US` may transact in USD, CAD, or EUR. Currency must be explicit. Do not infer currency solely from locale.

---

## U. Currency formatting must use currency metadata

Store `amount_minor_units` and `currency = USD` or another precise monetary representation. Then format using locale-aware rules.

Do not build `"$" + amount` because `$` can represent multiple currencies and placement varies.

---

## V. Currency minor units differ

Not every currency uses exactly two decimal places. Do not assume all money = cents for an international architecture. Use authoritative currency metadata/library behavior.

---

## W. Percent formatting is locale-sensitive

Don't build `value + "%"` for every locale. Spacing and representation can differ. Use `Intl.NumberFormat(locale, { style: "percent" })` or equivalent.

---

## X. Lists are locale-sensitive

English: "SMS, email, and voice". Other languages have different conjunctions/punctuation.

Use locale-aware list formatting when generating natural-language lists. Do not concatenate `A + ", " + B + " and " + C` globally.

---

## Y. Pluralization is not just singular vs plural

English often uses 1 appointment / 2 appointments. Other languages can have multiple plural categories. Unicode CLDR includes plural rules precisely because plural systems differ.

**Cursor rule:** Never implement global pluralization with only `count === 1 ? singular : plural`. Use a real pluralization/message-format system.

---

## Z. Grammar may change based on numbers

Example: 1 reminder / 2 reminders. Translated phrase may require different noun form, different word order, or multiple categories.

The entire message should be localizable as a unit. Do not translate word fragments independently.

---

## AA. Do not concatenate UI sentences from translated fragments

**Bad architecture:** `"Send " + count + " reminders " + "before appointment"`. Translation may require different word order.

Use message template: `Send {count} reminders before the appointment` through a proper localization system.

**Cursor rule:** Full semantic messages must be translation units, not assembled from English-specific fragments.

---

## AB. Variables must remain semantically named

**Good:** `{customerName}`, `{appointmentTime}`, `{count}`. **Bad:** `{x}`, `{value1}`, `{str2}`. Translators/localization tooling need context.

---

## AC. Placeholder order cannot be assumed

English: "Anthony has an appointment on Tuesday." Another language may naturally order: "On Tuesday, Anthony has an appointment."

Therefore translations must be able to reorder variables. Do not interpolate in fixed English sentence order.

---

## AD. Translation strings need context

A word like "Book" could mean reserve an appointment or physical book. Translation systems should provide contextual identifiers/descriptions.

Example key: `booking.create_button` — not `book` when ambiguous.

---

## AE. UI copy should not use the same translation key for semantically different English words

English can reuse "Cancel" for cancel appointment and close dialog without saving. These may translate differently. Use separate semantic keys.

---

## AF. Do not use English source string itself as the only durable key

Prefer `appointments.create.title` over `"Create appointment"` as the identifier where localization architecture supports stable semantic keys. Copy can change without invalidating translation mapping.

---

## AG. Translation keys must be stable

Do not rename localization keys every time visual copy changes slightly. Stable keys help translation memory, review, and release management.

---

## AH. Missing translations need a deterministic fallback

Example: `es-MX` → `es` → `en-US` or whatever canonical hierarchy is chosen.

Do not display `undefined` or `booking.create.cta` to users.

**Cursor rule:** Localization fallback policy must be centralized and deterministic.

---

## AI. Missing translations must be visible in development/QA

Production can safely fall back. Development should make missing translations easy to detect.

Do not silently ship half-localized pages because fallback hid every missing string during QA.

---

## AJ. Locale selection should follow a defined priority

Possible hierarchy: (1) explicit user preference, (2) workspace preference where applicable, (3) browser/Accept-Language, (4) product default.

Do not let each page choose differently.

**Cursor rule:** Locale resolution must be centralized.

---

## AK. User preference should generally override automatic detection

If user explicitly chooses Spanish, do not switch back to English next login because browser says `en-US`. Automatic detection initializes preference. It should not override explicit user choice.

---

## AL. Workspace language and individual user language can differ

An organization may operate in English while one staff user prefers Spanish.

Separate workspace-facing defaults, staff interface preference, and customer-facing booking/message language. Do not collapse them.

---

## AM. Customer communication language needs its own policy

Appointment reminder language might derive from contact preference, booking page language, workspace default, or explicit appointment language. Define hierarchy.

Do not simply use the staff member's current UI language.

---

## AN. Booking-page language and admin language are independent

A business owner can use admin in English while customers book through a Spanish booking page. Do not tie customer-facing localization to admin session locale.

---

## AO. Translated customer messages need template-level locale support

Reminder template should support locale-specific versions, fallback version, and localized date/time variables.

Do not translate only the surrounding app while sending all customers English reminders.

---

## AP. Locale must travel with async work when necessary

If a reminder scheduled now will send tomorrow, store/resolvable locale context.

Do not rely on whichever admin happens to be logged in when the worker executes. Background jobs don't have browser locale.

---

## AQ. Locale must be explicit in server-rendered/generated output

Examples: PDF reports, email, SMS, ICS descriptions, exported documents. Server generation must receive locale.

Do not use server OS locale as fallback silently.

---

## AR. Layout must tolerate translated text expansion

English often produces shorter labels than other languages. Test strings roughly 30% longer, 50% longer, sometimes much longer.

No hard-coded `width: 80px;` just because "Save" fits in English.

**Cursor rule:** Components must tolerate realistic text expansion without overlap, clipping, or functional loss.

---

## AS. Buttons should expand before text truncates

Primary button "Create appointment" may become significantly longer in another language. Prefer flexible width or wrap in rare contexts over clipping essential action text.

---

## AT. Navigation labels must tolerate expansion

Sidebar "Appointments" could translate longer. Navigation component should provide enough width, sensible truncation only with recovery, and responsive behavior. Do not tune sidebar width only to English.

---

## AU. Form labels must wrap

Translated label may be two lines. Field geometry must survive. Never force label `nowrap` if it causes clipping.

---

## AV. Error messages must tolerate expansion

Error "This appointment cannot be scheduled because the selected host is unavailable." could become much longer in translation. Error containers must grow. Do not set fixed heights.

---

## AW. Tables need internationalized column strategies

Translated "Confirmation status" could be longer than English. Columns should flex, wrap where appropriate, and support accessible truncation. Do not assume short column labels.

---

## AX. Avoid text embedded in icons or images

Image-based English text cannot be translated/reflowed/accessibly exposed easily. UI labels should be real text.

If an illustration contains necessary text, provide localized assets or avoid embedding text.

---

## AY. Icon meaning must not depend on culture-specific interpretation alone

Some symbols vary culturally. Use icon + label for unfamiliar or consequential actions. Do not assume every market interprets ambiguous iconography identically.

---

## AZ. Color symbolism is culture-dependent

Do not use cultural interpretations of red, green, or white as the only meaning. Our accessibility rules already require text/state communication. This also improves international usability.

---

## BA. Do not localize brand names accidentally

Product names like Transovo normally remain stable unless branding policy says otherwise. Separate translatable content from protected product/provider names.

---

## BB. Provider names should retain canonical identity

Keep Microsoft, Google, Stripe, Square, Zoom, Webex according to their branding/localization rules. Do not machine-translate proper service names.

---

## BC. Right-to-left support must be architectural

Languages such as Arabic and Hebrew require more than translating strings. The interface may need RTL reading direction, mirrored layout relationships, adjusted icons, reordered navigation, correct text alignment, and bidi-safe mixed content.

**Cursor rule:** RTL must be supported through direction-aware layout primitives, not by creating a separate manually mirrored application.

---

## BD. Use HTML dir

For a whole RTL page: `<html dir="rtl">`. For local directional content: `dir="rtl"`, `dir="ltr"`, `dir="auto"` as appropriate.

Do not implement RTL by `transform: scaleX(-1);` — that mirrors content incorrectly.

---

## BE. Prefer CSS logical properties

Instead of `margin-left`, `padding-right`, `border-left`, `left`, `right` for directional layout where appropriate, prefer `margin-inline-start`, `margin-inline-end`, `padding-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-start`.

**Cursor rule:** Use logical layout properties for new reusable UI wherever directionality matters. This makes LTR/RTL support dramatically safer.

---

## BF. "Start" and "end" are better than "left" and "right" in UI logic

For text/alignment logic use start/end rather than assuming left = beginning and right = end. In RTL, those reverse.

---

## BG. Not every icon should mirror in RTL

Usually directional icons may need mirroring: back, forward, next, previous, indent. But non-directional icons generally do not: search, calendar, camera, plus, trash.

**Cursor rule:** Mirror icons based on semantic direction, not a blanket CSS flip.

---

## BH. Brand logos should generally not mirror

Transovo logo should not become backwards in RTL. Exclude non-directional graphical assets from mirroring.

---

## BI. Numbers inside RTL text require bidi-safe handling

Examples: phone numbers, dates, times, order IDs, URLs can render confusingly inside RTL context if bidirectional text isn't handled correctly. Use Unicode/HTML bidi isolation where necessary.

---

## BJ. User-generated text direction may be unknown

Contact notes/messages may be English, Arabic, or mixed. Use appropriate automatic direction behavior (`dir="auto"` where suitable) instead of forcing entire content body based solely on app language.

---

## BK. Mixed-direction text must not corrupt surrounding UI

A customer may paste "محمد - john@example.com". The email/address must not cause punctuation/buttons to jump unpredictably. Use proper bidi isolation.

---

## BL. Never manually reverse strings for RTL

No `text.split("").reverse()`. Directionality is handled by Unicode bidi algorithms and layout systems. Manual reversal corrupts numbers, punctuation, and combining characters.

---

## BM. Unicode normalization must be considered for comparison/search

Visually identical text may have different Unicode code-point sequences. For appropriate matching/search/uniqueness operations, use Unicode-normalization-aware logic.

Do not assume byte equality always means human text inequality.

---

## BN. Do not normalize destructively without understanding the field

Canonical normalization can help matching. But preserve user-facing intended text where appropriate.

Example: Customer's name should display as entered, while search may use normalized representation internally.

---

## BO. Case conversion is locale-sensitive

Do not assume `string.toLowerCase()` is universally sufficient for language-sensitive matching/display. Certain languages have special casing rules. Use locale-aware case operations where required.

---

## BP. Case-insensitive identifiers should ideally avoid human-language case complexity

For machine identifiers (UUID, stable slug rules, normalized email handling according to specification), do not depend on arbitrary locale casing. Separate user-facing text from machine identity.

---

## BQ. Sorting/collation is locale-sensitive

Alphabetical sorting is not one universal code-point ordering. CLDR provides collation data. Use locale-aware collation for human-facing lists where alphabetical order matters.

Example: Contacts A–Z. Do not sort by raw Unicode code point if it produces unnatural order.

---

## BR. Search should support accents appropriately

Depending on search mode, "Jose" may reasonably find "José". Do not require users to type exact diacritics for ordinary contact search unless precision demands it. Search normalization must preserve correct display values.

---

## BS. Search must still support exact distinctions when necessary

Accent-insensitive matching is useful for discovery. But identifiers or legally significant data may need exact representation. Search flexibility and canonical data integrity are separate.

---

## BT. Do not strip non-Latin characters to "sanitize" text

Security sanitization must target executable markup and dangerous syntax — not foreign characters. No "remove everything except A-Z" for notes/names.

---

## BU. URLs and emails have internationalization considerations

Internationalized domains and Unicode emails can exist. Exact support depends on product/provider compatibility.

Do not reject international domains solely because they contain non-ASCII display forms. Use standards-aware URL/email libraries.

---

## BV. Phone numbers must use international numbering rules

Since Transovo supports international SMS, store canonical phone numbers where practical in E.164-like normalized form (`+15714073615`) while displaying localized formatting.

Do not assume 10 digits, U.S. area codes, or North American formatting for every contact.

---

## BW. Country calling code and locale are independent

A Spanish-speaking user might have +1 U.S. phone number. Do not infer language from phone country code.

---

## BX. Postal addresses must not assume U.S. field ordering globally

U.S.: Street, City, State, ZIP. Other countries differ.

If Transovo later collects international business addresses, use country-aware address schemas. Do not hard-code State as universally required.

---

## BY. Postal code must not be numeric-only

Examples outside U.S. can contain letters. Do not define `zipCode: number`. Use string.

---

## BZ. Country names should use standardized data/codes

For internal identity, prefer standards such as ISO country codes where appropriate. Display localized country names via CLDR.

Do not store translated display name as country identity. Example: `US` → display "United States" or localized equivalent.

---

## CA. Region/state/province values should not be globally hard-coded

Jurisdictions vary. Do not assume all countries have states or two-letter codes. Use country-aware data/provider models.

---

## CB. Measurement units may be locale-dependent

If Transovo ever displays distances, sizes, etc., do not assume miles, feet, or Fahrenheit globally. Use explicit units and locale/product policy.

For current appointment product this may matter less but architecture should not hard-code American units into generic components.

---

## CC. Paper/report formats vary

U.S. often uses Letter. Many regions use A4. If PDF/report printing supports international users, choose/report configuration deliberately. Do not assume U.S. Letter is universal.

---

## CD. Weekends differ by locale/business

Internationalization data can include week conventions, but business scheduling must use actual business configuration.

Do not assume Saturday/Sunday are always non-working days globally. The Date/Timezone guide already covers operational schedule semantics.

---

## CE. Calendars can differ from Gregorian in user cultures

Unicode CLDR supports multiple calendars. Transovo can initially choose Gregorian as its product calendar if that's the supported scope.

But do not present that choice as all locales inherently use Gregorian formatting.

**Cursor rule:** Product-supported calendar systems must be explicitly documented rather than accidentally inferred from locale.

---

## CF. If only Gregorian is supported initially, fail clearly

Do not half-render another calendar system. It's acceptable to say product scheduling uses Gregorian calendar while still localizing month names, date order, and language. Support can expand later.

---

## CG. Time formatting belongs to locale; scheduling semantics belong to timezone

From Guide #10: `en-US` doesn't mean Eastern Time. Likewise `ar` doesn't dictate one timezone. Keep locale and timezone separate throughout localization.

---

## CH. Translation must not alter machine data

Translated UI label "Confirmed" may become another language. Backend status remains `confirmed`. Do not persist localized display labels as enum values.

---

## CI. Enum values must be stable and language-neutral

Store `status = confirmed`. Not `status = "Confirmado"`. Presentation layer translates. Otherwise changing locale breaks queries/business logic.

---

## CJ. Routes and API field names should generally remain locale-neutral

Do not require `/es/citas` / `/en/appointments` for internal admin routes unless localized routing is deliberately a product requirement.

UI can translate while canonical route/API structure remains stable. Public SEO pages may be different.

---

## CK. Do not translate database keys or provider identifiers

Never localize webhook event names, enum constants, API scopes, provider field names, or database columns. Only user-facing presentation.

---

## CL. Templates need translation-safe variable syntax

For SMS/email templates: `Your appointment is {appointmentTime}.` must keep variables stable across translations.

Translation should not alter `{appointmentTime}` into arbitrary text that runtime cannot resolve.

---

## CM. Template validation must detect missing variables

If English template contains `{appointmentTime}` and `{businessName}` and translated template accidentally drops required `businessName`, validation should catch it where needed. Do not discover at runtime send.

---

## CN. Message length can change materially by language

SMS character encoding/segment count can change based on language/script and Unicode characters. This can affect number of SMS segments, cost, and truncation.

**Cursor rule:** Message preview and cost/segment logic must use the actual localized message encoding/content, not English estimates. This is especially relevant for Transovo's SMS reminders.

---

## CO. Never truncate translated customer messages at arbitrary character counts

If channel limit exists: show validation, segment correctly, shorten intentionally. Don't cut Unicode strings mid-grapheme or mid-sentence.

---

## CP. Unicode string length is not the same as visual character count

Emoji and combining characters can contain multiple code points. Do not use raw `.length` as a universal "character" measure for UI or messaging limits without understanding encoding/graphemes.

---

## CQ. Truncation must respect grapheme clusters

Don't split emoji sequences or accented combining characters in the middle. Use Unicode-aware segmentation where truncation is necessary.

---

## CR. Cursor movement/editing should rely on browser/platform Unicode behavior

Do not implement custom text editing that treats every code unit as one human character. This can break emoji, combining marks, and certain scripts. Use native input behavior whenever possible.

---

## CS. Font system must support required scripts

A beautiful Latin-only font is not sufficient if Transovo supports Arabic, Chinese, Cyrillic, or Devanagari. Define fallback font stacks with broad Unicode coverage.

**Cursor rule:** Never display unsupported script as tofu/missing-glyph boxes because the brand font lacks coverage.

---

## CT. Font fallback should preserve readability

If primary font lacks a script, fallback should support script fully, remain legible, and maintain reasonable metrics. Don't force a decorative fallback merely to imitate the Latin font.

---

## CU. Font weight availability may differ by script

Not every script/font family provides 400, 500, 600, 700. Design should degrade gracefully. Do not depend on ultra-specific weight distinctions to convey semantic meaning.

---

## CV. Line height may need to accommodate script differences

Some scripts require more vertical space for diacritics, marks, or glyph shapes. Avoid fixed-height text containers. Let typography system support script-safe line boxes.

---

## CW. Uppercase transformations are not universal design tools

Avoid globally `text-transform: uppercase;` for navigation/labels. Some scripts have no case. Some languages have special case behavior. Sentence case is safer and aligns with the visual rules we already chose.

---

## CX. Letter spacing should not be globally applied to all scripts

Tracking designed for Latin uppercase may look wrong or break other scripts. Use script-aware typography.

---

## CY. Translation should not be generated blindly in production by AI

AI may assist translation workflows. But customer-facing localization should be reviewed, versioned, testable, and deterministic.

Do not let the same button translate differently on every request.

**Cursor rule:** Production UI localization must use managed translation resources, not live LLM generation as the authoritative translation layer.

---

## CZ. AI translation must preserve variables and protected terminology

If AI assists translation: freeze template variables, preserve provider/product names, validate placeholders, review high-risk copy — especially consent, payment, security, and compliance. Machine translation errors here can have serious consequences.

---

## DA. Legal/compliance translations need heightened review

Do not trust general automated translation alone for consent language, privacy disclosures, recording notices, A2P instructions, or payment terms. Where legal meaning matters, use approved reviewed translations.

---

## DB. Error messages must be localized too

Do not create Spanish page "Crear cita" then error "Invalid date range." All customer-facing/system UI copy needs localization coverage.

---

## DC. Backend validation must return localization-friendly error codes

Prefer backend `error_code = appointment_time_unavailable` plus structured context. Frontend translates "This time is no longer available."

Do not make backend return only an English sentence that the UI has to parse/translate.

---

## DD. Never branch business logic on translated error text

No `if (error.message === "Appointment not found")`. Use stable codes. Localization must not affect logic.

---

## DE. Notifications must preserve recipient locale

Email notification to Spanish-speaking customer should not become English because job worker default locale is English. Store/resolvably determine intended locale at send time.

---

## DF. System-generated PDF/CSV reports need locale rules

For human-readable exports consider date format, number format, translated headings, timezone, and decimal separator.

Machine-oriented CSV may intentionally use standardized values; define that contract. Do not mix conventions unpredictably.

---

## DG. CSV separators can conflict with locale number formatting

If locale uses comma decimals (`1,50`), comma-separated CSV can be confusing. Use standards-compliant CSV quoting or configured delimiter. Do not hand-build CSV by joining strings with commas.

---

## DH. CSV encoding should support Unicode

Use UTF-8. If supporting spreadsheet consumers with BOM/other compatibility behavior, do so deliberately. Do not corrupt non-English names during export.

---

## DI. Sorting should use locale-aware collation when user-facing

Example Contacts: English alphabetical rules differ from Swedish, German, or Spanish. Use `Intl.Collator` or equivalent CLDR-aware implementation.

---

## DJ. Filtering/search behavior should be documented per locale

Decide whether search is case insensitive, accent insensitive, width insensitive, kana-sensitive, etc. Use appropriate locale-aware search primitives. Do not assume English search semantics apply everywhere.

---

## DK. Keyboard shortcuts cannot depend solely on English letters without consideration

Example: N = New appointment may be less intuitive in another language. Shortcuts can remain standardized but must be optional accelerators, discoverable, and not required to operate.

Don't require translated users to know English mnemonic keys.

---

## DL. Access keys need extreme caution

Browser/OS/assistive technologies use many combinations. Do not assign language-dependent access keys casually. The Keyboard guide still governs shortcut safety.

---

## DM. Voice/AI language detection must not silently override user settings

If customer sends Spanish email, AI may detect Spanish and respond in Spanish according to product policy.

But do not globally change `contact locale = Spanish` based on one ambiguous sentence unless product explicitly supports that inference. Detection is evidence, not always authoritative preference.

---

## DN. AI Booking should preserve language across turns

If conversation begins in Spanish, AI should not suddenly reply in English because a tool result returned English text. Tool outputs should be normalized into the conversation language. Business data stays language-neutral internally.

---

## DO. AI tool parameters must remain canonical even when conversation is localized

Customer: "mañana a las dos". LLM produces structured date/time intent and timezone. Tool call should not pass translated enum values like `status = "confirmado"`. Canonical backend values remain stable.

---

## DP. AI-generated dates/times must use the Date/Timezone standards

Localization does not change temporal authority. AI says "martes a las 2". System resolves with explicit timezone, authoritative availability, and locale-aware output.

Do not let translation layer perform scheduling arithmetic.

---

## DQ. Customer locale must not affect security or permission decisions

A user switching language English → Spanish must not change role, consent status, sender eligibility, payment access, or security requirements. Localization is presentation. Business/security state is canonical.

---

## DR. Locale identifiers from the client must be validated

Do not accept arbitrary strings and load arbitrary resource paths. Validate against supported locale list/BCP 47 processing. Avoid path injection through locale parameters.

---

## DS. Unsupported locales need a clean fallback

If browser requests `fr-CH` and Transovo supports only `fr` and `en`, use defined fallback. Do not crash the shell.

---

## DT. Partial localization must be intentional

If only public Booking Page supports Spanish initially but admin does not, make that a documented scope.

Do not accidentally show half Spanish / half English because some translation files exist.

---

## DU. Locale rollout needs feature completeness criteria

Before claiming "Transovo supports Spanish", verify the supported product surface: navigation, forms, errors, validation, empty states, onboarding, public booking, notifications, reminders, dates/numbers, PDFs if included, and legal/compliance copy within that scope.

"Some strings translated" is not language support.

---

## DV. Translation coverage should be measurable

Localization pipeline should track total strings, translated, missing, outdated, and needs review. Do not rely on manual visual inspection alone.

---

## DW. Source-string changes should invalidate/review translations

If English changes "Delete contact" to "Permanently delete contact and history", existing translation may no longer be adequate. Translation system should mark it for review.

---

## DX. Dynamic content must not bypass localization

Common bug: static button translated, runtime toast remains English. Every customer-facing dynamic message should use the same localization layer.

---

## DY. Server and client should use the same canonical message keys where practical

This prevents server English error + client localized UI. Define stable error/status codes and localization ownership.

---

## DZ. Do not localize internal logs unnecessarily

Engineering logs should generally use canonical technical terms. User-facing logs/timelines can localize labels. Keep debugging stable across languages.

---

## EA. Audit data and audit presentation are different

Store `event_type = appointment_cancelled`. Display "Appointment canceled" or localized equivalent. Changing locale must not rewrite audit records.

---

## EB. Historical customer messages remain as actually sent

If customer received English SMS in August and later switches preference to Spanish, message history should show the actual English content sent.

Do not dynamically translate historical communications and pretend that's what was delivered.

---

## EC. Historical UI event labels may localize dynamically

Timeline event `type = reminder_sent` can display in current user's locale. Actual message body remains original. Distinguish event metadata from immutable communication content.

---

## ED. User-entered content should not be automatically translated unless explicitly requested

Notes "Customer prefers side entrance." should remain what user wrote. Do not silently translate/stomp user content when UI locale changes.

---

## EE. Customer-generated content must preserve original language

Messages/emails/transcripts should retain original. Optional translation can be a derived view ("Translate") but never replace authoritative source.

---

## EF. AI translation of customer messages must be labeled

If Transovo offers "View translation", make it clear translation is generated. Original remains accessible. Especially important for disputes, consent, and instructions.

---

## EG. Export should preserve originals where source fidelity matters

Conversation export should include original content. If translated views are exported, label them as translations. Do not substitute AI translation for source evidence.

---

## EH. RTL public Booking Pages must preserve workflow order semantically

The layout may mirror. But logical sequence remains: choose booking type → choose time → enter information → confirm.

Don't reverse workflow merely because reading direction changes.

---

## EI. Horizontal progress indicators may mirror visually for RTL

The semantic step progression stays the same. Use direction-aware components. Do not manually reorder business step arrays unless required by component semantics.

---

## EJ. Calendars must support locale-dependent week presentation

Day names, month names, week start should adapt according to supported locale policy. Appointment instants do not change. Presentation changes.

---

## EK. Numeric time grid labels should remain readable in RTL

Calendar "9:00 AM" must align correctly and not reorder punctuation/digits. Test real RTL layouts.

---

## EL. Charts need localized axes/legends

Analytics should localize dates, percentages, numbers, and series labels. But data values remain canonical. Charts must also survive translated label expansion.

---

## EM. Chart color/shape semantics must not rely on language

Status series Confirmed/Canceled — translations change labels, not underlying series ID/color mapping. Keep semantic identifiers stable.

---

## EN. Localization must not break analytics comparisons

If decimal/date formatting changes, sorting/filtering calculations still use canonical values. Never calculate from rendered localized strings.

---

## EO. Public URLs/slugs need deliberate internationalization policy

If Booking Page slug is user-generated, decide whether to support Unicode slugs, ASCII transliteration, or percent encoding.

Do not accidentally break non-Latin business names. Canonical ID should remain independent of display slug.

---

## EP. Slug uniqueness must not rely solely on locale-sensitive casing

Use stable normalization rules. Do not let changing locale make two slugs become the same or different unpredictably.

---

## EQ. Search indexing should retain original Unicode text

Do not transliterate everything to ASCII and throw away the source. You may maintain normalized search forms. Original display data remains intact.

---

## ER. Localization resources must be separated from code

Do not scatter `if Spanish...` through JSX. Use centralized message catalogs/resources. This makes translation, review, QA, and fallback manageable.

---

## ES. Common terminology needs a localization glossary

For Transovo, define canonical concepts: Appointment, Booking type, Booking page, Contact, Reminder sequence, Workflow, Meeting, Payment, Availability, Waitlist, Recall.

Each supported language should have approved translations. Do not let every screen translate the same domain object differently.

---

## ET. Product terminology must stay consistent within each language

If Spanish translation for Appointment is chosen as one canonical term, don't use three synonyms across Calendar, Contacts, and Analytics unless the concepts genuinely differ. This mirrors the IA consistency rule.

---

## EU. Translator notes should exist for specialized terms

Terms such as round robin, collective scheduling, reminder sequence, no-show, and waitlist may require context. Provide explanations so localization is semantic, not literal.

---

## EV. Do not expose English implementation terms because no translation exists

Bad fallback: `Flujo de trabajo webhook_action`. User-facing technical labels need approved localized copy or deliberate English product term. Internal enums remain internal.

---

## EW. Accessibility labels need localization too

`aria-label="Close"` must become localized appropriately. Common bug: visible Spanish UI with `aria-label="Close modal"`. Accessibility experience must match language.

---

## EX. Screen-reader-only text must be localized

Anything meaningful to assistive technology counts as UI copy. Do not leave hidden instructions, status announcements, or error summaries in English.

---

## EY. Alt text must be localized where meaningful

If image conveys content, use localized alt text. Decorative image remains decorative. No need to translate meaningless asset filenames.

---

## EZ. Status announcements must use current user language

Async "Saved", "Appointment created", "Sync failed" must follow locale just like visible statuses.

---

## FA. Directionality must include accessibility-hidden content too

Invisible labels and live-region text need correct language/direction metadata. Do not make screen-reader content independent from locale system.

---

## FB. Localized UI still must meet WCAG contrast/reflow requirements

Translated text cannot justify smaller font, clipping, reduced contrast, or inaccessible controls. All previous guides still apply.

---

## FC. Translation expansion must be included in responsive QA

At minimum test pseudo-localized strings that expand substantially, contain accents, and use long labels. This reveals fixed-width problems before real translations.

---

## FD. Pseudolocalization should be part of QA

Use a pseudo-locale that transforms strings to expose hard-coded English, truncation, concatenation, and layout assumptions.

Example conceptually: `[!! Crëåtë åppøïntmënt ——— !!]`

Do not ship it publicly, but use it to test i18n readiness.

---

## FE. RTL pseudo-testing should be separate

Run interface under RTL direction even before full Arabic/Hebrew translation exists. Check sidebar, drawers, tabs, forms, back arrows, calendars, tables, and modals. This catches physical-left/right assumptions.

---

## FF. Localization QA must use real target-language reviewers for important markets

Automated screenshot/string checks are useful. They cannot verify natural wording, cultural correctness, specialized scheduling terminology, or legal meaning. Use qualified review for production language launches.

---

## FG. Machine translation is not acceptance testing

A translated string existing is not evidence it is correct. Evaluate meaning, tone, terminology, truncation, and task completion.

---

## FH. Locale-sensitive tests should cover multiple categories

At least test: English U.S. (`en-US`), English non-U.S. (`en-GB`), Romance language (`es-MX` or `fr-FR`), RTL (`ar`), and CJK (e.g. `ja-JP` or `zh-Hans`). This exposes very different assumptions.

---

## FI. Test non-Latin user input end to end

Create contact, appointment, note, message, and export using non-Latin names/content. Verify database, search, UI, API, export, and message runtime all preserve it.

---

## FJ. Test combining characters and emoji where allowed

Especially names, messages, and notes. Verify rendering, truncation, search, and storage. No corruption.

---

## FK. Test long translations in compact components

Highest risk: sidebar, tabs, table headers, buttons, badges, modal actions, filter chips. Do not test only paragraphs.

---

## FL. Test mixed LTR/RTL data

Example: Arabic customer name + English email + phone number. Verify row alignment, copying, reading order, detail page, and messages. This is real-world bidi behavior.

---

## FM. Test browser locale independent of timezone

Examples: Locale `es-MX`, Timezone `America/New_York` and Locale `en-US`, Timezone `Europe/London` to ensure locale and timezone aren't accidentally tied.

---

## FN. Test explicit user locale overrides

Browser English, user setting Spanish — app should remain Spanish. Do not re-detect on every load and overwrite preference.

---

## FO. Test fallback behavior deliberately

Remove one translation key. Ensure approved fallback appears, no raw key, no crash — and development diagnostics identify missing translation.

---

## FP. Test server-generated content independently of browser

Background worker should produce correct localized SMS, email, and report without a browser/user session supplying locale.

---

## FQ. Localized runtime must remain deterministic

Same locale + message key + variables should yield predictable output for the deployed translation version. Do not depend on live external AI translation.

---

## FR. Translation versions should be deployable/auditable

For high-risk copy, especially consent, security, and payments, know which translation/version was active. This matters when exact wording has consequences.

---

## FS. Internationalization must be centralized

**Cursor rule:** All locale resolution, message lookup, pluralization, date/number formatting, directionality, and fallback behavior must flow through shared infrastructure. Do not implement page-specific localization systems. One architecture.

---

## FT. Localization must not duplicate business logic

Do not create English booking flow and Spanish booking flow as separate code paths. Use one booking engine + localized presentation. Otherwise logic will diverge.

---

## FU. Same canonical object model across languages

English "Appointment" and Spanish translated equivalent share the same `appointment_id`, `appointment.status`, and `appointment.start`. No duplicate localized domain models.

---

## FV. Locale change should not mutate underlying data

Switching English → Arabic changes labels, direction, and formatting. It must not change appointment instant, payment amount, contact phone, consent state, or workflow. Presentation only.

---

## FW. Internationalization errors are production defects

Examples: untranslated raw key, clipped translated button, corrupted customer name, wrong RTL order, wrong decimal parsing, broken Unicode SMS, English-only screen-reader label.

These should be treated as defects, not cosmetic polish.

---

## Transovo Internationalization & Localization Acceptance Checklist

Every applicable feature should pass:

- [ ] All user-facing text is Unicode-safe
- [ ] UTF-8 used for normal web/API/text interchange
- [ ] Names are not restricted to ASCII/English alphabet
- [ ] Name model does not assume one universal Western naming structure
- [ ] Language, locale, region, script, timezone, and currency are modeled separately
- [ ] Locale/language identifiers use valid BCP 47 tags
- [ ] Primary page language is declared programmatically
- [ ] Meaningful language changes are marked where appropriate
- [ ] Locale behavior uses CLDR-backed platform APIs
- [ ] Dates/times use locale-aware formatting
- [ ] Numbers use locale-aware formatting
- [ ] Currency uses explicit currency metadata
- [ ] Decimal/group separators are not assumed to be U.S.-style
- [ ] Percent/list formatting is locale-aware
- [ ] Pluralization uses real plural rules, not count===1 logic
- [ ] Full messages are translation units rather than concatenated English fragments
- [ ] Variables can be reordered by translations
- [ ] Translation keys are semantic and stable
- [ ] Ambiguous terms include translator context
- [ ] Missing-translation fallback is centralized
- [ ] Missing translations are detectable in development/QA
- [ ] Explicit user locale overrides auto-detection
- [ ] Workspace/user/customer-facing language preferences are not conflated
- [ ] Background jobs receive explicit locale context
- [ ] Server-generated email/SMS/PDF content is localized independently of browser state
- [ ] Layout survives significant text expansion
- [ ] Buttons/navigation/form labels/error messages can wrap or expand safely
- [ ] UI text is not embedded in images without localization strategy
- [ ] RTL is supported using standards-based directionality
- [ ] HTML dir is used appropriately
- [ ] CSS logical properties are preferred for directional reusable UI
- [ ] Directional icons mirror only when semantically appropriate
- [ ] Logos/non-directional assets do not mirror
- [ ] Mixed RTL/LTR content is isolated correctly
- [ ] Strings are never manually reversed
- [ ] Unicode normalization is considered for search/comparison
- [ ] Locale-aware casing/collation used where human-facing behavior requires it
- [ ] Search can handle diacritics appropriately
- [ ] Security sanitization does not strip legitimate foreign characters
- [ ] International phone numbers are not restricted to U.S. patterns
- [ ] Postal/address schemas do not assume U.S. structure globally
- [ ] Country identity uses standardized codes/data where applicable
- [ ] Translated enum labels remain separate from canonical backend values
- [ ] Internal routes/IDs/API keys are not localized accidentally
- [ ] Template variables remain stable across translations
- [ ] Translation validation detects missing required variables
- [ ] SMS segment/encoding calculations use actual localized text
- [ ] Unicode truncation respects grapheme clusters
- [ ] Font fallbacks support intended scripts
- [ ] Fixed-height typography does not clip non-Latin scripts
- [ ] Global uppercase/letter-spacing assumptions do not break scripts
- [ ] Production translation is managed/versioned, not generated live by an LLM
- [ ] High-risk legal/security/payment copy receives reviewed translations
- [ ] Backend errors use stable codes rather than English-only logic
- [ ] Accessibility labels, live regions, alt text, and hidden text are localized
- [ ] Pseudolocalization testing exists
- [ ] RTL testing exists
- [ ] Real target-language QA exists for supported production languages
- [ ] Non-Latin data survives create/search/display/export/send workflows
- [ ] Mixed LTR/RTL records are tested
- [ ] Locale and timezone independence is tested
- [ ] Fallback behavior is tested
- [ ] Server/background localization is tested
- [ ] One localization infrastructure serves the whole product
- [ ] Localized experiences use the same underlying business logic and object model

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → i18n/l10n (this file)
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #11: Internationalization & Localization Standards. All 12 implementation standards guides in the Transovo series are now complete.*
