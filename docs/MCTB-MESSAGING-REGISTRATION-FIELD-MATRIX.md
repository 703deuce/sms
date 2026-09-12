# MCTB messaging registration — field matrix

Fields are owned by the **messaging registration** store and compliance portal. MCTB verification drawer **does not remove** any field; it surfaces status, required actions, and submits TFV when backend allows.

| FIELD / DATA | PROVIDER FLOW | CURRENT LOCATION | NEW STEP (drawer) | REQUIRED | VALIDATION | STATUS |
|--------------|---------------|------------------|-------------------|----------|------------|--------|
| Legal business name | 10DLC / TFV payload | `/compliance/business` | Business (link) | Yes | Server | MAPPED |
| Website URL | Brand | `/compliance/business` | Business (link) | Yes | Server | MAPPED |
| Business address | TFV / brand | `/compliance/business` | Business (link) | Yes | Server | MAPPED |
| EIN / tax ID | Brand | `/compliance/business` | Business (link) | Often | Server | MAPPED |
| Brand status | 10DLC | `/compliance/brand` | Business summary | Yes | Provider | MAPPED |
| Campaign use case | 10DLC | `/compliance/campaign` | Messaging use (link) | Yes | Server | MAPPED |
| Sample messages (2+) | Campaign | `/compliance/campaign` | Messaging use (link) | Yes | Server | MAPPED |
| Opt-in description | Campaign | `/compliance/campaign` | Messaging use (link) | Yes | Server | MAPPED |
| HELP / STOP wording | Campaign | `/compliance/campaign` | Messaging use (link) | Yes | Server | MAPPED |
| Toll-free verification payload | TFV | `buildTfvSubmissionPayload` | Review → Submit | Yes | Twilio | MAPPED |
| MCTB message template | TFV sample | MCTB config | Auto in payload | Yes | Server | MAPPED |
| Workspace toll-free phone | TFV | Provisioning | Review display | Yes | Server | MAPPED |
| TFV failure reason | Twilio | TFV record | Review (translated) | — | Provider | MAPPED |

**UNMAPPED_FIELDS: 0**

Full edit UX remains on `/compliance/*`; drawer is the **contextual entry** from MCTB setup/onboarding/test.
