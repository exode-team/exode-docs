# Exode SaaS API — consolidated reference (for LLMs)

Machine-readable overview of the Exode SaaS API: conventions, all methods, parameters, response shapes, entities, and webhooks.
Full documentation lives in the `en/exode-api/` directory. Source of truth — server-side zod schemas (`shared/schemas`).

> There is an official npm SDK `@exode-team/sdk` (typed REST API client + mini-app bridge).
> LLM reference: `en/exode-sdk/llms.txt`. npm: https://www.npmjs.com/package/@exode-team/sdk

## Base conventions

- **Base URL:** `https://api.exode.biz`. All methods are prefixed with `/saas/v2`.
- **Authentication:** header `Authorization: Bearer <TOKEN>` — token of a service user (API client).
- **Required headers:** `Authorization`, `Seller-Id`, `School-Id`. Seller-Id and School-Id are numeric IDs shown in the admin panel on **Manage → School → For developers → API keys** ("Integration data → Identifiers"; RU UI: «Управление → Школа → Для разработчиков → API-ключи»). A seller has exactly one school; the API resolves the school from `Seller-Id` and checks `School-Id` against it (mismatch → `400 ForbiddenSchoolMismatch`). Method pages write them as Postman variables `{{ sellerId }}` / `{{ schoolId }}`.
- **Response (success):** `{ "success": true, "code": <200..206>, "payload": <data> }`.
- **Response (error):** `{ "success": false, "code": <4xx/5xx>, "cause": "<code>", "message": "<text>", "error": "<text>", "data": <opt.> }`.
  - Typical `cause` values: `validation` (400), `Unauthorized` (401, missing/invalid token), `Blocked` (401, user is banned), `Forbidden` (401 — missing/foreign `Seller-Id`, missing permission `Forbidden seller resource - permissions <Code>`, entity of another school `seller not entity owner`, `Allowed only for (Corporate) school`; 403 — token user is not an API client), `ForbiddenSchoolMismatch` (400), `Rate` (429). For `validation`, `message` is an array of strings.
- **Rate limit:** on excess — HTTP `429`, `cause:"Rate"`, `data.retryAfter` (date). The limit is per token.
- **Pagination** (list methods): query `take` (1–1000, default 100), `page` (≥1), `skip` (≥0; `page` is used only when `skip` is absent — if both are sent, `skip` wins).
  - Page body: `{ items[], page, count, pages, isFirst, isLast, next:{skip,take,page}, prev:{skip,take,page} }`.
- **Arrays** in query — by repeating the key: `userIds=1&userIds=2`. **Ranges** — an object `{ from, to }`.
- **RBAC:** when a method lists several permissions, any single one is enough (OR). The API-client flag on the token is required for all SaaS methods.
  Permissions are enabled in the admin panel: **Manage → School → For developers → API keys → "Edit"** (RU UI: «Управление → Школа → Для разработчиков → API-ключи → Редактировать»). The panel shows human labels, not codes; the API returns the code in the `401` error message (`cause: "Forbidden"`, `Forbidden seller resource - permissions FormManage`). Code → checkbox (corporate schools say «компании» instead of «школы» in the first two labels):

  | Code | Checkbox (EN UI) | Checkbox (RU UI) | Section (EN / RU) |
  |---|---|---|---|
  | `SchoolManageUsers` | School User Management | «Управление пользователями школы» | School Management / Управление школой |
  | `SchoolManageSettings` | School Settings Management | «Управление настройками школы» | School Management / Управление школой |
  | `FormManage` | Forms management | «Управление формами» | Forms management / Управление формами |
  | `CourseCurator` | Course Curator | «Куратор курсов» | Course Management / Управление курсами |
  | `CourseStudentManage` | Course Student Management | «Управление студентами курса» | Course Management / Управление курсами |
  | `CourseManage` | Course Management | «Управление курсами» | Course Management / Управление курсами |
  | `SellerSales` | School Sales | «Продажи школы» | Organization Management / Управление организацией |
  | `SellerRefunds` | School Refunds | «Возвраты школы» | Organization Management / Управление организацией |
  | `StaffView` | Staff browsing | «Просмотр персонала» | Staff Management / Управление персоналом |
  | `StaffManage` | Staff Management | «Управление персоналом» | Staff Management / Управление персоналом |

- **Staff (HR) module:** available **only** to `Corporate`-segment schools (other segments get `401`, `cause: "Forbidden"`, message `Allowed only for Corporate school`). Reads require `StaffView`, writes require `StaffManage`. Staff records carry an optional `extId` — an external ID from the client's system (CRM/1C/HR), 1–50 chars, URL-safe (no `/` or whitespace), unique within the school among non-deleted (for employments: among open) records; `ext/{extId}` route variants address records by it (URL-encode the path value).

## Method summary table

| Method | Path | Purpose | Permission (RBAC) | Limit | Docs |
|---|---|---|---|---|---|
| POST | `/saas/v2/user/create` | Create a user | `SchoolManageUsers` | — | `en/exode-api/school/user/create` |
| PUT | `/saas/v2/user/:userId/update` | Update a user | `SchoolManageUsers` | — | `en/exode-api/school/user/update` |
| PUT | `/saas/v2/user/upsert` | Create or update (by login phone→email→domain, then tgId, then extId) | `SchoolManageUsers` | — | `en/exode-api/school/user/upsert` |
| GET | `/saas/v2/user/find` | Find a user (login \| tgId \| extId) | `SchoolManageUsers` | — | `en/exode-api/school/user/find` |
| POST | `/saas/v2/user/find-many` | Bulk find by lists of logins/tgIds/extIds | `SchoolManageUsers` | — | `en/exode-api/school/user/find-many` |
| GET | `/saas/v2/user/list` | Paginated list of school users | `SchoolManageUsers` | — | `en/exode-api/school/user/list` |
| DELETE | `/saas/v2/user/delete-many` | Bulk delete (userIds ≤250, reason) | `SchoolManageUsers` | — | `en/exode-api/school/user/delete-many` |
| PUT | `/saas/v2/user/:userId/state/set?key=` | Write state by key | `SchoolManageUsers` | — | `en/exode-api/school/user/state` |
| GET | `/saas/v2/user/:userId/state/get?key=` | Read state by key | `SchoolManageUsers` | — | `en/exode-api/school/user/state` |
| POST | `/saas/v2/user/session/auth-token` | Create/get a user session token | `SchoolManageUsers` | — | `en/exode-api/school/user/session/auth-token` |
| GET | `/saas/v2/staff/department/tree` | Flat array of all departments (hierarchy via `parentId`) | `StaffView` | — | `en/exode-api/school/staff/department` |
| GET | `/saas/v2/staff/department/list` | Paginated department list | `StaffView` | — | `en/exode-api/school/staff/department` |
| POST | `/saas/v2/staff/department/create` | Create a department | `StaffManage` | — | `en/exode-api/school/staff/department` |
| PUT | `/saas/v2/staff/department/:departmentId/update` (+ `ext/:extId/update`) | Update a department | `StaffManage` | — | `en/exode-api/school/staff/department` |
| DELETE | `/saas/v2/staff/department/:departmentId/delete` (+ `ext/:extId/delete`) | Delete a department | `StaffManage` | — | `en/exode-api/school/staff/department` |
| GET | `/saas/v2/staff/position/list` | Paginated position list | `StaffView` | — | `en/exode-api/school/staff/position` |
| POST | `/saas/v2/staff/position/create` | Create a position | `StaffManage` | — | `en/exode-api/school/staff/position` |
| PUT | `/saas/v2/staff/position/:positionId/update` (+ `ext/:extId/update`) | Update a position | `StaffManage` | — | `en/exode-api/school/staff/position` |
| DELETE | `/saas/v2/staff/position/:positionId/delete` (+ `ext/:extId/delete`) | Delete a position | `StaffManage` | — | `en/exode-api/school/staff/position` |
| GET | `/saas/v2/staff/employment/list` | Paginated employment list | `StaffView` | — | `en/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/hire` | Hire an employee (new active employment) | `StaffManage` | — | `en/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/transfer` (+ `ext/:extId/transfer`) | Transfer to another department | `StaffManage` | — | `en/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/promote` (+ `ext/:extId/promote`) | Change/remove position | `StaffManage` | — | `en/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/terminate` (+ `ext/:extId/terminate`) | Terminate an employment | `StaffManage` | — | `en/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/department-manager/set` | Assign a department manager (upsert) | `StaffManage` | — | `en/exode-api/school/staff/department-manager` |
| DELETE | `/saas/v2/staff/department-manager/:managerId/remove` (+ `ext/:extId/remove`) | Remove a department manager | `StaffManage` | — | `en/exode-api/school/staff/department-manager` |
| GET | `/saas/v2/staff/absence/list` | Paginated absence list | `StaffView` | — | `en/exode-api/school/staff/absence` |
| POST | `/saas/v2/staff/absence/create` | Create an absence | `StaffManage` | — | `en/exode-api/school/staff/absence` |
| PUT | `/saas/v2/staff/absence/:absenceId/update` (+ `ext/:extId/update`) | Update an absence | `StaffManage` | — | `en/exode-api/school/staff/absence` |
| DELETE | `/saas/v2/staff/absence/:absenceId/delete` (+ `ext/:extId/delete`) | Delete an absence | `StaffManage` | — | `en/exode-api/school/staff/absence` |
| GET | `/saas/v2/group/list/raw` | List groups | `SchoolManageUsers` | — | `en/exode-api/school/group/list` |
| GET | `/saas/v2/group/member/list/raw` | List group members | `SchoolManageUsers` | — | `en/exode-api/school/group-member/list` |
| POST | `/saas/v2/group/:groupId/member/create-many` | Add members (userIds ≤250) | `SchoolManageUsers` | — | `en/exode-api/school/group-member/create-many` |
| DELETE | `/saas/v2/group/:groupId/member/delete-many` | Remove members (userIds ≤250) | `SchoolManageUsers` | — | `en/exode-api/school/group-member/delete-many` |
| GET | `/saas/v2/course/list/raw` | List courses | `CourseCurator` \| `SchoolManageUsers` | — | `en/exode-api/school/course/list` |
| GET | `/saas/v2/course/:courseId/get` | Get a course (full `course` object, no lesson tree) | `CourseManage` \| `CourseCurator` | — | `en/exode-api/school/course/get` |
| POST | `/saas/v2/course/create` | Create a course, optionally with modules/lessons/blocks | `CourseManage` | — | `en/exode-api/school/course/create` |
| PUT | `/saas/v2/course/:courseId/update` | Update course fields (no tree) | `CourseManage` | — | `en/exode-api/school/course/update` |
| GET | `/saas/v2/course/:courseId/progresses` | Participant progress for a course | `CourseCurator` \| `SchoolManageUsers` | — | `en/exode-api/school/course/progresses` |
| GET | `/saas/v2/certificate/list/raw` | List certificates | `CourseManage` \| `CourseStudentManage` | — | `en/exode-api/school/certificate/list` |
| GET | `/saas/v2/invoice/list/raw` | List invoices | `SellerSales` | — | `en/exode-api/school/invoice/list` |
| GET | `/saas/v2/product-access/list/raw` | List product accesses | `SchoolManageUsers` \| `CourseStudentManage` | — | `en/exode-api/school/product-access/list` |
| GET | `/saas/v2/form/layout/list` | List form layouts | `FormManage` | — | `en/exode-api/school/form-layout/list` |
| POST | `/saas/v2/form/layout/create` | Create a form layout | `FormManage` | — | `en/exode-api/school/form-layout/create` |
| PUT | `/saas/v2/form/layout/:layoutId/update` | Update a form layout | `FormManage` | — | `en/exode-api/school/form-layout/update` |
| DELETE | `/saas/v2/form/layout/:layoutId/delete` | Delete a form layout | `FormManage` | — | `en/exode-api/school/form-layout/delete` |
| GET | `/saas/v2/form/custom-field/value/get` | Custom field values | `FormManage` | — | `en/exode-api/school/custom-field/get` |
| POST | `/saas/v2/form/custom-field/value/set` | Write field values (by fieldId) | `FormManage` | — | `en/exode-api/school/custom-field/set` |
| POST | `/saas/v2/form/custom-field/value/set-by-slug` | Write field values (by slug) | `FormManage` | — | `en/exode-api/school/custom-field/set` |
| POST | `/saas/v2/query-export/generate` | Create an asynchronous export | auth (API client) | 100/hour | `en/exode-api/school/query-export/generate` |
| GET | `/saas/v2/workflow-execution/:executionUuid/result` | Export result (polling) | auth (API client) | — | `en/exode-api/school/query-export/result` |

## Parameters and responses per method

### Users
- **create** (body `CreateUserInput`): `email?`, `phone?` (international), `domain?` (≤65), `tgId?`, `extId?` (≤50), `password?` (6..100), `skipSendCredentials?` (boolean, default false), `status?`(Active|OnLeave|Banned|Blocked|Terminated; the `banned` field was removed, `Deleted` is system-only), `profile?` `{ firstName?(≤15), lastName?(≤15), bdate?(YYYY-MM-DD), sex?(Ufo|Women|Men), role?(Student|Tutor|Parent), contact?{phone,email,messengerUrl} }`, `extra?{ staff{ employments[1..10] } }` (Corporate only, required there). Response: `{ user: userWithProfile }`. Credentials are sent to the new user automatically (SMS if `phone` + an active SMS provider, else email; plus Telegram if `tgId`); passing `password` replaces the generated password (and that password is sent); `skipSendCredentials: true` disables the delivery (without `password` a password is still generated — visible in the user's settings in the account).
- **update** (path `userId`, body `UpdateUserInput` — all create fields optional). Response: `{ user }`. Unban: pass `status: Active` — the effective status is recalculated from employments/absences.
- **upsert** (body `UpdateUserInput` + `skipSendCredentials?` — applies only when a user is created, ignored on update; no `password`). Lookup: only the first non-empty login of `phone` → `email` → `domain`, then `tgId`, then `extId`; the first match is updated, otherwise a user is created (so a user matching only by `email` while `phone` is also passed is not found → `EmailIsBusy`). Response: `{ user, isCreated: boolean }`.
- **find** (query): at least one of `login`(2..50) | `tgId` | `extId`(1..50); checked in that order with fallback, the first match is returned. URL-encode `+` in phone logins. Response: `{ user | null }`.
- **find-many** (body): at least one non-empty list of `logins[]`(each 2..50; email, international phone, or `id12345` domain), `tgIds[]`, `extIds[]`(each 1..50) — each list ≤250 items. Response: `{ users: userWithProfile[] }`. Users that were not found are simply omitted — match the result to the request by `email`/`phone`/`tgId`/`extId` on your side.
- **list** (query `FilterUserInput`, all opt.): `search`(≤50), `statuses[]`(Active|OnLeave|Banned|Blocked|Terminated|Deleted), `activated`, `archived`, `userIds[]`, `extIds[]`(≤250), `createdAtDateRange{from,to}`, `lastOnlineAtDateRange{from,to}`; sort `id|createdAt|updatedAt|lastOnlineAt|starsBalance|productAccessesCount|archivedAt|order`(ASC|DESC) + pagination. Response: page of `userWithProfile[]`. The `active`/`banned` filter fields were removed — use `statuses`.
- **delete-many** (body): `userIds: number[] (≤250)`, `reason: string (≤256)`. Response: `{ deleted: number[], skipped: number[] }`. Deletion clears `email`/`phone`/`tgId` only; `extId` and `domain` stay on the `Deleted` record (re-using them → `ExtIdIsBusy`/`DomainIsBusy`).
- **state set** (path `userId`, query `key`, body `{ value }`). Response: `{ set: boolean }`.
- **state get** (path `userId`, query `key`). Response: `{ value: any | null }`.
  - Writable keys: `UtmSignupParams`, `PersonalInfoFilled`, `OnBoardingProgress`, `ContentCategoryIds`. Additionally readable: `VkToken` (masked). Anything else → `Not allowed key`.
- **session/auth-token** (body `CreateSessionInput`): `userId: number`, `forceCreate?: boolean`. Response: `{ session, isCreated: boolean }`. Refused (`Forbidden`) for users with any permissions (admins/managers). Auto-login link: `https://<school-domain>/education?___uat=<session.token>`.

### Staff (HR) — `Corporate` schools only
- **department/tree** — returns a **flat array** of all school departments; hierarchy via `parentId` (`null` = root), build the tree client-side.
- **department/list** (query, all opt.): `departmentIds[]`(≤250), `parentIds[]`(≤250), `extIds[]`(≤250), `search`(≤50, by name), `createdAt`(ASC|DESC) + pagination. Item: `{ id, schoolId, parentId?, extId?, name, createdAt, updatedAt, archivedAt? }`.
- **department/create** (body): `name!`(1..100, trimmed), `extId?`, parent via `parentId` **or** `parentExtId` (exactly one of the pair; none → root), primary manager via `primaryManagerEmploymentId` **or** `primaryManagerEmploymentExtId`. Errors: `StaffDepartmentExtIdIsNotUniq`, `StaffDepartmentNotFound` (parent).
- **department/:departmentId/update** (body = create fields, all opt.). `parentId: null` makes it root; the new parent must not be the department itself or its descendant (`StaffDepartmentParentCreatesCycle`). `primaryManagerEmploymentId: null` demotes the current primary manager to a regular one (the manager record is kept). On update an omitted `parentExtId`/`parentId` keeps the parent; `StaffDepartmentNotFound` is also returned for an unknown parent. `ext/:extId/update` — same body, lookup by `extId` (`StaffDepartmentNotFound`).
- **department/:departmentId/delete** (also `ext/:extId/delete`). Only a leaf department with no active employees can be deleted: errors `StaffDepartmentHasChildren`, `StaffDepartmentHasActiveEmployments`. Response: `{ affected }`.
- **position/list** (query, all opt.): `positionIds[]`(≤250), `search`(≤50, fuzzy — compare `name` exactly on your side), `extIds[]`(≤250), `createdAt`(ASC|DESC) + pagination. Item: `{ id, schoolId, name, extId?, ... }`. Position `name` is unique per school, case-insensitive (`StaffPositionNameIsNotUniq`).
- **position/create** (body): `name!`(1..100, trimmed, unique per school), `extId?`. **position/:positionId/update** / `ext/:extId/update` — same fields, all opt. **position/:positionId/delete** / `ext/:extId/delete` — fails with `StaffPositionHasActiveEmployments` while active employees hold the position. Response: `{ affected }`.
- **employment/list** (query, all opt.): `employmentIds[]`, `extIds[]`, `userIds[]`, `departmentIds[]`, `departmentExtIds[]`, `positionIds[]`, `positionExtIds[]`, `statuses[]`(Active|Terminated), `activeOnly` (status `Active` and `startAt` already reached — future-dated hires excluded; use `statuses=Active` to include them), `search`(≤50) + pagination. Item: `{ id, schoolId, userId, positionId?(null = no position), departmentId, extId?, startAt, finishAt?, status(Active|Terminated), kind(Main|InternalSecondary|ExternalSecondary), type(FullTime|PartTime), rate(0.01..1), createdAt, updatedAt }`.
- **employment/hire** (body): `userId!`, department via `departmentId`/`departmentExtId` (exactly one, required), position via `positionId`/`positionExtId` (optional pair — omit both to hire without a position), `extId?`, `startAt?`(ISO, default now), `kind?`(default Main), `type?`(default FullTime), `rate?`(default 1). Only one active employment per department+position pair (or department+user when positionless) — else `StaffEmploymentAlreadyExists`. Hiring a `Terminated` user returns them to `Active`. Errors: `StaffEmploymentExtIdIsNotUniq`, `StaffPositionNotFound`, `StaffDepartmentNotFound`, `UserNotBelongsToSchool`.
- **employment/transfer** (body): `employmentId!`, target via `toDepartmentId`/`toDepartmentExtId` (exactly one), `startAt?` (must fall inside the current employment interval — else `StaffEmploymentInvalidTransitionDate`). Closes the current record (`finishAt`, status `Terminated`) and creates a **new** active one in the target department, keeping the position; `kind`/`type`/`rate`/`extId` carry over. Returns the new record — with a **new `id`** (store the `extId`, not the `id`); managership moves to the new record, absences stay on the closed one. `ext/:extId/transfer` — same body without `employmentId`; `ext/:extId/*` routes resolve only open employments. Department + position change at once: `transfer`, then `promote` with the same `startAt`.
- **employment/promote** (body): `employmentId!`, target via `toPositionId`/`toPositionExtId` (exactly one), or `toPositionId: null` to **remove** the position; passing neither → `StaffEmploymentInputRequired`. `startAt?` as in transfer. Same close-and-recreate semantics, in the same department. `ext/:extId/promote` — same body without `employmentId`.
- **employment/terminate** (body): `employmentId!`, `finishAt?` (not before `startAt`). Closes the record **immediately** (a future `finishAt` does not postpone it) and removes the employee from department management; the employment `extId` becomes free for a rehire. Terminating the **last active** employment switches the user to status `Terminated` (login blocked, sessions ended); re-hiring restores `Active`. Protections on the last employment: `StaffCannotTerminateSelf`, `StaffCannotTerminateSchoolOwner`. `ext/:extId/terminate` — same body without `employmentId`.
- **department-manager/set** (body): department via `departmentId`/`departmentExtId`, employment via `employmentId`/`employmentExtId` (exactly one field per pair; employment must be active and already started; it may belong to any department), `extId?`, `isPrimary?`(default false — also applied to an existing record, so a repeated `set` without it demotes the primary). Works as an upsert per department+employment pair. There is no manager list endpoint — pass your own `extId` to remove via `ext/:extId/remove`. Managership follows transfer/promote and is removed on terminate. A department has at most one primary manager: `isPrimary=true` demotes the previous primary automatically. Errors: `StaffDepartmentNotFound`, `StaffEmploymentNotFound`, `StaffDepartmentManagerExtIdIsNotUniq`.
- **department-manager/:managerId/remove** (also `ext/:extId/remove`, error `StaffDepartmentManagerNotFound`) — soft-deletes the manager record. Response: `{ affected }`.
- **absence/list** (query, all opt.): `extIds[]`, `employmentIds[]`, `positionIds[]`, `types[]`(Absent|Vacation|DayOff|BusinessTrip|SickLeave|ParentalLeave|StudyLeave), `currentOnly` + pagination. Item: `{ id, schoolId, employmentId, extId?, type, startAt, finishAt?, note?, createdAt, updatedAt }`.
- **absence/create** (body): employment via `employmentId` (any record, closed included) / `employmentExtId` (open records only) — exactly one, `type!`, `startAt!`(ISO, ≤ `finishAt`), `finishAt?` (instant; an absence is current while `startAt ≤ now ≤ finishAt`, omitted = open-ended; on update `null` clears it, and a conflict with the stored value → `StaffAbsenceInvalidInterval`), `note?`(≤500, trimmed), `extId?`. **absence/:absenceId/update** / `ext/:extId/update` — same fields, all opt.; the employment link cannot be changed. **absence/:absenceId/delete** / `ext/:extId/delete` — response `{ affected }`; error `StaffAbsenceNotFound`.
  - Absences auto-sync the user status `Active` ↔ `OnLeave` (informational — does not block login); recalculated on API calls and hourly against the calendar. Users in `Banned`/`Blocked`/`Terminated` are not affected.

### Group
- **list/raw** (query `FilterGroupInput`, all opt.): `groupIds[]`, `productIds[]`, `courseIds[]`, `search`(≤50) + pagination. Item: `{ groupId, name, courseId?, courseName?, membersCount }`.
- **member/list/raw** (query `FilterMemberGroupInput`, all opt.): `groupIds[]`, `userIds[]`, `memberIds[]`, `inviterUserIds[]`, `productIds[]`, `active`, `search`(≤50, by login/name), `createdAtDateRange{from,to}` + pagination. Item: `{ id, groupId, groupName, userId, inviterId?, active, blockedUntil?, enrollmentSource(Manual|System|Automatic), tgChannelMeta?, tgGroupChatMeta?, createdAt, updatedAt, archivedAt?, user?(userWithProfile), inviter?(userWithProfile) }`.
- **member/create-many** (body `userIds[] ≤250`; IDs outside the school are silently skipped; new members get product access + `ProductEnrolledViaLms` webhook; group without a product → `GroupNotBoundToProduct`). Response: `{ exist: groupMember[], created: groupMember[], excluded: user[] }`. `excluded` is always empty for this method (exclusions only restrict automatic assignment); manual adding **clears** a previously set exclusion.
- **member/delete-many** (body `userIds[] ≤250`). Response: `{ affected: number }`. The removal counts as manual and **blocks** subsequent automatic assignment of the user to this group (exclusion with reason "removed manually"); cleared by re-adding via `member/create-many`. Relevant only for corporate groups with auto-assignment configured.

### Course
- **list/raw** (query `FilterCourseInput`, all opt.): `courseIds[]`, `aliases[]`, `types[]`(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), `tags[]`, `search`(≤50), `subjectCategoryIds[]`, `contentCategoryIds[]`, `archived`, `access`(=FilterAccessProductInput), `product`(FilterProductInput) + pagination (`participation`/`manage`/`administrate` exist in the schema but are not applied by this method). Item: `{ courseId, productId, name, type, groupIds[] }`.
- **create** (body `ImportCourseInput`; school only; plan guard `maxActiveProducts` → 402 `SaasLimitReached` with `data{feature,current,max}`): required `type`, `name`(1..130), `description`(≤500, may be ""), `tags[]`(each ≥2, may be []), `authors[]`(userIds, may be []; the key user is added automatically); optional `alias`, `image{main,card}`, `promoVideo`, `seoTags[]`, `subjectCategoryIds[]`, `contentCategoryId`, `settings{learningPathMode, lessonProgressMode, editorAccessMode, curatorAccessMode, certificate{…}, …}`, `product{type:Course (required if object passed), currency, showInCatalog, enrollmentTypes[], saleStartAt, saleFinishAt}`, `bundleCourses[]`, `modules[]` (≤50) → `{ name(≤120), description(≤500), status?, accessType?, previewImage?, lessons[] (≤100) → { name, description, status?, type?, accessType?, previewImage?, withPractice?, settings?, blocks[] (≤100) → { type(ContentElementType), title?, content(object, NOT validated — stored as passed) } } }`. Modules/lessons default to `Draft` — pass `status: Published` to show them. NOT atomic: the tree is written sequentially without a transaction; a failure midway leaves a partial course. Also creates a published product and a default group; the key user becomes author + editor. Unknown fields are silently dropped. Do not pass `buildStatus`/`aiContext` (AI wizard internals). Response: `course`. Errors: `validation`, `InvalidAlias`, `AliasAlreadyBusy`, `CertificateTemplateRequired`, `CertificateTemplateNotAvailable`, `BundleGroupAlreadyUsed`, `BundleCourseSellerMismatch`, 402 `SaasLimitReached`.
- **:courseId/update** (body = all `create` course fields optional, no `modules`; `authors`/`tags`/`subjectCategoryIds` replace, `settings` merges; do not pass `product`). Response: `course`. Course access modes apply: with `editorAccessMode: Assigned` only an assigned key passes (`Forbidden … product <id> permissions CourseManage`).
- **:courseId/get** — full `course` (no lesson tree). `CourseManage` works when `editorAccessMode=All`, `CourseCurator` when `curatorAccessMode=All`; otherwise the key must be assigned to the course.
- **:courseId/progresses** (query — pagination only; no user/lesson filters). Items: `courseProgress` (see entities); DB `status` values: NotStarted|OnTheory|OnPractice|OnReview|OnCorrection|Completed.
- **Course enrollment:** there is no dedicated endpoint — enroll a user by adding them to a group tied to the course: find the group via `group/list/raw` with `courseIds`, then call `group/:groupId/member/create-many`. Access records are created automatically. Docs: `en/exode-api/school/course/enroll`.

### Certificate
- **list/raw** (query `FilterCertificateInput`, all opt.): `certificateIds[]`, `courseIds[]`, `userIds[]`, `groupIds[]` (groups of the recipient, not of the certificate), `issuedAtDateRange{from,to}`, `archived` + pagination. Item: `{ certificateId, uuid, link, courseId, courseName?, issuedAt, expireAt?, user?(userWithProfile) }`. `link` is a public certificate URL (opens without authentication).

### Invoice
- **list/raw** (query `FilterInvoiceInput`, all opt.): `invoiceIds[]`, `userIds[]`, `productIds[]`, `types[]`(Regular|InstallmentPay|InstallmentInit|SubscriptionPay|SubscriptionInit), `search`(≤50), `createdAtDateRange{from,to}`, `totalAmountRange{from,to}`, `utmParams{value:[{key,value}]}`, `payment{paymentIds[],acquiringIds[],statuses[](any payment of the invoice),actualStatuses[](latest payment — use `Completed` for paid invoices)}` + pagination. Invoice `status` (Active|Canceled) is not the payment status. Item: `{ invoiceId, invoiceUuid, type, status(Active|Canceled), totalAmount, discountAmount, currency, createdAt, expireAt?, user{id,tgId?,login?,email?,phone?,fullName?}, products[{productId,courseId?,totalPrice,discountAmount}] }`.

### ProductAccess
- **list/raw** (query `FilterAccessProductInput`, all opt.): `accessIds[]`, `active`, `userIds[]`, `courseIds[]`, `groupIds[]`(current membership), `expiryStatuses[]`(NoExpiry|Active|Expiring(≤14 days)|Expired), `enrolledByUserIds[]`, `participantCuratorIds[]`, `launchIds[]`, `currentLessonIds[]`, `search`(≤50), `participantStatuses[]`(InUse|Completed), `withParent`, ranges `expireAtDateRange`/`createdAtDateRange`/`progressPercentRange`; billing: `billingActive`, `hasProductBillingTypes[]`(Installment|Subscription), `billingStatuses[]`, `billingIntervals[]`(Week|Month|Year), `billingInvoiceIds[]`, `billingAmountRange`, `billingCurrentPaymentAtDateRange`, `billingNextPaymentAtDateRange`; nested `product`/`price`/`user` + pagination. Item: `{ accessId, productId, courseId?, active, expireAt?, user{id,extId?,tgId?,login?,email?,phone?,fullName?} }`.

### Form
- **layout/list** (query `FilterFormLayoutInput`, all opt.): `layoutIds[]`, `layoutUuids[]`, `slugs[]`, `modes[]`(Form|Signup|Custom|Welcome|Participant), `statuses[]`(Draft|Published), `productIds[]`, `search`(≤50); sort `id|createdAt`(ASC|DESC) + pagination. Response: page of `formLayout[]`.
- **layout/create** (body `CreateFormLayoutInput`): `mode!`(Form|Signup|Custom|Welcome|Participant), `name!`(≤255), `internalName!`(≤255), `status?`(Draft|Published), `slug?`(1..50), `note?`(≤255), `productIds?[]`, `config?{resubmitMode(NewFill|Overwrite|NotAllowed)}`. Response: `formLayout`.
- **layout/:layoutId/update** (body = PartialType create). Response: `formLayout`.
- **layout/:layoutId/delete** (soft delete; frees the slug; repeated call → 401 `seller not entity owner`). Response: `{ affected }`. Fields inside a layout are created only in the admin panel (no API).
- **custom-field/value/get** (query `FilterFormFieldValueInput`, all opt.): `userIds[]`, `fieldIds[]`, `fieldSlugs[]`, `fillIds[]`, `layoutUuids[]`, `layoutSlugs[]`, `layoutModes[]`, `productIds[]` + sort `id|createdAt|updatedAt`(ASC|DESC) + pagination. Response: page of `formFieldValue[]`. Fields with `read.api=false` are excluded after paging (`count` still includes them — page may hold fewer than `take` items).
- **custom-field/value/set** (body): `userId!`, `layoutId!`, `values: [{ fieldId!, text?|number?|boolean?|date?|json? }] (min 1)`. Response: `formFieldValue[]`. Upsert per user+field (idempotent); all fields must belong to `layoutId` (`FieldNotBelongsToLayout`); any invalid field rejects the whole request. POST responses return HTTP 201.
- **custom-field/value/set-by-slug** (body): `userId!`, `layoutId!`, `values: [{ slug!, value? }] (min 1)`. Response: `formFieldValue[]`. Fields with `write.api=false` reject writes.

### QueryExport (asynchronous exports)
- **generate** (body `GenerateQueryExportInput`): `type!`(QueryExportType), `variables!`(object `{ filter!, sort? }`; `filter` is required for every type, `{}` = no filtering; pagination is done by the service), `format?`(`EXPORT_FORMAT_XLSX`|`EXPORT_FORMAT_CSV`|`EXPORT_FORMAT_JSON`, default XLSX; extra sheets only in XLSX; CSV = comma, UTF-8 with BOM; JSON = array of objects with English technical keys). Optional header `Ux-Language` (`ru|en|uz|qa`) sets column header language, default English. Limit 100/hour. Response (`201`): `{ uuid, flow, status(Waiting|Processing|Failed|Canceled|Completed), isCompleted, userId?, createdAt, updatedAt? }`, status on creation `Processing`.
  - `type` = `QUERY_EXPORT_TYPE_GROUP_MEMBER_FIND_MANY` | `QUERY_EXPORT_TYPE_COURSE_LESSON_PRACTICE_ATTEMPT_FIND_MANY` (also `*_SCHOOL_USER_FIND_MANY`, `*_INVOICE_MANAGE_FIND_MANY`, `*_SCHOOL_STUDENT_FIND_MANY`, `*_PRODUCT_BILLING_ACCESS_FIND_MANY`).
  - `variables` are validated only while the file is built: an unknown field, a wrong enum value or a missing `filter` does not fail `generate` but ends the export with `status: Failed` (no reason returned). Only an unknown `type`/`format` or non-object `variables` gives `400 validation`.
  - Rights (any of), checked while the file is built — without them `generate` still returns `201`, the export ends `Failed`: SCHOOL_USER — `SchoolManageUsers`; SCHOOL_STUDENT, PRODUCT_BILLING_ACCESS — `SchoolManageUsers`|`CourseStudentManage`; GROUP_MEMBER — `SchoolManageUsers`|`CourseManage`|`CourseCurator`; COURSE_LESSON_PRACTICE_ATTEMPT — `CourseManage`|`CourseCurator`; INVOICE_MANAGE — `SellerSales`.
- **workflow-execution/:executionUuid/result** (polling every 2–5 s, no extra rights). Response: `{ total, completed, status, result? }` or `null` (not started yet — keep polling; unknown uuid; or result expired 24 h after completion). On completion `result = { fileUrl, fileName, fileSize }` (+ internal `result` object); `fileUrl` needs no auth and may be short-lived — download right away.

## Entities (compact, public zod schemas)

Common audit fields on most entities: `id, createdAt, updatedAt, deletedAt?, archivedAt?`. Dates — ISO 8601, money — numbers.

- **user**: `+ uuid, status(Active|OnLeave|Banned|Blocked|Terminated|Deleted — source of truth), active(derived: not Deleted), activated, banned(derived: Banned|Deleted), alive?(status is non-blocking), domain, email?, phone?, tgId?, vkId?, appleId?, extId?, schoolId?, language?(Ru|Uz|En|Qa), timezone?, lastOnlineAt?, createdOnDomain(Ru|Uz|Kz|Biz|Global), product(BizSchool|Marketplace), starsBalance, permissions[]`. `userWithProfile = user + profile?`.
- **profile**: `+ userId?, official, firstName?, lastName?, fullName?, fullNameShort?, avatar, bdate?, sex(Ufo|Women|Men), country?, city?, role(Student|Tutor|Parent), status?, title?, emojiTitle?, titleState{...}`.
- **session**: `+ uuid, userId?, deviceUuid, token, alive, isOnline, launcher, appLocation?, appLocationParams, appVersion?, language?, timezone?, lastActivityAt?, expireAt?`.
- **staffDepartment**: `+ schoolId, parentId?(null = root), extId?, name`.
- **staffPosition**: `+ schoolId, name (unique per school), extId?`.
- **staffEmployment**: `+ schoolId, userId, departmentId, positionId?(null = no position), extId?, startAt, finishAt?, status(Active|Terminated), kind(Main|InternalSecondary|ExternalSecondary), type(FullTime|PartTime), rate(0.01..1)`.
- **staffDepartmentManager**: `+ schoolId, departmentId, employmentId, isPrimary, extId?`.
- **staffAbsence**: `+ schoolId, employmentId, extId?, type(Absent|Vacation|DayOff|BusinessTrip|SickLeave|ParentalLeave|StudyLeave), startAt, finishAt?, note?`.
- **group**: `+ uuid, space(Education), name, order?, maxMembers?, communication, accessLimitation, scheduleLimitation, contentLimitation, isTgConnected?, tgConnectionMode?(Disconnected|Connected|Required)`.
- **groupMember**: `+ groupId?, userId?, inviterId?, active, blockedUntil?, isAddedToTg?, tgChannelMeta?, tgGroupChatMeta?, user?`.
- **course**: `+ type(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), productId?, contentCategoryId?(reserved, currently never filled), buildStatus(Ready|AiGenerating — AiGenerating = being built by the AI wizard, hidden from everyone but the author), name, description, alias?, tags[], seoTags[], image?{main}, promoVideo?, settings, order, isBundle?`.
- **courseProgress**: `+ courseId?, userId, lessonId, status?, scheduleStartAt?, scheduleFinishAt?, practiceDeadlineAt?, isCompleted?, isOnReview?, completedAt?, onReviewAt?, statusHistoryLogs?`.
- **certificate**: `+ uuid, link (public URL), userId, courseId, templateId, snapshot, issuedAt, expireAt?`.
- **courseLesson**: `+ courseId, type(Regular|Webinar), accessType(Demo|Participant), status?, name, description, previewImage?, order, withContent, withPractice, publishedAt?, settings, isPublished?`.
- **courseLessonPractice**: `+ name, description, questionMode, resultMode, variantMode, retryVariantMode, maxAttempts?, timeLimitInMinutes?, deadlineInDays?, passThreshold?, starsPerTaskPoint?, requireAllAnswers, tasksCount`.
- **courseLessonPracticeAttempt**: `+ uuid?, variantId, userId, status?(Created|OnReview|OnCorrection|AutoVerified|Verified|Failed|Stacked), order, finished, sentToReviewAt?, sentAfterDeadline, deadlineAt?, passedAt?, solvedCount, pointsAmount, maxPointsAmount, uncounted, isPassed?, correctPercent?, isExpired?, statusHistoryLogs?`.
- **product**: `+ sellerId, type(Course|School|Digital), status?(Draft|OnCheck|Declined|ReadyToPublish|Published), currency(Free|Exes|Rub|Uzs|Kzt|Usd|Eur), name?, showInCatalog, approves[](Certified|Recommended), domains[], publishedAt?, saleStartAt?, saleFinishAt?, isFree?, isPublished?`.
- **productAccess**: `+ productId, parentId?, active, deactivatedAt?, expireAt?, billingIsActive?`.
- **productPrice**: `+ mode(AccordingToGroup|SelfDefinition), type(Demo|OneTime|Installment|Subscription|ExternalLink), title?, description?, amount, previousAmount?, accessDays?, infinityAccess, active, hidden, activeFrom?, activeTo?, meta, installmentConfig?, subscriptionConfig?, isDemo?, isRecurrent?, isInstallment?, isSubscription?`.
- **discount**: `+ code, type(Amount|Percent), value, currency, active, activeFrom?, activeTo?`.
- **payment**: `+ uuid, type(OneTime|RecurrentPay|RecurrentInit), status?(Created|WaitingPay|WaitingForBinding|Processing|Completed|BindingCompleted|Canceled), released, checkoutPaymentId?, checkoutUrl?, paidAt?, expireAt?, isCompleted?, isCanceled?, meta?, webhookLogs?, chargeLogs?, statusHistoryLogs?, acquiring?, invoice?`.
- **invoice**: `+ uuid, humanId?, type(Regular|InstallmentPay|InstallmentInit|SubscriptionPay|SubscriptionInit), status?(Active|Canceled), totalAmount, discountAmount, currency, expireAt?, isActive?, user?(+school?), products?[]`.
- **invoiceProduct**: `+ originalPrice, totalPrice, discountAmount, price?(productPrice), discount?(discount), product?(product+course?)`.
- **acquiring**: `{ id, uuid, active?, name?, description?, hasProviderCommission?, provider?{id,type?,active?} }` (without provider secrets).
- **school**: `+ name, description?, segment(Commerce|Corporate), accessType(Public|Private), domainType(Base|Custom), baseDomain, customDomain?, domain?, fqdn?, baseFqdn?, publicUrl?, iconUrl?, active, isPublic?, isPrivate?`.
- **seller**: `+ type(Tutor|School|Producer|University), active, verified, balance, payoutBalance, baseCurrency, isSchool?, organization?`.
- **organization**: `+ form, name, organizationName?, selfEmployedName?, inn?, ogrn?, logo?, address?, isOrganization?`.
- **formLayout**: `+ uuid, slug, name, internalName?, note?, mode(Form|Signup|Custom|Welcome|Participant), status?(Draft|Published), config, sellerId, isEdited?`.
- **formFieldValue**: `+ userId, fieldId, fillId?, value?, text?, number?, boolean?, date?, json?, field?{ id, slug?, type?(Text|File|Json|Date|Radio|Switch|Number|Select|Boolean|Textarea|Checkbox|Multiselect), order?, layoutId?, props?, preference?, permissions?{read{api,user,manager},write{api,user,manager}} }`.

## Webhooks (outbound)

- **Delivery:** HTTP `POST`, `Content-Type: application/json`. Body: `{ event, timestamp(ISO), idempotencyKey, data }`.
- **Signature:** header `signature` = `HMAC-SHA256(secretKey, raw_body)` (the entire body is signed). `secretKey` is used as a literal ASCII/UTF-8 string of 64 characters, without decoding from hex/base64. The result is 64 lowercase hex characters without a `sha256=` prefix. The secret is in the webhook settings in the admin panel.
- **Test delivery:** a saved endpoint uses the same `secretKey` and algorithm as production events — no separate verification logic is needed. An unsaved endpoint has no permanent secret yet, so save the endpoint first for a verifiable test.
- **Success:** `200|201|202`. **Timeout:** 15s. **Attempts:** up to 5 in total (first + 4 retries, delays ≈11/33/77/165 min). An endpoint with no successful delivery for 14 days in a row is auto-disabled (`active=false`) and the seller owner is notified. Endpoints are managed only in the admin panel (**Manage → School → Webhooks**; RU UI: «Управление → Школа → Вебхуки»), not via the SaaS API. Order is not guaranteed; dedupe by `idempotencyKey`. Maximum 5 endpoints per seller.
- **Events and `data`:**
  - `UserSignedUp` / `UserAcquainted`: `{ user, profile?, states?{utmSignupParams?} }`.
  - `UserTgConnected`: `{ user, profile?, prevTgId? }`.
  - `UserCreatedViaLms`: `{ user, profile? }` — a school employee created the user (admin panel, bulk import, API `user/create`, or `user/upsert` when it creates rather than updates). Self sign-up arrives as `UserSignedUp`.
  - `CourseProgressChanged`: `{ user, course, product?, access?, groups?, states?{utmSignupParams?, utmEnrollParams?}, status?, lessonId? }`.
  - `CourseCompleted`: `{ user, course, product?, access?, groups?, states? }`.
  - `CourseLessonPracticeCompleted`: `{ user, course?, lesson?, practice?, attempt?, variantId? }`.
  - `CertificateIssued`: `{ user, course, product?, certificate }` — certificate issued for a completed course.
  - `PaymentCompleted`: `{ payment }` (with the invoice/products/acquiring tree). Sent only on an actual charge: card binding (recurrent init, `BindingCompleted`) does not trigger it.
  - `ProductEnrolledToFree` / `ProductEnrolledViaLms` / `ProductEnrolledViaPayment`: `{ user, profile?, access?, product?, course?, states?{utmSignupParams?, utmEnrollParams?} }`.
  - `ProductEnrolledByInviteLink`: `{ user, profile?, access?, product?, course?, states?, inviteLinkId }` — enrollment via an invite link. Arrives **together with** `ProductEnrolledToFree` (the link grants free access); distinguished by the presence of `inviteLinkId`.
  - `SchoolCreated`: `{ school(+seller?) }` — system level only (not available for seller subscription).
- **UTM attribution:** signup utm — `states.utmSignupParams` (`UserSignedUp`/`UserAcquainted`); enrollment utm — `states.utmEnrollParams` (duplicated in `access.meta.utmParams`, plus `access.meta.inviteLinkId`) in every event carrying `access`; `access.metaHistoryLogs` is not exposed; invoice utm — `payment.invoice.meta.utmParams` (`PaymentCompleted`). UTM keys: `utm_source|utm_medium|utm_campaign|utm_term|utm_content|gclid|fbclid|yclid|referrer|aff_id|sub_id|track_id`.

## Analytics target events (frontend, not REST API)

The platform dispatches target events in the student's browser as DOM `CustomEvent`s and forwards them automatically to ad platforms whose snippet is pasted into the school **custom code** (For developers → Custom code, HTML tab) — Meta Pixel, Google Analytics (GA4), Yandex Metrika, VK Ads; no extra code needed. Any other platform can subscribe itself: `document.addEventListener('<event>', e => ...)`. Docs: `en/analytics/`.

- `analytics:signup-completed` — new account via email/phone (not sent for social/OTP sign-in). `detail: { method: 'email'|'phone' }`.
- `profile:personal-info-filled-success` — onboarding form completed (lead). No `detail`.
- `analytics:course-viewed` — course page view. `detail: { courseId }`.
- `analytics:demo-lesson-opened` — demo lesson opened from the course page. `detail: { courseId, lessonId }`.
- `analytics:free-course-enrolled` — free course enrollment. `detail: { productId }`.
- `analytics:checkout-initiated` — checkout started (price plan selected). `detail: { productId, priceId }`.
- `analytics:purchase-completed` — successful invoice payment, sent **once per invoice** (deduped by invoice uuid for 90 days on the device; not sent if the page is opened later than 5 minutes after payment on another device). `detail: { value, currency(Rub|Uzs|Kzt|Usd|Eur|Exes|Free), invoiceUuid, productIds[] }`.
- `analytics:course-completed` — course completed. `detail: { productId }`.

Documentation (Mintlify): see `docs.json` and the `en/exode-api/` directory.
