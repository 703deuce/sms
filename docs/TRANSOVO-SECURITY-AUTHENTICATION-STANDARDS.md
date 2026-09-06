# Transovo Security & Authentication UX Standards Guide

**Series:** Implementation standards · **Guide #9 of 12**  
**Status:** Active — mandatory hard standard for login, passwords, MFA, passkeys, sessions, reauthentication, account recovery, and security-sensitive account actions  
**Audience:** Engineers, designers, product owners, security stakeholders, and Cursor agents building Transovo  
**Authorities:** NIST SP 800-63-4 · NIST SP 800-63B-4 · W3C Web Authentication (WebAuthn) · FIDO/passkey architecture

---

## Master Cursor rule

> **Transovo authentication and account-security behavior must follow current NIST SP 800-63-4 and SP 800-63B-4 principles, with WebAuthn used for standards-based passkeys and phishing-resistant authentication.** Security controls must be risk-based, deterministic, server-enforced, and designed so the secure path is also the normal usable path. If passwords are supported, follow current NIST guidance: require appropriate minimum length, permit at least 64 characters, do not impose arbitrary character-composition rules or periodic rotation, screen against common/compromised passwords, support password managers/autofill/paste, and securely salt/hash stored passwords. Do not use security questions or password hints. Offer true MFA with distinct factors and prefer phishing-resistant methods such as passkeys/WebAuthn. Authenticator enrollment, removal, account recovery, role escalation, ownership changes, SSO configuration, and other sensitive actions must receive appropriate reauthentication, notification, authorization, and audit controls. Sessions must use protected server-generated secrets, enforce expiration/revocation, terminate on logout, and preserve user context during legitimate reauthentication. **Authentication never substitutes for authorization;** every tenant and privileged server operation must independently enforce authorization. Tokens, passwords, recovery codes, OTPs, API keys, session credentials, and refresh tokens are secrets and must never be exposed in URLs, UI, logs, analytics, or AI prompts. Security checks fail closed, and no development, support, or alternate route may bypass the canonical authentication and authorization layer.

**This guide controls how Transovo handles login, passwords, MFA, passkeys, sessions, reauthentication, account recovery, authenticator changes, suspicious activity, and security-sensitive account actions.**

---

## Core principle

Security UX must make the **secure path the easiest normal path**. Do not rely on user inconvenience, arbitrary complexity, or hidden security behavior as substitutes for strong authentication architecture.

For Transovo, treat **phishing-resistant authentication, strong session management, safe recovery, and explicit protection of sensitive actions** as the architectural goals.

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- **Next:** Guide #4 — Interaction, Keyboard & Focus Standards (coming) · Guide #11 — Internationalization & Localization Standards (coming)

---

## A. Authentication assurance should be based on risk

NIST defines three Authentication Assurance Levels:

| Level | Meaning |
|-------|---------|
| **AAL1** | Basic confidence that the claimant controls an authenticator |
| **AAL2** | High confidence; requires proof of two distinct authentication factors |
| **AAL3** | Very high confidence with stricter hardware and phishing-resistant requirements |

**Cursor rule:** Do not apply identical authentication requirements blindly to every action. Authentication strength should reflect account and action risk.

**Higher-risk Transovo actions:** changing authentication methods, disabling MFA, changing owner/admin role, SAML/SCIM configuration, exporting large customer data, deleting organization, changing payment/security settings, viewing/revealing sensitive secrets, changing recovery information.

---

## B. Offer phishing-resistant authentication

Current NIST guidance says that at AAL2, verifiers must offer at least one phishing-resistant authentication option and should encourage its use whenever practical.

For Transovo, the long-term preferred hierarchy should include **Passkeys / WebAuthn** ahead of weaker factors where practical.

**Cursor rule:** Transovo should support a phishing-resistant authentication method for higher-security accounts and should prefer it over OTP-only designs when practical.

---

## C. Passkeys should be treated as a first-class authentication method

WebAuthn defines a public-key credential model in which credentials are scoped to the relying party and authentication uses cryptographic proof instead of transmitting a reusable password secret.

NIST has incorporated syncable authenticators/passkeys into its current digital-identity framework.

**Cursor rule:** Do not treat passkeys as a decorative beta login option. Architect authenticator storage, recovery, account settings, and session flows so passkeys can be a primary authentication mechanism.

---

## D. Passkeys must use real WebAuthn

Do not invent proprietary “Transovo passkey” logic. Use the W3C WebAuthn standard. Server verifies cryptographic assertions. Client/browser interacts with authenticators through WebAuthn.

Never emulate a passkey with emailed codes, device fingerprint, or magic database token and label it a passkey.

---

## E. Authentication factors must actually be distinct

NIST identifies something you know, something you have, and something you are as core factor categories. Two instances of the same category are not two factors.

**Example:** Password + security question = two knowledge secrets ≠ legitimate two-factor authentication.

**Cursor rule:** Never advertise two knowledge factors as MFA.

---

## F. Password + email password is not necessarily meaningful independent MFA

If a user authenticates with a password then receives a code through an account whose access is effectively controlled by the same compromised environment, security may be weaker than the interface suggests.

Prefer authenticator methods with actual factor separation. Do not use misleading **Maximum security** language based solely on two screens appearing.

---

## G. Passwords are not phishing-resistant

NIST explicitly states passwords are not phishing-resistant.

Do not present **Strong 25-character password** as equivalent to phishing-resistant authentication. Password strength and phishing resistance solve different threats.

---

## H. Password minimums should follow current NIST guidance

Current NIST SP 800-63B-4 says:

- password used as a single authentication factor: minimum **15 characters**
- password used only as part of multi-factor authentication: may be shorter, but minimum **8 characters**
- systems should permit a maximum length of at least **64 characters**

**Cursor rule:** If Transovo uses passwords, implement current NIST length requirements appropriate to the authentication model instead of outdated 8-character-only assumptions.

---

## I. Do not require arbitrary password composition rules

NIST explicitly says password systems shall not require rules such as mandatory mixtures of uppercase, lowercase, number, symbol.

**Cursor rule:** Prefer length + compromised/common-password screening + rate limiting over arbitrary composition rules.

---

## J. Do not force periodic password changes

NIST explicitly says verifiers shall not require periodic password changes unless there is evidence the authenticator has been compromised.

No **Your password is 90 days old. Change it.** unless a specific security reason exists.

---

## K. Screen passwords against common and compromised values

NIST requires prospective passwords to be compared against a blocklist containing common, expected, or compromised passwords.

If blocked, tell the user why: **This password is commonly used or has appeared in known compromised-password lists. Choose another password.** — Not **Password does not meet complexity rules.**

---

## L. Do not overdo password blocklists

NIST specifically notes that excessively large blocklists provide limited additional benefit and may frustrate legitimate users.

Block probable/common compromises — not every dictionary phrase merely because it contains an English word.

---

## M. Allow long passphrases

NIST recommends allowing at least 64 characters and supporting long passwords/passphrases.

Do not silently truncate input at 16, 20, or 32 characters.

---

## N. Accept spaces and broad character sets

Current NIST guidance says password systems should accept printable ASCII, space, and Unicode where supported.

**Cursor rule:** Do not reject safe special characters because application code or database handling is poorly designed. Fix storage/encoding.

---

## O. Do not silently truncate passwords

NIST requires verification of the entire submitted password, not a truncated subset.

**Hard rule:** Never accept a 40-character password but store/compare only the first 20 characters.

---

## P. Password managers must be supported

NIST requires verifiers to allow password managers and autofill. It also recommends permitting paste where autofill APIs are unavailable.

**Cursor rule:** Never disable password-manager autofill or clipboard paste in password fields without an extraordinary documented reason. No `onPaste={preventDefault}` for passwords.

---

## Q. Password fields should offer Show password

NIST recommends an option to display the password while entering it so users can verify their input.

Use **Show password** with accessible state.

---

## R. Do not use password hints

NIST prohibits storing password hints accessible to unauthenticated claimants.

No **Hint: dog’s name + birth year.** Security questions/hints create unnecessary attack surface.

---

## S. Do not use security questions / knowledge-based authentication

Current NIST explicitly prohibits prompting users to use knowledge-based authentication such as **What was the name of your first pet?** as part of password/authentication design.

**Cursor rule:** Transovo must not use security questions for login or account recovery.

---

## T. Passwords must be securely stored

NIST requires centrally verified passwords to be salted, hashed, stored using an appropriate password hashing scheme resistant to offline attacks, and configured with an appropriate cost factor.

**Cursor rule:** Never store plaintext passwords, reversible encrypted passwords, or unsalted fast hashes.

---

## U. “Forgot password” must reset, never reveal

Do not email the user’s existing password. The product must create/bind a new authenticator/password after proper recovery. Passwords are never recoverable plaintext.

---

## V. Authentication attempts must be rate-limited

NIST requires effective rate limiting against failed authentication attempts.

**Cursor rule:** Every online authentication endpoint must implement server-side throttling/rate limiting — password login, OTP, recovery codes, authenticator activation where applicable. UI delays alone are not security.

---

## W. Rate limiting must resist brute force without making account-lockout attacks trivial

Do not simply lock account forever after 3 failures. An attacker could deny service to arbitrary users.

Use controlled throttling/backoff/risk controls. UX must clearly explain when retries are temporarily limited.

---

## X. Do not reveal whether an account exists unnecessarily

**Bad:** No account exists for anthony@example.com.

**Safer:** If an account exists for that email, we’ll send recovery instructions.

Authenticated/admin contexts may appropriately reveal account existence where necessary.

---

## Y. Login errors should not reveal excessive authentication detail

**Bad:** Email correct, password wrong.

**Potentially safer:** Email or password is incorrect.

Don’t reveal MFA method details, recovery addresses, or account state to unauthenticated attackers unnecessarily.

---

## Z. Security messaging must still be useful

Enumeration resistance does not mean **Error 403.**

**Good:** We couldn’t sign you in with those credentials.

The user can recover without the system giving an attacker unnecessary account intelligence.

---

## AA. MFA should be encouraged for user accounts

NIST says AAL1 systems should make MFA options available and encourage their use; AAL2 requires two distinct factors.

For a business SaaS storing customer data, messages, calendars, payments, and transcripts — Transovo should strongly support MFA. For organization owners and administrators, consider MFA a strong product/security requirement.

---

## AB. Prefer phishing-resistant MFA over OTP where practical

At AAL2, NIST requires at least one phishing-resistant option to be available and encourages its use.

Hierarchy should lean toward:

1. Passkey/WebAuthn
2. hardware security key/WebAuthn
3. authenticator app/TOTP
4. weaker fallback methods where justified

Do not promote SMS OTP as the strongest method.

---

## AC. SMS/voice OTP should be treated as weaker authentication

Phone-based out-of-band authentication has risks such as SIM swaps, interception, number reassignment.

NIST allows certain PSTN out-of-band mechanisms under defined conditions, but it is not phishing-resistant.

**Cursor rule:** If SMS-based MFA exists as a fallback, do not label it “most secure.”

---

## AD. Push approval must resist authentication fatigue

NIST specifically identifies authentication fatigue as a threat and recommends mechanisms that require transfer/entry of an authentication secret rather than blind approval.

Avoid **Approve? Yes/No** push spam where attackers can repeatedly prompt until user gives in.

---

## AE. MFA prompts need context

Show enough information for a user to decide whether authentication is legitimate.

**Example:** Sign-in to Transovo · Chrome on Windows · Approximate location if safely available · Time

Not merely **Approve login?** with no context.

---

## AF. Do not expose precise location unnecessarily

Security context might display **Woodbridge, Virginia area** rather than an exact coordinate/address.

Session/security telemetry itself has privacy implications; NIST explicitly notes this for session monitoring.

---

## AG. Users should be able to register more than one authenticator

NIST’s identity-proofing guidance recommends encouraging users to bind at least two distinct means of authentication to reduce recovery risk.

Security settings should support passkey on phone, passkey on another device, security key, TOTP backup where offered, recovery codes.

---

## AH. Adding a new authenticator is a high-risk event

Do not let an authenticated session silently add a new passkey without appropriate recent authentication.

Require authentication/reauthentication according to risk. Then notify the user.

---

## AI. Removing an authenticator also deserves protection

Removing passkey, disabling TOTP, or removing security key should require sufficient authentication when necessary.

Do not let someone who stole an unattended browser session remove every legitimate authenticator without challenge.

---

## AJ. Do not let users accidentally remove their last recovery path

If possible: **You’re about to remove your only remaining authentication method.**

Require adding another method first or make consequence extremely clear.

---

## AK. Authenticator changes should generate security notifications

Notify for events such as: new passkey added, recovery performed, MFA disabled, password changed, recovery email/phone changed, potentially significant SSO/security changes.

Notifications should contain what happened, when, and how to respond if unauthorized.

---

## AL. Notifications must not include authentication secrets

**Good:** A new passkey was added to your account.

**Bad:** Here’s your secret recovery token.

Keep notification and authentication channels conceptually separate.

---

## AM. Account recovery is part of the authentication system

NIST explicitly treats account recovery as a defined authenticator-management event, not a random support shortcut.

**Cursor rule:** Account recovery must have a documented threat model and must not become easier to attack than normal login.

---

## AN. Recovery must not rely on security questions

No mother’s maiden name, childhood street, or first pet. Current NIST guidance rejects KBA/security questions in authentication design.

---

## AO. Recovery codes must be high-entropy and single-use where applicable

NIST’s current recovery guidance defines saved recovery-code requirements and says used codes must be invalidated/replaced.

**Cursor rule:** Recovery codes are credentials. Store them securely, rate-limit their verification, and invalidate them after use according to the chosen recovery architecture.

---

## AP. Recovery codes must not be shown casually after enrollment

When initially generated: **Save these recovery codes somewhere safe.**

Thereafter: do not display existing plaintext codes from storage; generate replacements if needed.

---

## AQ. Regenerating recovery codes invalidates previous codes

Make this consequence explicit: **Generate new recovery codes? Your existing recovery codes will stop working.**

---

## AR. Account recovery must generate a notification

**Example:** Your Transovo account was recovered at 2:14 PM. If this wasn’t you, contact support immediately and secure your account.

---

## AS. Recovery notification must explain repudiation

Include **If you didn’t do this…** and a secure recovery response path — not merely **Account recovered.**

---

## AT. Password reset links/codes must expire

Recovery artifacts should be time-limited, single-use, securely random, and rate-limited.

Do not create permanent password-reset URLs.

---

## AU. Do not put reusable authentication secrets in URLs where avoidable

URLs leak through browser history, logs, referrers, screenshots.

Recovery tokens may need URLs operationally, but design them as random, time-limited, single-use, invalidated after redemption.

---

## AV. Changing recovery addresses is a sensitive action

If an attacker controls a session, changing recovery email or recovery phone could give them future account control.

Require recent authentication and notify the previous channels where appropriate.

---

## AW. Existing recovery channels should receive change notifications

**Example:** Your recovery email was changed from a•••@example.com to b•••@example.com.

Do not only notify the newly added address.

---

## AX. Session security is part of authentication

NIST says session management is preferable to continually asking users to resubmit credentials, but authenticated sessions require lifecycle controls.

**Cursor rule:** Authentication does not end when login succeeds. Session creation, storage, renewal, expiration, and termination are security-critical.

---

## AY. Session secrets must be generated after authentication

NIST requires session-binding secrets to be generated by the session host in direct response to successful authentication.

Do not reuse password, OAuth access token, or predictable user ID as the application session identifier.

---

## AZ. Session cookies must be securely configured

For browser sessions, use appropriate protections: Secure, HttpOnly, appropriate SameSite, high-entropy session identifiers, server-side invalidation strategy.

Do not expose session tokens to browser JavaScript unnecessarily.

---

## BA. Session tokens must not appear in URLs

Never put authenticated session credentials in page URLs or query parameters.

Use secure cookie/header mechanisms.

---

## BB. Logout must terminate the relevant session

Logout is not hide dashboard and navigate to login. Server/session state must become unusable.

**Cursor rule:** A logged-out session token must not continue to authorize API requests.

---

## BC. “Log out all devices” must actually invalidate all relevant sessions

If Transovo offers **Log out all other sessions**, backend must revoke/terminate them — not merely remove rows from a UI list.

---

## BD. Users should be able to inspect active sessions where feasible

A premium SaaS security area can show current session, Chrome · Windows, Woodbridge VA area, Active now — with Sign out.

This supports detection and control of account compromise.

---

## BE. Never display raw session tokens

Session management UI may display device/browser, approximate location, created/last used.

Never session secret, bearer token, or cookie content.

---

## BF. Reauthentication is required periodically according to assurance/risk

Current NIST guidance distinguishes overall session timeout, inactivity timeout, and reauthentication.

For AAL2, NIST recommends overall reauthentication timeout no more than 24 hours and inactivity timeout no more than 1 hour.

For AAL1, overall timeout should generally be no more than 30 days; inactivity timeout is optional.

**Cursor rule:** Define and document Transovo’s session assurance level and timeout policy rather than using arbitrary “remember me forever” behavior.

---

## BG. High-risk actions can require recent reauthentication even during an active session

Examples: change password, add passkey, disable MFA, delete organization, export all customer data, change SSO configuration.

Even if session is still valid, request recent proof where risk justifies it.

---

## BH. Reauthentication should preserve user context

If security requires reauthentication during **Change organization owner** flow: authenticate, then return directly to the pending action.

Do not dump the user on Home and make them start over.

---

## BI. Session-expiration warnings should be meaningful

**Good:** Your session will expire soon due to inactivity. **Continue session**

Do not surprise a user filling a long configuration form by silently discarding it.

---

## BJ. Session timeout must not destroy unsaved work unnecessarily

Security requires authentication state to end. It does not require destroy every unsaved field.

Where feasible: preserve safe local draft, reauthenticate, restore task.

---

## BK. “Remember this device” must not mean bypass authentication indefinitely

NIST explicitly says remember-browser mechanisms must not substitute for required authentication outside defined reauthentication allowances.

---

## BL. Session monitoring must be risk-based and privacy-aware

NIST allows session monitoring based on timing, device/browser characteristics, geolocation, IP reputation, usage patterns — but explicitly notes privacy implications.

**Cursor rule:** Do not silently collect extensive behavioral/security telemetry merely because it might detect fraud. Apply privacy minimization.

---

## BM. Suspicious sessions should trigger proportionate action

Possible responses: require reauthentication, terminate session, notify user, flag for review.

Do not automatically delete account or block legitimate user based on one weak signal.

---

## BN. Never use IP address alone as identity

IP addresses can change, be shared, route through VPNs, represent mobile carriers.

Use as a risk signal, not proof of user identity.

---

## BO. Device fingerprinting must not become invisible authentication

Device/browser characteristics can aid risk detection. They should not silently become the sole authenticator for high-risk access.

---

## BP. SSO does not eliminate local session responsibility

NIST notes that IdP and relying-party sessions are separate; expiration at one does not automatically terminate the other.

Transovo must still enforce its own session lifetime, logout, reauthentication, and authorization.

---

## BQ. OAuth login and OAuth integration authorization are different

**Sign in with Microsoft** authenticates the user.

**Connect Microsoft Calendar** authorizes access to calendar resources.

Those should not be conflated.

**Cursor rule:** Identity authentication and integration authorization are separate security domains.

---

## BR. OAuth state and PKCE protections must be used where applicable

Authorization flows must protect against CSRF, code interception, response mix-up.

Use standard OAuth/OIDC security mechanisms: state, PKCE where applicable, exact redirect URI validation, nonce for OIDC where appropriate.

---

## BS. OAuth tokens must not be exposed to client UI unnecessarily

Access/refresh tokens are credentials. Do not put them in DOM, query string, localStorage unnecessarily, logs, or error messages.

Store according to secure server-side architecture whenever possible.

---

## BT. Refresh tokens require stronger protection than ordinary UI state

A refresh token can permit long-lived access to external resources.

Encrypt/protect stored refresh tokens and restrict access.

Do not expose **View Microsoft refresh token** to normal admin users.

---

## BU. Integration disconnect must revoke/clear credentials appropriately

Clicking **Disconnect Microsoft** must stop Transovo from using that authorization.

Remove/revoke credentials according to provider capability and product behavior.

---

## BV. Authentication state and authorization state are different

Authentication answers **Who are you?** Authorization answers **What are you permitted to do?**

**Cursor rule:** Never use successful login as sufficient authorization for tenant/admin actions.

---

## BW. Authorization must be enforced server-side

Hiding **Delete organization** button from staff is not security. Backend must reject the operation.

UI role visibility improves UX. Server authorization provides security.

---

## BX. Every tenant-scoped operation must enforce tenant ownership/access

Contacts, appointments, calendars, meetings, recordings, payments, workflows, credentials must be authorization-scoped.

Never trust `tenantId` supplied by client without verifying membership/permission server-side.

---

## BY. Never expose sensitive administrative actions based solely on frontend role state

Frontend `user.role === "admin"` can improve display. But API must independently verify role.

---

## BZ. Principle of least privilege should guide roles

Users should receive only access needed for their work.

Staff may need appointments, contacts, messages — but not necessarily billing, SAML, compliance registration, organization deletion.

---

## CA. Permission changes are security-sensitive

Changing Staff → Admin should require authorized actor, clear scope, audit event, perhaps recent authentication depending on risk.

---

## CB. Ownership transfer needs extra safeguards

Transferring organization ownership can affect billing, data, security, integrations, team management.

Require explicit confirmation and strong authentication.

Display **Transfer ownership to Sarah Smith?** — not **Change role?**

---

## CC. Security settings must state effective scope

**Example:** Require MFA for administrators — should clearly mean which roles, when enforcement begins, what happens to admins not yet enrolled.

---

## CD. Enforcing MFA should include an enrollment path

If admin enables **Require MFA for all staff**, do not instantly lock everyone out without warning/transition unless intended.

Show users affected, enforcement date/state, enrollment requirement.

---

## CE. SAML/SSO enablement must include safe fallback planning

Misconfigured SAML can lock the entire organization out.

Before enforcing SSO: verify configuration, test login, preserve emergency recovery/owner path according to policy, warn before enforcement.

---

## CF. SSO domain verification must not trust arbitrary domain text

If Transovo supports domain-based SSO, verify ownership appropriately.

Do not let an organization claim `microsoft.com` and intercept logins.

---

## CG. SCIM provisioning actions must be authenticated and authorized

SCIM tokens are security-sensitive credentials. They must be high entropy, scoped, revocable, not exposed after initial creation where avoidable.

Never display a saved SCIM bearer token forever in plaintext.

---

## CH. API keys/secrets should use reveal-once patterns where appropriate

Preferred pattern: **Created successfully. Copy this secret now; it will not be shown again.**

Store hashed or otherwise appropriately protected depending on verification requirements.

---

## CI. Secret rotation must be supported

For API/webhook credentials: allow generate new, overlap briefly if architecture needs zero-downtime transition, revoke old.

---

## CJ. Security-sensitive credentials should never appear in application logs

Do not log passwords, passkey private material, access tokens, refresh tokens, session IDs, recovery codes, API keys.

---

## CK. Secrets should not appear in analytics/telemetry

Don’t accidentally send auth tokens, email magic links, or password fields to client analytics, error reporting, replay tools, or session-recording products.

---

## CL. CSRF protections must exist for cookie-authenticated state-changing actions

If auth uses cookies, state-changing requests must be protected using appropriate SameSite strategy and CSRF token/origin checks as required by architecture.

---

## CM. Sensitive actions should not be available through GET requests

Never `/delete-account?id=123` where merely visiting the URL performs deletion.

Use proper authenticated state-changing methods with CSRF protection.

---

## CN. XSS can defeat authentication UX

Even excellent sessions/passkeys are compromised if hostile scripts can steal or act within authenticated context.

Use output encoding, safe frameworks, CSP where appropriate, avoid unsafe HTML injection.

---

## CO. Do not put secrets into client-visible environment variables

Any client-bundled environment variable is visible to users. Provider/server secrets remain server-side.

---

## CP. Login form must support password managers and accessibility

Security cannot come at the cost of disabling paste, blocking autofill, inaccessible CAPTCHA, or keyboard-hostile MFA.

NIST explicitly emphasizes password-manager support; WCAG accessible-authentication rules cover cognitive barriers.

---

## CQ. Do not use puzzle-based security that harms accessibility

Avoid authentication requiring remembering arbitrary strings, solving visual puzzles, or transcribing distorted images unless accessible alternatives satisfy requirements.

---

## CR. Magic links are credentials

If Transovo uses email magic links: high entropy, expire, single-use or appropriately constrained, bound to intended action/context, invalidate safely.

---

## CS. OTP codes must expire and be rate-limited

One-time codes should have finite lifetime, reject excessive guesses, be invalidated after successful use, not be indefinitely reusable.

---

## CT. Do not reset OTP validity indefinitely on every resend without design

Define latest code behavior, resend throttling, expiry.

Clearly tell users: **We sent a new code.**

---

## CU. Never display OTP/recovery secrets in logs or error messages

No **OTP validation failed for code 483921.** Sensitive values must be redacted.

---

## CV. Biometric data should not be collected by Transovo for passkey authentication

With WebAuthn/passkeys, biometric verification normally occurs locally through the authenticator/device.

Transovo should receive cryptographic authentication results, not fingerprints, Face ID image, or raw biometric template.

**Cursor rule:** Do not describe passkey authentication as Transovo storing a user’s fingerprint or face.

---

## CW. Passkey labels should be user-understandable

Security settings might say **Passkeys** and explain: Sign in using Face ID, Touch ID, Windows Hello, your device PIN, or a security key depending on your device.

Do not lead with **FIDO2 discoverable public-key credential.**

---

## CX. Users should be able to identify registered passkeys

Show useful metadata: iPhone passkey · Added Sep 5 · Windows laptop · Added Aug 21.

Allow Rename and Remove where appropriate. Do not display raw credential IDs as primary labels.

---

## CY. Authenticator names should not be trusted security evidence

If user renames passkey **My secure laptop**, that’s display text. It does not prove device security.

---

## CZ. Security event history should be available where useful

Potential events: sign-in, new authenticator, password change, recovery, security setting change, admin role change, SSO enforcement.

Don’t expose secrets.

---

## DA. Security event timestamps should be accurate and timezone-aware

Display **Sep 8, 2026 · 2:14 PM EDT** or workspace/user timezone with context.

---

## DB. Security alerts must avoid phishing themselves

Prefer directing users to **Open Transovo and review Security** when possible.

If links are used, make destination and purpose clear.

---

## DC. Never ask users to send credentials to support

Support should never ask for password, OTP, recovery code, passkey secret, or API token.

Reinforce: **Transovo support will never ask for your password or authentication code.**

---

## DD. Support-assisted recovery needs strong controls

If human support can reset access, the support process becomes an authenticator.

It requires documented identity verification, audit trail, limited permissions, notifications, strong operator authentication.

---

## DE. Admin impersonation needs explicit safeguards if ever supported

If support/admin can **View as user**: permission restricted, clearly labeled impersonation state, audit logged, sensitive actions restricted where appropriate, obvious exit.

Do not silently log employees into customer accounts.

---

## DF. Security controls should fail closed

If authorization service is unavailable, do not assume allow.

If session validation fails, do not assume valid.

If tenant membership cannot be verified, block sensitive access.

**Cursor rule:** Security checks default to denial on uncertainty unless an explicitly designed safe-degraded behavior exists.

---

## DG. Authentication-provider failure must not create a bypass

If Google login is down, do not create temporary password = user’s email to let people in.

Fallback authentication methods must already be secure and bound to the account.

---

## DH. Do not create hidden universal backdoors

No hard-coded admin password, magic support login, secret query parameter, or shared master OTP.

Every privileged access path must have normal authentication, authorization, and audit controls.

---

## DI. Test environments must not silently trust production identity

Test mode should be isolated.

Never implement `if NODE_ENV !== production: skipAuth()` in a manner that can be accidentally deployed.

---

## DJ. Production auth behavior must not be weakened to facilitate UI development

Cursor must never disable authentication, permission checks, CSRF, or token validation just to make a page easier to preview.

---

## DK. Authentication state must not rely solely on client state

Never trust `localStorage.isAdmin = true` or `isLoggedIn = true` as security evidence.

Server-side session/token verification remains authoritative.

---

## DL. JWT validation must be complete if JWTs are used

Validate signature, issuer, audience, expiration, relevant claims.

Do not merely Base64-decode JWT contents and trust them.

---

## DM. Algorithm choices must not be accepted from untrusted tokens blindly

JWT verification must use configured expected algorithms.

Do not permit `alg = none` or algorithm confusion.

---

## DN. Token expiration must be enforced server-side

UI countdown is not security. Expired token/session must fail authorization even if the page still visually appears logged in.

---

## DO. Token refresh must be controlled

Refresh mechanisms should validate refresh credential, rotate where architecture requires, invalidate compromised/revoked credentials, not create unlimited immortal sessions.

---

## DP. Changing password should invalidate appropriate sessions according to policy

If password compromise is suspected and user changes password, consider terminating other sessions/credentials as policy dictates.

At minimum offer **Sign out other devices.**

---

## DQ. Compromised authenticator should trigger replacement, not routine rotation

Do not rotate passwords arbitrarily. Force replacement/change when evidence indicates compromise.

Security action should be event/risk driven.

---

## DR. Users should be able to report “This wasn’t me”

For security notifications include recovery path: **This wasn’t me** leading into revoke session/authenticator, secure account, review activity.

---

## DS. Security controls should show current state truthfully

Examples: MFA enabled · 3 passkeys registered · SSO required for staff · Last password change Sep 1

Don’t show **Secure** as a vague green badge.

---

## DT. Avoid fake security scores unless rigorously defined

No **Security score: 93%** unless there is a transparent, meaningful methodology.

Prefer actionable controls: Add a passkey · Enable MFA for admins · Review active sessions.

---

## DU. Security setup should prioritize highest-value improvements

1. Add passkey
2. Add backup authenticator
3. Save recovery codes
4. Review active sessions

Not a 25-item checklist of cosmetic settings.

---

## DV. Sensitive action dialogs should state exactly what is happening

**Good:** Disable MFA for Anthony Johnson? Anthony will be able to sign in using only their remaining single-factor method until MFA is configured again.

Better than **Are you sure?**

---

## DW. Never ask a user to authenticate inside an untrusted embedded frame

Login/recovery/password flows should occur in controlled trusted Transovo/provider contexts.

Public Booking embeds should not become admin-login surfaces.

---

## DX. Clickjacking protections should exist on sensitive account/admin pages

Use appropriate CSP frame-ancestors / frame restrictions for administrative/authentication surfaces.

Public booking pages can have deliberately different embed policy.

---

## DY. External links from security screens should be treated carefully

If sending users to Microsoft security or Google security, make destination clear.

Do not present third-party domain as if still inside Transovo.

---

## DZ. Authentication UX must not expose whether internal staff/admin accounts exist

Public recovery/login endpoints should resist enumeration consistently.

---

## EA. Invite links are security credentials until accepted

Team invitation link can grant organization access.

Therefore: high entropy, expiration, intended recipient/context binding where appropriate, single-use, revocation.

---

## EB. Accepting a team invite must not bypass identity verification completely

Bind invite acceptance to the intended account/email/authentication policy.

---

## EC. Role granted by invite must be explicit

Invitation should state **You’ve been invited as Staff.** If invite is Admin, show that clearly.

---

## ED. Invitation revocation must actually invalidate the link

If admin clicks **Revoke invitation**, future use must fail server-side.

---

## EE. SSO and local-auth account linking must avoid account takeover

Do not automatically merge identities solely based on unverified email coincidence.

Use provider-verified identifiers and safe account-linking rules.

---

## EF. External identity identifiers should be immutable provider IDs, not display email alone

Use issuer and provider subject identifier as canonical identity mapping where protocols provide them.

Emails can change. Identity mappings should not.

---

## EG. MFA reset by administrators should be logged and notified

If organization administrator can reset staff MFA, record actor, target, time. Notify target where appropriate.

---

## EH. Audit logs must be protected from ordinary modification

A staff user should not be able to delete **Anthony made himself admin** from audit history.

---

## EI. Security event logging must not become secret logging

Record event type, actor, target, timestamp, outcome, relevant non-secret metadata. Do not record credentials.

---

## EJ. Authorization failures should be logged appropriately

Repeated attempts to access other tenant may be security-relevant.

---

## EK. Do not expose internal authorization details in user errors

**Bad:** RBAC policy deny tenant 47 scope workflow.write.

**Good:** You don’t have permission to edit this workflow.

---

## EL. Security UX must work with accessibility

Security controls must remain keyboard operable, screen-reader accessible, compatible with password managers, not dependent on memory puzzles.

Use Guide #1 and WCAG authentication rules together with NIST.

---

## EM. Security UX should reduce social engineering opportunities

For sensitive actions: clearly identify Transovo domain, don’t encourage copying OTPs into support chat, don’t teach users to approve unexplained prompts.

---

## EN. Do not normalize “share your code with us”

Never write support copy such as **Tell our agent the six-digit code we sent you.**

---

## EO. User-visible device/location security information must be qualified

Don’t claim **Login came from your iPhone** if it is only inferred from user-agent.

Use **Safari on iPhone** or **Device reported as iPhone** where appropriate.

Likewise location: **Approximate area based on IP.**

---

## EP. Suspicious login alerts should minimize false certainty

**Example:** New sign-in detected from a browser we haven’t seen before.

Better than **Hacker attempted access.**

---

## EQ. WebAuthn private keys must never be sent to Transovo

WebAuthn uses public-key credentials. The server receives public credential material/assertions; private credential keys remain with authenticator infrastructure.

**Cursor rule:** Never design or document WebAuthn as exporting/storing the user’s passkey private key on Transovo servers.

---

## ER. User verification and biometric identity are not the same thing

Transovo generally learns that the authenticator performed user verification, not which biometric trait was used.

Do not display **Face ID verified this user’s identity** unless the actual protocol/provider supports that specific assertion.

---

## ES. Passkey recovery depends on authenticator ecosystem, not Transovo knowing the secret

Syncable passkeys may be recovered/synced by platform credential providers; device-bound security keys may require another registered authenticator.

No fake **Email us your passkey.**

---

## ET. Account deletion must require strong authentication

Organization/account deletion is high consequence.

Require recent authentication, clear scope, explicit confirmation, appropriate ownership/authorization.

---

## EU. Billing/payment configuration changes may require reauthentication

Changing payout/payment provider connection, billing identity, or refund controls can have financial consequence.

Use step-up authentication based on actual risk.

---

## EV. Security policy should be centralized

Do not independently define session timeout in middleware, another timeout in frontend, MFA rules in one API, different MFA logic in Settings.

**Cursor rule:** Authentication, session, and authorization policy must have one authoritative implementation path.

---

## EW. Security decisions must be deterministic

LLMs must not decide **Is this user probably an admin?** or **Does this login look legitimate enough?**

Authentication/authorization outcomes must come from deterministic policies and authoritative signals.

---

## EX. AI must never receive secrets unnecessarily

Do not send to an LLM: passwords, refresh tokens, session cookies, recovery codes, API keys, OTPs for debugging or explanation.

---

## EY. Error reports must redact authentication secrets

Diagnostic bundle must not contain raw authorization code, access token, or refresh token.

---

## EZ. Security testing must cover bypass paths

Test: expired session, revoked session, invalid MFA, reused OTP, reused recovery code, removed user, downgraded role, cross-tenant ID substitution, forged client role, revoked invitation, stale OAuth callback, CSRF, session fixation, logout token reuse.

---

## FA. Every privileged server endpoint requires authorization tests

Test authorized role succeeds and unauthorized role fails. UI hiding is not enough.

---

## FB. Authentication changes require regression testing

Password-policy change, MFA change, passkey change — each needs enrollment, login, recovery, removal, notification test coverage.

---

## FC. Security controls must have safe migration paths

If moving users from password only to MFA required, plan enrollment, grace period if applicable, enforcement, recovery, admin/support path.

---

## FD. Never weaken existing security silently during migration

If passkey migration fails, do not quietly disable MFA for everyone.

---

## FE. Security-critical dependencies must fail predictably

If Redis/session store is unavailable, do not accidentally authenticate everyone.

**Hard rule:** Unknown authentication state = unauthenticated/denied until resolved.

---

## FF. “Connection healthy” and “authentication secure” are not interchangeable

Microsoft Calendar may be **Connected** but that says nothing about the user’s Transovo MFA.

Do not conflate integration authorization, user authentication, and account security.

---

## FG. Security state should be inspectable, not scary

Settings → Security should answer: What methods can I use to sign in? Is MFA enabled? What passkeys exist? What sessions are active? What recovery options exist? Is SSO enforced? What changed recently?

---

## FH. Security copy must distinguish requirement from recommendation

**Required:** Administrators must use MFA.

**Recommended:** Add another passkey as backup.

---

## FI. Security severity should be proportional

Critical: MFA was removed from your account.

Warning: You only have one authentication method.

Info: A new browser signed in successfully.

---

## FJ. Authentication should minimize user burden while preserving assurance

NIST’s modern guidance intentionally removes arbitrary password complexity and encourages password managers/passkeys because security and usability reinforce each other.

**Cursor rule:** Never introduce user friction unless it addresses a defined threat or assurance requirement. No security theater.

---

## Transovo Security & Authentication Acceptance Checklist

Every applicable authentication/security feature should pass:

- [ ] Current NIST SP 800-63-4 / 800-63B-4 guidance used, not superseded 2017 assumptions
- [ ] Authentication assurance/risk level explicitly considered
- [ ] Phishing-resistant authentication option supported/planned where appropriate
- [ ] Passkeys implemented through WebAuthn, not proprietary imitation
- [ ] MFA factors are genuinely distinct factors
- [ ] Passwords are not represented as phishing-resistant
- [ ] Single-factor password minimum is at least 15 characters where following NIST AAL guidance
- [ ] MFA-component passwords are at least 8 characters
- [ ] At least 64-character passwords/passphrases supported
- [ ] No mandatory uppercase/lowercase/number/symbol composition rules
- [ ] No arbitrary periodic password expiration
- [ ] Passwords checked against common/compromised blocklist
- [ ] Blocklist rejection explains the reason
- [ ] Spaces and supported character sets work correctly
- [ ] Passwords are never silently truncated
- [ ] Password managers/autofill work
- [ ] Password paste is allowed
- [ ] Show-password option exists where appropriate
- [ ] Security questions/password hints are not used
- [ ] Passwords are salted and securely hashed
- [ ] Authentication endpoints are rate-limited
- [ ] Login/recovery errors avoid unnecessary account enumeration
- [ ] MFA enrollment provides at least one strong method
- [ ] Passkey/WebAuthn is preferred over weaker OTP where appropriate
- [ ] SMS/voice OTP is not presented as phishing-resistant
- [ ] Push approval design mitigates authentication fatigue
- [ ] Authentication prompts provide enough context
- [ ] Users can maintain more than one authenticator
- [ ] Adding/removing authenticators requires appropriate reauthentication
- [ ] Users cannot casually remove their final recovery path
- [ ] Security-sensitive authenticator changes generate notifications
- [ ] Recovery uses defined secure mechanisms, not KBA
- [ ] Recovery codes are high entropy, protected, rate-limited, and single-use as applicable
- [ ] Existing recovery codes are invalidated when regenerated
- [ ] Account recovery generates security notification
- [ ] Recovery notifications include repudiation instructions
- [ ] Recovery links/codes expire
- [ ] Recovery/contact changes are protected and notified
- [ ] Sessions use strong server-generated secrets
- [ ] Session secrets are not exposed in URLs
- [ ] Cookies use appropriate Secure/HttpOnly/SameSite protections
- [ ] Logout invalidates the server-side session
- [ ] Log-out-all-devices actually revokes applicable sessions
- [ ] Session/re-authentication timeouts are documented and risk-based
- [ ] Sensitive actions can require recent step-up authentication
- [ ] Reauthentication preserves user task context
- [ ] Session-expiration UX does not unnecessarily destroy work
- [ ] Remember-device behavior does not create immortal sessions
- [ ] Session monitoring has a privacy assessment
- [ ] SSO does not bypass Transovo session/authorization policy
- [ ] Login OAuth and calendar OAuth are modeled separately
- [ ] OAuth uses state/PKCE/nonce protections where applicable
- [ ] OAuth tokens are never exposed unnecessarily to the client/logs
- [ ] Refresh tokens are strongly protected
- [ ] Disconnecting integrations actually removes/revokes usable authorization
- [ ] Authentication and authorization are separate
- [ ] Authorization enforced server-side
- [ ] Every tenant resource is tenant-authorized server-side
- [ ] Client role state is never trusted as security authority
- [ ] Least privilege used for roles
- [ ] Privilege changes are authenticated/audited
- [ ] Ownership transfer has strong safeguards
- [ ] MFA/SSO enforcement has safe enrollment/recovery path
- [ ] SAML is tested before organization-wide enforcement
- [ ] API/SCIM/webhook secrets are protected and revocable
- [ ] Secrets are never stored in frontend/public environment variables
- [ ] Secrets are redacted from logs/analytics/error reports
- [ ] CSRF protections exist for cookie-authenticated state changes
- [ ] Sensitive mutations do not use unsafe GET endpoints
- [ ] Magic links/OTPs are expiring and appropriately single-use
- [ ] Biometric data is not collected by Transovo merely to support passkeys
- [ ] Passkeys can be identified and managed by users
- [ ] Security event history is available where appropriate
- [ ] Security alerts provide actionable “this wasn't me” recovery
- [ ] Support never asks users for passwords/OTP/recovery codes
- [ ] Support-assisted recovery has strong verification/audit controls
- [ ] Security checks fail closed
- [ ] No hidden master passwords/backdoors exist
- [ ] Production authentication cannot be bypassed for UI testing
- [ ] Authentication does not rely solely on client state
- [ ] JWTs/tokens are fully validated when used
- [ ] Expiration and revocation are enforced server-side
- [ ] LLMs never make authentication/authorization decisions
- [ ] Authentication secrets are never sent to AI systems unnecessarily
- [ ] Security bypass/regression tests exist

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & auth (this file)
Guide #4 (coming)                                        → Interaction, keyboard & focus
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11+ (coming)                                      → Internationalization & localization, etc.
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #9: Security & Authentication UX Standards. Next: Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · Guide #11 — Internationalization & Localization Standards.*
