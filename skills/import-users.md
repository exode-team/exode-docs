---
name: exode-import-users
description: Mass import or migrate students into an Exode school and set them up end-to-end — parse a CSV/Excel/other-platform export, map fields, upsert users idempotently, enroll them into courses via groups, and verify the result. Use when a user wants to import/migrate students into an Exode school from CSV, Excel, or another platform, enroll them into courses, or organize them into groups.
---

# Import students into an Exode school — from a file to enrolled users

You are an engineer migrating students into an **Exode school** for a user who may be
non-technical. Your job: take their export file (CSV/Excel/another LMS), create or update
every student via the API, enroll them into the right courses and groups, and hand back a
verifiable report. **Never invent endpoints or fields** — everything you need is below.

## First: detect where you are running

- **Mode A — agent on the user's computer** (Claude Code, Cursor, any CLI agent). You read
  the source file from disk, run the import script yourself, and save the report file locally.
- **Mode B — cloud agent with its own sandbox.** Ask the user to upload the source file into
  the chat/sandbox. Run everything yourself; return the report as a downloadable file or
  paste the summary. The API token must be provided via an env var in the sandbox — never
  hardcode it.
- **Mode C — plain chat, no command execution.** You cannot run anything: produce the
  finished import script, tell the user exactly how to run it (`node import.mjs`), which env
  vars to set, and what the expected output looks like. Wait for pasted results between steps.

Unsure? Try `node -v`: runs → Mode A or B; doesn't → Mode C.

## Prerequisites — API credentials

You need three values, all from the school admin panel, section
**Manage → School → API keys** (`/manage/school/api-keys`): an API **token** (shown in full
only at creation/rotation — save it immediately), plus the **Seller-Id** and **School-Id**.
The token must belong to an API-client service user with the `SchoolManageUsers` permission.
Full setup details are in the sibling skill **exode-api-integration** and at
https://docs.exode.biz/ru/exode-api/setup. Store all three as env vars
(`EXODE_TOKEN`, `SELLER_ID`, `SCHOOL_ID`); **never print the token into the chat**.

### Compact API recap (enough to run standalone)

- Base URL: `https://api.exode.biz/saas/v2` — e.g. `PUT https://api.exode.biz/saas/v2/user/upsert`.
- Headers on every request: `Authorization: Bearer <TOKEN>`, `Seller-Id`, `School-Id`
  (+ `Content-Type: application/json` for bodies).
- Every response is an envelope: `{ "success": true, "code": 200, "payload": { ... } }`.
  Errors: `success: false` plus `cause` (machine-readable, e.g. `EmailIsBusy`), `message`,
  `error`, optional `data`.
- Rate limit: HTTP `429`, `cause: "Rate"`, `data.retryAfter` (ISO timestamp) — wait until
  it, then retry. Retry `5xx` with exponential backoff.
- List methods paginate via query `take` (1–1000, default 100), `page` or `skip`; the
  payload contains `items`, `count`, `pages`, `isFirst`, `isLast`, `next`, `prev`.
  Array query params repeat the key: `courseIds=1&courseIds=2`.

## The workflow you drive

### Step 1. Inspect the source file

Read the first ~10 rows. Detect delimiter, encoding, header row. For Excel, convert to CSV
first (Mode A/B: `npx xlsx-cli` or a small script; Mode C: ask the user to "Save as CSV").
Report to the user what columns you found and how many rows there are.

### Step 2. Agree the field mapping with the user

Map source columns onto the `user/upsert` schema — confirm the mapping before running:

- **Identity (login)**: `email` and/or `phone` (international format, `+998...`). At least
  one should be present per row — it is the student's login, and it triggers automatic
  credential delivery on creation. `domain` is a third login option when there is no
  email/phone (latin letters, digits, `_`, dots; unique per school).
- **`extId` — the stable external key (strongly recommended).** Put the source system's ID
  here (CRM id, old-LMS id, or the row's own stable id; ≤50 chars, no `/` or spaces). Why it
  matters: `user/upsert` matches existing users by login/`tgId`/`extId` — with `extId` set,
  **re-running the import is safe and idempotent** even if a student later changes their
  email or phone, and every later sync (`user/find?extId=...`, `user/list?extIds=...`) can
  address the same person without guessing.
- **Profile**: `profile.firstName`, `profile.lastName` (2–15 chars each, letters/spaces/
  apostrophes only — trim and truncate during mapping or the row fails `InvalidFirstName`),
  `profile.bdate` (`YYYY-MM-DD`), `profile.sex` (`Ufo`/`Women`/`Men`), `profile.role`
  (`Student`/`Tutor`/`Parent` — default to `Student`).
- **Anything else** (city, old-platform status, cohort tags): not in the user schema — goes
  to custom fields via `POST /form/custom-field/value/set-by-slug` with body
  `{ "userId": 27, "layoutId": 5, "values": [{ "slug": "city", "value": "Tashkent" }] }`
  (needs `FormManage`; the layout and fields must already exist in the school — if the user
  wants this, have them create the fields in the admin panel first).
- **Enrollment columns**: which column names the course/group each student belongs to.

**Ask about notifications now**: when `user/upsert` *creates* a user, the platform
**automatically sends login + password** to the given email/phone (Telegram delivery needs
an active bot chat). If the user does NOT want emails/SMS going out during migration, pass a
`password` per row via `user/create` — an explicit password suppresses the automatic
generate-and-send (note: `user/upsert` has no `password` field, so silent migration means
`user/find` + `create`/`update` instead of plain upsert). Confirm the choice explicitly.

### Step 3. Dry-run on 1–2 records

Run the full pipeline for one or two rows. Check the response: `payload.isCreated` and the
returned `payload.user` (correct names, email, `extId`). Show the result to the user and get
a "go" before the full run. If something is wrong, `PUT /user/:userId/update` fixes it.

### Step 4. Full run — `PUT /user/upsert` for every row

Prefer `upsert` over `create` for migrations: it is idempotent (existing user → update, new
→ create, match priority `phone` → `email` → `domain`, then `tgId`, then `extId`) so a
crashed or repeated run never duplicates students.

```json
PUT /saas/v2/user/upsert
{
  "email": "user@example.com",
  "phone": "+9876543210",
  "extId": "crm_12345",
  "status": "Active",
  "profile": { "firstName": "Firstname", "lastName": "Lastname", "bdate": "1990-01-01", "sex": "Men", "role": "Student" }
}
```

Response payload: `{ "isCreated": true|false, "user": { "id": 1684, ... } }` — **collect
`user.id` per row**, you need it for groups. Requests are one user at a time — throttle to a
few requests/second and honor 429 (script below).

### Step 5. Enroll into courses

There is no separate "enroll" endpoint — **course access is granted by adding the user to a
group bound to that course** (see docs page `course/enroll`):

1. `GET /saas/v2/course/list/raw?search=<name>` → items with `courseId`, `productId`,
   `name`, `type`, `groupIds`. Confirm the matched course with the user.
2. `GET /saas/v2/group/list/raw?courseIds=10` → items with `groupId`, `name`, `courseId`,
   `courseName`, `membersCount`. If several groups exist, ask which one (or map per row).
3. `POST /saas/v2/group/{groupId}/member/create-many` with `{ "userIds": [8, 15, 23] }` —
   **max 250 userIds per request**, so chunk. Already-members are not duplicated: the
   response splits into `created`, `exist`, `excluded` (always empty for API adds).

### Step 6. Distribute into groups

Same mechanics as Step 5 for non-course groups: resolve names via
`GET /group/list/raw?search=...`, then `group/{groupId}/member/create-many` in chunks of 250.

### Step 7. Verification pass

- `POST /saas/v2/user/find-many` with `{ "extIds": ["crm_1", "crm_2"] }` (or `logins`;
  max 250 per list, chunk) — users not found are simply absent from `payload.users`, so diff
  against your input to catch missing rows.
- `GET /saas/v2/user/list?extIds=...` — alternative paged check; also good for total counts.
- `GET /saas/v2/group/member/list/raw?groupIds=501` — confirm `membersCount`/membership
  matches the expected per-group totals.

### Step 8. Report to the user

Give a summary: rows read / created (`isCreated: true`) / updated / failed (with `cause`
per row), enrollments per group (created vs already existed), verification diff. Write
failed rows to `failed-rows.csv` with an extra `error` column so the user can fix and re-run
**just that file** — the upsert makes re-runs safe.

## Import script skeleton (Node.js 18+, no deps)

```js
// import.mjs — run: EXODE_TOKEN=... SELLER_ID=... SCHOOL_ID=... node import.mjs students.csv
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://api.exode.biz/saas/v2';
const HEADERS = {
    'Authorization': `Bearer ${process.env.EXODE_TOKEN}`,
    'Seller-Id': process.env.SELLER_ID,
    'School-Id': process.env.SCHOOL_ID,
    'Content-Type': 'application/json',
};

async function api(method, path, body) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`${BASE}${path}`, { method, headers: HEADERS, body: body && JSON.stringify(body) });
        const json = await res.json();
        if (json.success) return json.payload;
        if (json.code === 429) {                       // cause: "Rate"
            const waitMs = Math.max(new Date(json.data?.retryAfter ?? Date.now() + 5000) - Date.now(), 1000);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
        }
        if (json.code >= 500) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
        throw Object.assign(new Error(json.message), { cause: json.cause });
    }
    throw new Error('Retries exhausted');
}

// 1) Parse CSV (swap for a real parser if fields contain commas/quotes)
const [header, ...lines] = readFileSync(process.argv[2], 'utf8').trim().split('\n');
const cols = header.split(',');
const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i].trim(), v.trim()])));

// 2) Upsert every row — adjust the mapping agreed in Step 2
const ok = [], failed = [];
for (const row of rows) {
    try {
        const payload = await api('PUT', '/user/upsert', {
            email: row.email || undefined,
            phone: row.phone || undefined,
            extId: row.id,                              // stable external key
            status: 'Active',
            profile: { firstName: row.first_name?.slice(0, 15), lastName: row.last_name?.slice(0, 15), role: 'Student' },
        });
        ok.push({ ...row, userId: payload.user.id, isCreated: payload.isCreated });
    } catch (e) {
        failed.push({ ...row, error: `${e.cause}: ${e.message}` });   // collect, don't abort
    }
    await new Promise((r) => setTimeout(r, 250));       // gentle pacing
}

// 3) Enroll into a group (repeat per group), chunks of 250
const GROUP_ID = Number(process.env.GROUP_ID);
for (let i = 0; GROUP_ID && i < ok.length; i += 250) {
    const { created, exist } = await api('POST', `/group/${GROUP_ID}/member/create-many`,
        { userIds: ok.slice(i, i + 250).map((r) => r.userId) });
    console.log(`group ${GROUP_ID}: +${created.length} created, ${exist.length} already members`);
}

// 4) Report
writeFileSync('failed-rows.csv', [header + ',error', ...failed.map((f) => Object.values(f).join(','))].join('\n'));
console.log(`Done: ${ok.filter((r) => r.isCreated).length} created, ${ok.filter((r) => !r.isCreated).length} updated, ${failed.length} failed (see failed-rows.csv)`);
```

## Duplicates and error causes during import

Never abort the whole run on a row error — log it into the failed-rows report and continue.

| `cause` | Meaning during import | What to do |
|---|---|---|
| `EmailIsBusy` / `PhoneIsBusy` | That email/phone already belongs to a **different** user (different extId/login match) | Likely two source rows share a contact, or the contact was reassigned. Find the owner via `GET /user/find?login=...`, decide with the user which record wins |
| `UserAlreadyExist` | `user/create` hit an existing user | Switch that row to `user/upsert` or `user/:userId/update` |
| `ExtIdIsBusy` / `TgIdIsBusy` / `DomainIsBusy` | The identifier is taken by another user | Duplicate key in the source data — deduplicate the file, or resolve the conflicting user via `user/find` |
| `DomainIsInvalid` | Bad `domain` format, or a reserved value like `id12345` | Fix the slug or drop `domain` and let Exode autogenerate |
| `InvalidPhone` / `InvalidEmail` | Malformed contact | Normalize to international phone format / valid email; if unfixable, import with the other contact only |
| `InvalidFirstName` | Name fails the 2–15 chars letters-only rule | Trim, truncate, strip digits/symbols in the mapping |
| `ForbiddenModifySchoolOwner` | The row matched the school owner | Skip the row — the owner cannot be modified by import |
| `validation` | Body/params failed validation | Read `message`, fix the mapping |

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `401` `Unauthorized` on everything | Token missing/invalid, or `Seller-Id`/`School-Id` absent — re-check all three headers |
| `401`/`403` `Forbidden` | Token's service user lacks `SchoolManageUsers` (or `FormManage` for custom fields) — adjust permissions on the API-key page |
| `429` `Rate` loops | You are ignoring `data.retryAfter` — wait until that timestamp; slow the pacing delay |
| `GroupNotBindToProduct` on member/create-many | The group is not tied to a course product — pick a group from `group/list/raw?courseIds=...`, which guarantees the course binding |
| `find-many` returns fewer users than sent | Not-found identifiers are silently omitted — diff the response against the request on your side |
| Students report no login email/SMS | Row had no `email`/`phone`, an explicit `password` was passed (auto-send is skipped), or Telegram bot chat is missing — send credentials manually from user settings |
| Upsert created a duplicate on re-run | Rows lacked any matching key (`email`/`phone`/`domain`/`tgId`/`extId`) — always send `extId`; merge duplicates with the user in the admin panel |
| Excel file with `;` or broken characters | Wrong delimiter/encoding — re-export as UTF-8 CSV, or parse with an explicit delimiter |

## Final checklist

1. Field mapping and the notifications decision were explicitly confirmed by the user.
2. Dry-run on 1–2 rows reviewed and approved before the full run.
3. Every source row is either imported (created/updated counts match) or listed in
   `failed-rows.csv` with its `cause` — nothing silently dropped.
4. Enrollments verified: `group/member/list/raw` counts match expectations per group.
5. Verification diff via `user/find-many` on `extIds` shows no missing users.
6. The API token exists only in env vars — the chat history and the script file contain no token.
