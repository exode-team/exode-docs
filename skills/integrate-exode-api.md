---
name: exode-api-integration
description: Connect to the Exode SaaS REST API from scratch and make working, correct requests — obtain API credentials from the school admin panel, store them safely in env vars, set up a minimal authenticated client (Node.js/Python/cURL), run a smoke-test request and interpret the response envelope, errors, rate limits and pagination. Use when a user wants to connect to the Exode SaaS API, integrate their CRM/LMS/HR/1C or any external service with an Exode school, or as the auth foundation before any other Exode API task (importing users, exporting reports, syncing staff, setting up webhooks).
---

# Integrate with the Exode SaaS API — from zero to a working request

You are an engineer connecting a user's system to the **Exode SaaS API** for a user
who may be non-technical. Your job is to get valid credentials, a correct client
setup, and a verified first request. Other Exode skills (import-users,
export-reports, sync-staff-hr, setup-webhooks) build on this one — complete the
auth setup here first.

**Ground truth**: the docs at https://docs.exode.biz/ru/exode-api/setup. Never
invent endpoints, fields or headers — if a method is not in the docs, say so.

## First: detect where you are running

Determine your execution environment before starting and tell the user which mode
you are in:

- **Mode A — agent on the user's computer** (Claude Code, Cursor agent, any CLI
  agent with terminal access). You run every command yourself: create the env file
  in the user's project, run the smoke test with `curl` or the client script
  directly.
- **Mode B — cloud agent with its own sandbox** (claude.ai with code execution,
  hosted runners). You can run commands, but nothing persists on the user's
  machine. Run the smoke test in the sandbox to prove the credentials work, then
  hand the user the final client code and exact env-var setup instructions for
  their own environment. Never store the token anywhere that outlives the session.
- **Mode C — plain chat, no command execution.** Turn every step into exact
  copy-paste instructions — which app to open (Terminal on macOS, PowerShell on
  Windows), what to paste, and what the expected output looks like. Wait for the
  user to report each result before moving on.

If unsure, try a harmless command (`curl --version`): if it executes — Mode A or B;
if not — Mode C.

## How to behave with this user

- **Do everything yourself** whenever you can execute commands. Ask the user only
  for things that can come from them alone: the credentials and the school domain.
- **Speak the user's language** (the admin panel is in Russian — cite section names
  as they appear: «Управление → Школа → API-ключи»). Avoid jargon.
- **Never print the token back into the chat** once received — confirm you have it
  and move on. Ask the user to put it into the env file/variable themselves if you
  cannot do it without the value passing through chat.

## Step 1. Get the credentials

Three values are required for every request:

| Value | Used as | What it is |
|---|---|---|
| API token | `Authorization: Bearer <TOKEN>` header | Token of a **service user** (API client) — a school staff account with a permission set |
| Seller-Id | `Seller-Id` header | Identifier of the seller (business owner) context |
| School-Id | `School-Id` header | Identifier of the school context |

Guide the school owner click by click:

1. Open the school admin panel and go to **Управление → Школа → API-ключи**
   (URL path: `/manage/school/api-keys`).
2. Create an API key there — this creates a service user (API client) and issues
   a token. The page also shows Seller-Id and School-Id, the key list with a token
   preview (first/last 4 characters) and issue date, and a rotation action.
3. **The token is shown in full only at the moment of creation or rotation** —
   the user must save it immediately. Rotation issues a new token and revokes the
   old one instantly.
4. The token is non-expiring but revocable. It must belong to a user flagged as an
   **API client** — otherwise SaaS endpoints return an access error even with
   correct permissions.
5. The key's default permission set depends on the school segment: corporate
   schools get org-structure rights (`StaffManage`, `StaffView`); commercial
   schools get sales rights (`SellerSales`, `SellerRefunds`). The set is editable
   on the key's page. If the user cannot self-serve, support helps at
   https://t.me/exode_support_biz.

**Security (mandatory):** the token lives only in environment variables — never in
code, never in the repository, never echoed into chat. It grants access to the
school's data; never pass it to third parties.

## Step 2. Base URL and required headers

- Base URL: `https://api.exode.biz`
- All endpoints live under the `saas/v2/` prefix. Full endpoint shape:
  `https://api.exode.biz/saas/v2/<module>/<method>` — e.g.
  `https://api.exode.biz/saas/v2/user/create`.
- Every request carries three required headers:

```
Authorization: Bearer <TOKEN>
Seller-Id: <sellerId>
School-Id: <schoolId>
```

A missing/invalid `Authorization` returns `401`. `Seller-Id` and `School-Id` set
the seller/school context; protected methods return `401` without them.

## Step 3. Minimal client setup

Create an env file (never commit it; add to `.gitignore`):

```
EXODE_TOKEN=<the token>
SELLER_ID=<sellerId>
SCHOOL_ID=<schoolId>
```

Node.js (axios):

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.exode.biz/saas/v2',
  headers: {
    Authorization: `Bearer ${process.env.EXODE_TOKEN}`,
    'Seller-Id': process.env.SELLER_ID,
    'School-Id': process.env.SCHOOL_ID,
  },
});
```

Python (requests):

```python
import os, requests

session = requests.Session()
session.headers.update({
    'Authorization': f"Bearer {os.environ['EXODE_TOKEN']}",
    'Seller-Id': os.environ['SELLER_ID'],
    'School-Id': os.environ['SCHOOL_ID'],
})
BASE = 'https://api.exode.biz/saas/v2'
```

## Step 4. Smoke test — the first request

Use the safe read-only method `user/find` (lookup by `extId`, the field that links
an Exode user to a record in the external CRM/LMS):

```bash
curl --location 'https://api.exode.biz/saas/v2/user/find?extId=crm_12345' \
  --header "Authorization: Bearer $EXODE_TOKEN" \
  --header "Seller-Id: $SELLER_ID" \
  --header "School-Id: $SCHOOL_ID"
```

Interpret the result:

- `{"success": true, "code": 200, "payload": {"user": {...}}}` — credentials work
  and the user exists. Done.
- `success: true` with no matching user — credentials work; auth is proven even
  though nothing was found. Done.
- `401` / `403` / other error — see Troubleshooting below; do not proceed to any
  other Exode task until the smoke test passes.

## The response contract (apply to every request you make)

**Envelope.** Every successful response is wrapped in
`{ "success": true, "code": 2xx, "payload": <method data> }`. Always check
`success`/`code` and read data from `payload` only. Payloads strictly match the
method's documented schema — no extra fields.

**Errors.** Same envelope plus `cause` (machine-readable reason — branch on it),
`message`, `error`, and optional `data`:

```json
{ "success": false, "code": 400, "cause": "EmailIsBusy", "message": "Email is busy", "error": "Email is busy" }
```

Common `cause` codes:

| HTTP | `cause` | When |
|---|---|---|
| 400 | `validation` | Body/params failed validation (type, length, format, enum) |
| 401 | `Unauthorized` | Missing/invalid token |
| 401 | `Blocked` | The token's user is inactive or banned |
| 401 | `Forbidden` | No access to the seller/school resource (insufficient rights or the resource belongs to another school) |
| 403 | `Forbidden` | Insufficient permissions (RBAC) |
| 429 | `Rate` | Rate limit exceeded |

Method-specific causes (e.g. `UserAlreadyExist`, `EmailIsBusy`, `PhoneIsBusy`,
`TgIdIsBusy` on `user/create`) are listed on each method's docs page.

**RBAC.** Each method requires certain permissions on the token. When a method
lists several permissions, **any one of them is enough (OR semantics)**. Example
permissions: `SchoolManageUsers`, `SchoolManageSettings`, `CourseCurator`,
`CourseStudentManage`, `SellerSales`, `FormManage`.

**Rate limit.** Some methods are rate-limited per token. On excess you get HTTP
`429`, `cause: "Rate"`, and `data.retryAfter` — an ISO timestamp for when to
retry. Implement retries that honor `retryAfter`, with exponential backoff for
transient errors (`429`, `5xx`). Limits are stated on method pages (e.g. export
generation — 100 requests/hour).

**Pagination.** List methods (`.../list/raw` etc.) take query params: `take`
(page size, 1–1000, default 100), `page` (1-based; alternative to `skip`), `skip`
(offset, ignored when `page` is set). The page response inside `payload`:

```json
{ "items": [], "page": 1, "count": 245, "pages": 3, "isFirst": true, "isLast": false,
  "next": { "skip": 100, "take": 100, "page": 2 }, "prev": { "skip": 0, "take": 100, "page": 1 } }
```

Array params are passed by repeating the key (`userIds=1&userIds=2`); ranges as
nested fields (`createdAtDateRange[from]`, `createdAtDateRange[to]`).

## The data model in brief

Every request runs in the context of one **Seller** (`Seller-Id`) and one
**School** (`School-Id`):

```
Seller (business owner: balance, requisites)
├── School (domain, settings)
│   ├── User (student/curator/parent/service; extId links to your CRM/LMS)
│   └── Group ── GroupMember (user ↔ group link, access rules, schedule)
└── Product (sellable unit; prices, discounts)
    ├── Course ── CourseLesson ── practice attempts, courseProgress
    ├── ProductAccess (user's access to a product — what opens the course)
    └── Invoice (user's purchase) ── Payment (paid via acquiring)
```

Plus `formLayout`/`formFieldValue` for custom forms. Conventions: dates are ISO
8601 UTC strings (`*At` = null means "has not happened"); money fields are
numbers; most entities carry `id`, `createdAt`, `updatedAt`, `archivedAt`;
`*Id` fields reference other entities. Full entity reference:
https://docs.exode.biz/ru/exode-api/objects/entities/index.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `401` `Unauthorized` | Token missing, malformed (`Bearer ` prefix?), or revoked/rotated — re-check the env var; re-issue via **API-ключи** if rotated. |
| `401` `Blocked` | The service user behind the token is inactive or banned — reactivate it in the admin panel. |
| `401` `Forbidden` | Wrong `Seller-Id`/`School-Id` for this token, or the resource belongs to another school — re-copy both IDs from the API-keys page. |
| `401` on all SaaS endpoints despite correct rights | The token's user is not flagged as an **API client** — issue the key via Управление → Школа → API-ключи, not from a regular staff account. |
| `403` `Forbidden` | The key lacks the required permission — edit the permission set on the key's page (any one of the method's listed permissions suffices). |
| `400` `validation` | Request body/params violate the method schema — compare field names, types and enums with the method's docs page; check array/range param encoding. |
| `429` `Rate` | Rate limit hit — wait until `data.retryAfter`, add backoff; batch/paginate instead of hammering. |
| Empty-looking response | Data is inside `payload`, not at the top level — unwrap the envelope. |
| Worked yesterday, `401` today | The token was rotated (rotation revokes the old one immediately) — update the env var. |

## Final checklist

1. Token, Seller-Id and School-Id obtained from Управление → Школа → API-ключи;
   the token was saved at creation time.
2. All three values live in env vars only — not in code, repo or chat history.
3. Smoke test `user/find` returns `success: true` (Mode B: run in sandbox; Mode C:
   user confirmed the cURL output).
4. The client checks `success`/`code`, branches on `cause`, honors `retryAfter`.
5. The user knows where the full docs live: https://docs.exode.biz/ru/exode-api/setup
   (headers, errors, pagination), /ru/exode-api/quickstart, /ru/exode-api/concepts,
   /ru/exode-api/objects/entities/index — and that the other Exode skills reuse
   this auth setup.
