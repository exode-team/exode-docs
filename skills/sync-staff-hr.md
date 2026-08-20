---
name: exode-staff-sync
description: Synchronize a company's org structure and employees from an HR system (1C ZUP, BOSS-Kadrovik, custom HR) into a corporate Exode school — departments, positions, employments, absences, department managers, terminations. Use when a corporate school wants to sync staff from HR/1C into Exode, keep the org tree up to date, or automate hiring/transfer/termination flows over the SaaS API.
---

# Sync staff from an HR system into Exode

You are an engineer wiring an HR system (1C ZUP, custom HR, CRM) to a **corporate Exode
school** over the SaaS REST API. The result: departments, positions, employees with
employments, managers and absences mirror the HR export, and repeated runs are safe.

Full endpoint reference lives in the docs (`docs.exode.biz/ru/exode-api/school/staff/*`);
this skill contains everything needed to run standalone. **Never invent endpoints or
fields** — use only what is listed here.

## First: detect where you are running

- **Mode A — agent on the user's computer** (Claude Code, Cursor, CLI agent). Run every
  step yourself: write the sync script in the user's folder, execute it, read API
  responses, iterate until the checklist passes.
- **Mode B — cloud agent with its own sandbox.** You can run commands and call the API
  with `curl`/Node, but ask the user to paste credentials as environment values rather
  than into chat when possible; validate each phase with real API calls before moving on.
- **Mode C — plain chat, no command execution** (including "generate 1C code for our
  integrator"). Produce complete, copy-paste-ready code (BSL for 1C, or the Node.js
  skeleton below), explain where credentials go, and have the user report each phase's
  result before continuing.

If unsure, try a harmless command (`node -v`): executes — Mode A/B; not — Mode C.

## Prerequisites

1. **A corporate-segment school.** All `staff/*` endpoints work **only** for schools of
   segment `Corporate` — other segments get `403 Forbidden`. Confirm this first.
2. **An API key (service user token).** The school owner creates it in the admin panel:
   **Management → School → API keys** (`/manage/school/api-keys`). The token is shown in
   full only at creation/rotation — save it immediately.
3. **Rights `StaffManage` + `StaffView`.** Keys for corporate schools ship with both out
   of the box — HR sync works without extra setup. Reading uses `StaffView`, all writes
   use `StaffManage`.
4. Never put the token in code, repos, or chat — environment variables only.

For the full credentials/auth walkthrough use the companion skill
`exode-api-integration` (skills/integrate-exode-api.md). Compact recap:

- Base URL: `https://api.exode.biz/saas/v2`
- Headers on every request: `Authorization: Bearer <TOKEN>`, `Seller-Id`, `School-Id`
  (+ `Content-Type: application/json` on writes)
- Every response is an envelope `{ "success": bool, "code": int, "payload": ... }`;
  errors add `cause` (machine-readable, e.g. `StaffDepartmentNotFound`), `message`,
  `error`. Branch your logic on `cause`, not on HTTP status alone.
- `429` with `cause: "Rate"` → retry after `data.retryAfter`.

## Data model and sync order

Entities link through **external IDs (`extId`)** — GUIDs/codes from the HR system. You
never need to store internal Exode IDs: departments, positions, employments, absences
and users are all addressed via `ext/{extId}` routes. `extId` rules: 1–50 chars, no `/`
and no whitespace (URL-safe; URL-encode it in paths), unique per school.

An **employment** is the central record: user + department + optional position, with
`kind` (`Main` / `InternalSecondary` / `ExternalSecondary`), `type`
(`FullTime`/`PartTime`), `rate` (0.01–1). Managers and absences attach to the
employment, not the user.

Sync strictly in this order (each step depends on the previous):

1. **Departments** — top-down: a parent must exist before its children.
2. **Positions** — keyed by HR GUID (`extId`), never by name.
3. **Employees** — user + employments in one call (`extra.staff.employments`).
4. **Department managers** — by `departmentExtId` + `employmentExtId`.
5. **Absences** — vacations/sick leaves per employment.
6. **Terminations** — explicit `terminate` calls (full-sync diff or HR events).

Violating the order fails loudly: creating an employee with an unknown
`departmentExtId` returns `StaffDepartmentNotFound` and **the user is not created**
(same for `StaffPositionNotFound`).

## Idempotency model (follow exactly)

- **Everything upserts by extId.** The documented pattern for each entity:
  `PUT .../ext/{extId}/update` → on `*NotFound` → `POST .../create` with the same
  `extId`. Re-running the whole sync is safe — run it hourly if you like.
- **Employees — pick the method by password policy:**
  - You do **not** set passwords → `PUT /user/upsert` (finds by login/`tgId`/`extId`;
    creates if missing; idempotent, simplest for recurring sync).
  - You **do** set passwords → `PUT /user/ext/{extId}/update` → `NotFound` →
    `POST /user/create`. Password applies **only on creation**; update (and the update
    branch of upsert) ignores it.
- **`extra.staff.employments` only "ensures the assignment exists".** Re-sending the
  same active department+position pair is a no-op; a new pair creates an **additional**
  employment (secondary job), and an assignment missing from the array is **not**
  terminated. Therefore: HR changes to existing staff go through dedicated employment
  endpoints, and in incremental updates of existing users you normally **omit
  `extra.staff`** — otherwise a transfer in HR becomes an extra secondary job in Exode.
- **Full-sync deletions:** if HR exports the complete list (not deltas), fetch
  `GET /staff/employment/list?activeOnly=true`, diff by employment `extId`, and
  `terminate` the ones absent from the export.
- **Status lifecycle is automatic — do not set it by hand:** terminating the last
  active employment sets `user.status = Terminated` (access closed, sessions ended);
  re-`hire` restores `Active`. Absences drive `OnLeave` ↔ `Active`, recalculated by the
  platform hourly against the calendar — no scheduler needed on your side. Map HR
  "Working" → `"status": "Active"` (also lifts a manual block); never map "Fired" to a
  status — call `terminate` instead. `Blocked` via `user/update` is for admin blocks
  without termination.

## Endpoints and request bodies

All paths relative to `https://api.exode.biz/saas/v2`. `{extId}` in paths is URL-encoded.

**1. Departments** — `GET /staff/department/tree` (flat array, hierarchy via
`parentId`), `GET /staff/department/list`, `POST /staff/department/create`,
`PUT /staff/department/ext/{extId}/update`, `DELETE /staff/department/ext/{extId}/delete`
(leaf-only: `StaffDepartmentHasChildren` / `StaffDepartmentHasActiveEmployments`).

```json
{ "name": "Отдел продаж", "extId": "ПОДР-001", "parentExtId": "ПОДР-000" }
```

**2. Positions** — `GET /staff/position/list?search=...`,
`POST /staff/position/create`, `PUT /staff/position/ext/{extId}/update`,
`DELETE /staff/position/ext/{extId}/delete`. Name is unique per school
(`StaffPositionNameIsNotUniq` — e.g. two 1C organizations with the same position name
under different GUIDs: converge the GUIDs on your side). Refresh the name on every sync
via update-by-extId; on `StaffPositionNotFound` create with `extId` = the HR GUID.
Fallback for exports without GUIDs: resolve by name via `list?search=`, create if missing.

```json
{ "name": "Менеджер", "extId": "e3b0c442-98fc-4b39-96f7-9c2a4d001a01" }
```

**3. Employees** — `POST /user/create` or `PUT /user/upsert` (see idempotency above).
For a corporate school, `extra.staff.employments` (1–10 items) is **required at
creation** (`StaffEmploymentInputRequired`). Multiple items = secondary jobs: first
`kind: "Main"`, others `InternalSecondary`/`ExternalSecondary`. Set an employment
`extId` — later transfers/terminations address it. Constraints: `firstName`/`lastName`
≤15 chars; `domain` ≤65 chars (latin/digits/`_`, dots as inner separators, not
digits-only); an employee without email/phone logs in by `domain` and **must** get a
`password`; `user.extId` is a sync key, not a login.

```json
{
  "email": "ivanov@company.ru",
  "extId": "i.ivanov.01011990",
  "status": "Active",
  "profile": { "firstName": "Иван", "lastName": "Иванов", "bdate": "1990-01-01", "sex": "Men" },
  "extra": { "staff": { "employments": [ {
    "extId": "i.ivanov.01011990:ПОДР-001",
    "departmentExtId": "ПОДР-001",
    "positionExtId": "e3b0c442-98fc-4b39-96f7-9c2a4d001a01",
    "kind": "Main", "type": "FullTime", "startAt": "2020-03-01T00:00:00Z"
  } ] } }
}
```

Fields with no API counterpart (middle name, city, tags, CRM status) → custom fields:
create them in a form layout, then `POST /form/custom-field/value/set-by-slug` after
the upsert. HR `leader_external_ids` → department-manager calls, not a user field.

**4. HR change events** (address the **employment** `extId`; on transfer/promote the
old record closes, a new one opens, and the `extId` moves to the new active record):

| HR event | Call |
|---|---|
| Profile change (name, email, bdate) | re-run the loop — `PUT /user/ext/{extId}/update` |
| Transfer to another department | `POST /staff/employment/ext/{extId}/transfer` `{ "toDepartmentExtId": "ПОДР-002" }` |
| Position change (promotion) | `POST /staff/employment/ext/{extId}/promote` `{ "toPositionExtId": "<GUID>" }` (or `"toPositionId": null` to clear) |
| Fired | `POST /staff/employment/ext/{extId}/terminate` `{}` (optional `finishAt`) |
| New secondary job | `POST /staff/employment/hire` or another `employments` item |
| Rehired | normal loop — create/`extra` hires again, status returns `Active` |

**5. Managers** — `POST /staff/department-manager/set` (upsert per
department+employment; `isPrimary: true` demotes the previous primary automatically);
`DELETE /staff/department-manager/ext/{extId}/remove`.

```json
{ "departmentExtId": "ПОДР-001", "employmentExtId": "i.ivanov.01011990:ПОДР-001", "extId": "dm-001", "isPrimary": true }
```

**6. Absences** — `GET /staff/absence/list` (`currentOnly=true` for active ones),
`POST /staff/absence/create`, `PUT /staff/absence/ext/{extId}/update`,
`DELETE /staff/absence/ext/{extId}/delete`. Types: `Absent`, `Vacation`, `DayOff`,
`BusinessTrip`, `SickLeave`, `ParentalLeave`, `StudyLeave`. `OnLeave` is informational —
login stays open.

```json
{ "extId": "1c-absence-2024-001", "employmentExtId": "i.ivanov.01011990:ПОДР-001",
  "type": "Vacation", "startAt": "2026-08-01T00:00:00Z", "finishAt": "2026-08-15T00:00:00Z" }
```

## Sync script skeleton

**1C ZUP:** a complete documented BSL implementation (update-by-extId → NotFound →
create, position ensure-by-GUID with name fallback, domain-from-login sanitizer, HTTP
wrapper reading `cause`) is in the docs page
`ru/exode-api/school/integrations/examples/1c-staff-sync` — reuse it as-is, replacing
`<AUTH_TOKEN>` / `<SCHOOL_ID>` / `<SELLER_ID>`. Run it as a 1C scheduled job (регламентное
задание); the loop is idempotent, hourly runs are safe.

**Node.js** (client per the documented setup; same flow):

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.exode.biz/saas/v2',
  headers: {
    Authorization: `Bearer ${process.env.EXODE_TOKEN}`,
    'Seller-Id': process.env.SELLER_ID,
    'School-Id': process.env.SCHOOL_ID,
  },
  validateStatus: () => true, // branch on payload.cause, not on throw
});

const cause = (res) => (res.data && res.data.cause) || null;

async function ensureDepartment(dep) { // parents before children
  const upd = await api.put(`/staff/department/ext/${encodeURIComponent(dep.extId)}/update`, { name: dep.name });
  if (upd.data.success) return;
  if (cause(upd) !== 'StaffDepartmentNotFound') throw new Error(cause(upd));
  const body = { name: dep.name, extId: dep.extId, ...(dep.parentExtId && { parentExtId: dep.parentExtId }) };
  const crt = await api.post('/staff/department/create', body);
  if (!crt.data.success) throw new Error(cause(crt));
}

async function ensurePosition(guid, name) {
  const upd = await api.put(`/staff/position/ext/${encodeURIComponent(guid)}/update`, { name });
  if (upd.data.success) return;
  if (cause(upd) !== 'StaffPositionNotFound') throw new Error(cause(upd));
  const crt = await api.post('/staff/position/create', { name, extId: guid });
  if (!crt.data.success) throw new Error(cause(crt)); // StaffPositionNameIsNotUniq → converge GUIDs
}

async function syncEmployee(emp) { // emp = mapped body from the HR export (see above)
  const { extra, password, ...card } = emp;
  const upd = await api.put(`/user/ext/${encodeURIComponent(emp.extId)}/update`, card);
  if (upd.data.success) return; // existing: card updated, employments untouched on purpose
  if (cause(upd) !== 'NotFound') throw new Error(cause(upd));
  const crt = await api.post('/user/create', { ...card, password, extra }); // create + hire, 2-in-1
  if (!crt.data.success) throw new Error(cause(crt));
}

async function terminateMissing(exportEmploymentExtIds) { // full-sync mode only
  let page = 1;
  for (;;) {
    const res = await api.get('/staff/employment/list', { params: { activeOnly: true, take: 1000, page } });
    for (const e of res.data.payload.items) {
      if (e.extId && !exportEmploymentExtIds.has(e.extId)) {
        await api.post(`/staff/employment/ext/${encodeURIComponent(e.extId)}/terminate`, {});
      }
    }
    if (res.data.payload.isLast) break;
    page += 1;
  }
}
```

Order the run: departments → positions → employees → managers
(`POST /staff/department-manager/set`) → absences → `terminateMissing` (full exports
only). Handle `429` by waiting until `data.retryAfter` and retrying.

## Scheduling

The loop is idempotent — schedule it as often as the business needs (hourly is fine):
1C регламентное задание, cron for the Node script. Do **not** build your own
`OnLeave`/`Active` recalculation: the platform re-checks absences against the calendar
every hour by itself. Terminations, transfers and promotions are event calls — fire
them from HR events or derive them from the full-sync diff.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `401 Unauthorized` on everything | Token missing/invalid, or `Seller-Id`/`School-Id` headers absent. Also check the key is an API-client service user. |
| `403 Forbidden` on `staff/*` | School is not `Corporate` segment, or the key lacks `StaffManage`/`StaffView` — check the key page in the admin panel. |
| `StaffDepartmentNotFound` on employee create | Departments not synced first, or `departmentExtId` typo. The user is **not** created — fix ordering, re-run. |
| `StaffPositionNameIsNotUniq` | Same position name under two GUIDs (multi-org 1C). Converge GUIDs to one, or drop the GUID for the duplicate org. |
| `StaffEmploymentInputRequired` on create | Corporate school requires ≥1 item in `extra.staff.employments` at user creation. |
| Employee got two active employments after a transfer in HR | You sent the new pair via `extra.staff.employments` — that hires, not transfers. Terminate the extra one, use `.../ext/{extId}/transfer` next time. |
| Employees never get terminated (orphaned records) | `employments` array absence ≠ termination. Add the full-sync diff (`employment/list` vs export → `terminate`) or fire terminate on HR events. |
| `ExtIdIsBusy` / `DomainIsBusy` / `EmailIsBusy` on create | The value belongs to another user in the school — dedupe the export or resolve the conflict by `user/find`. |
| Password from the export not applied | Password applies only on **creation**; `update`/upsert-update ignores it. Use create-path for new users. |
| `StaffCannotTerminateSelf` / `StaffCannotTerminateSchoolOwner` | Last-employment protection — skip the token's own user and the school owner in the termination diff. |
| `429` `cause: "Rate"` | Rate limit — wait until `data.retryAfter`, retry with backoff. |
| `validation` errors on names | `firstName`/`lastName` >15 chars, or `extId` with `/`/spaces, or `domain` digits-only — trim/sanitize on your side. |

## Final checklist

1. `GET /staff/department/tree` returns the full HR hierarchy with correct `parentId` links and `extId`s.
2. `GET /staff/position/list` — every position present, keyed by the HR GUID.
3. A spot-checked employee exists with the right profile, and `GET /staff/employment/list?activeOnly=true` shows exactly the expected assignments (no accidental secondary jobs).
4. Department managers are set (`isPrimary` correct); absences appear and the affected users show `OnLeave`.
5. Re-running the entire sync produces zero changes and zero errors (idempotency proven).
6. A test termination flips the user to `Terminated`; a re-hire returns `Active`.
7. The token lives only in env/1C secure storage — never in code or chat.
