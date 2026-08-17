# Exode SaaS API — consolidated reference (for LLMs)

Machine-readable overview of the Exode SaaS API: conventions, all methods, parameters, response shapes, entities, and webhooks.
Full documentation lives in the `ru/exode-api/` directory. Source of truth — server-side zod schemas (`shared/schemas`).

> There is an official npm SDK `@exode-team/sdk` (typed REST API client + mini-app bridge).
> LLM reference: `ru/exode-sdk/llms.txt`. npm: https://www.npmjs.com/package/@exode-team/sdk

## Base conventions

- **Base URL:** `https://api.exode.biz`. All methods are prefixed with `/saas/v2`.
- **Authentication:** header `Authorization: Bearer <TOKEN>` — token of a service user (API client).
- **Required headers:** `Authorization`, `Seller-Id`, `School-Id`.
- **Response (success):** `{ "success": true, "code": <200..206>, "payload": <data> }`.
- **Response (error):** `{ "success": false, "code": <4xx/5xx>, "cause": "<code>", "message": "<text>", "error": "<text>", "data": <opt.> }`.
  - Typical `cause` values: `validation` (400), `Unauthorized` (401, missing/invalid token), `Blocked` (401, user is banned), `Forbidden` (401 — no access to the seller/school; 403 — missing RBAC permission), `Rate` (429).
- **Rate limit:** on excess — HTTP `429`, `cause:"Rate"`, `data.retryAfter` (date). The limit is per token.
- **Pagination** (list methods): query `take` (1–1000, default 100), `page` (≥1), `skip` (≥0; ignored when `page` is set).
  - Page body: `{ items[], page, count, pages, isFirst, isLast, next:{skip,take,page}, prev:{skip,take,page} }`.
- **Arrays** in query — by repeating the key: `userIds=1&userIds=2`. **Ranges** — an object `{ from, to }`.
- **RBAC:** when a method lists several permissions, any single one is enough (OR). The API-client flag on the token is required for all SaaS methods.
- **Staff (HR) module:** available **only** to `Corporate`-segment schools (other segments get `403 Forbidden`). Reads require `StaffView`, writes require `StaffManage`. Staff records carry an optional `extId` — an external ID from the client's system (CRM/1C/HR), 1–50 chars, URL-safe (no `/` or whitespace), unique within the school among non-deleted (for employments: among open) records; `ext/{extId}` route variants address records by it (URL-encode the path value).

## Method summary table

| Method | Path | Purpose | Permission (RBAC) | Limit | Docs |
|---|---|---|---|---|---|
| POST | `/saas/v2/user/create` | Create a user | `SchoolManageUsers` | — | `ru/exode-api/school/user/create` |
| PUT | `/saas/v2/user/:userId/update` | Update a user | `SchoolManageUsers` | — | `ru/exode-api/school/user/update` |
| PUT | `/saas/v2/user/upsert` | Create or update (by email/phone/tgId/extId) | `SchoolManageUsers` | — | `ru/exode-api/school/user/upsert` |
| GET | `/saas/v2/user/find` | Find a user (login \| tgId \| extId) | `SchoolManageUsers` | — | `ru/exode-api/school/user/find` |
| POST | `/saas/v2/user/find-many` | Bulk find by lists of logins/tgIds/extIds | `SchoolManageUsers` | — | `ru/exode-api/school/user/find-many` |
| GET | `/saas/v2/user/list` | Paginated list of school users | `SchoolManageUsers` | — | `ru/exode-api/school/user/list` |
| DELETE | `/saas/v2/user/delete-many` | Bulk delete (userIds ≤250, reason) | `SchoolManageUsers` | — | `ru/exode-api/school/user/delete-many` |
| PUT | `/saas/v2/user/:userId/state/set?key=` | Write state by key | `SchoolManageUsers` | — | `ru/exode-api/school/user/state` |
| GET | `/saas/v2/user/:userId/state/get?key=` | Read state by key | `SchoolManageUsers` | — | `ru/exode-api/school/user/state` |
| POST | `/saas/v2/user/session/auth-token` | Create/get a user session token | `SchoolManageUsers` | — | `ru/exode-api/school/user/session/auth-token` |
| GET | `/saas/v2/staff/department/tree` | Flat array of all departments (hierarchy via `parentId`) | `StaffView` | — | `ru/exode-api/school/staff/department` |
| GET | `/saas/v2/staff/department/list` | Paginated department list | `StaffView` | — | `ru/exode-api/school/staff/department` |
| POST | `/saas/v2/staff/department/create` | Create a department | `StaffManage` | — | `ru/exode-api/school/staff/department` |
| PUT | `/saas/v2/staff/department/:departmentId/update` (+ `ext/:extId/update`) | Update a department | `StaffManage` | — | `ru/exode-api/school/staff/department` |
| DELETE | `/saas/v2/staff/department/:departmentId/delete` (+ `ext/:extId/delete`) | Delete a department | `StaffManage` | — | `ru/exode-api/school/staff/department` |
| GET | `/saas/v2/staff/position/list` | Paginated position list | `StaffView` | — | `ru/exode-api/school/staff/position` |
| POST | `/saas/v2/staff/position/create` | Create a position | `StaffManage` | — | `ru/exode-api/school/staff/position` |
| PUT | `/saas/v2/staff/position/:positionId/update` (+ `ext/:extId/update`) | Update a position | `StaffManage` | — | `ru/exode-api/school/staff/position` |
| DELETE | `/saas/v2/staff/position/:positionId/delete` (+ `ext/:extId/delete`) | Delete a position | `StaffManage` | — | `ru/exode-api/school/staff/position` |
| GET | `/saas/v2/staff/employment/list` | Paginated employment list | `StaffView` | — | `ru/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/hire` | Hire an employee (new active employment) | `StaffManage` | — | `ru/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/transfer` (+ `ext/:extId/transfer`) | Transfer to another department | `StaffManage` | — | `ru/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/promote` (+ `ext/:extId/promote`) | Change/remove position | `StaffManage` | — | `ru/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/employment/terminate` (+ `ext/:extId/terminate`) | Terminate an employment | `StaffManage` | — | `ru/exode-api/school/staff/employment` |
| POST | `/saas/v2/staff/department-manager/set` | Assign a department manager (upsert) | `StaffManage` | — | `ru/exode-api/school/staff/department-manager` |
| DELETE | `/saas/v2/staff/department-manager/:managerId/remove` (+ `ext/:extId/remove`) | Remove a department manager | `StaffManage` | — | `ru/exode-api/school/staff/department-manager` |
| GET | `/saas/v2/staff/absence/list` | Paginated absence list | `StaffView` | — | `ru/exode-api/school/staff/absence` |
| POST | `/saas/v2/staff/absence/create` | Create an absence | `StaffManage` | — | `ru/exode-api/school/staff/absence` |
| PUT | `/saas/v2/staff/absence/:absenceId/update` (+ `ext/:extId/update`) | Update an absence | `StaffManage` | — | `ru/exode-api/school/staff/absence` |
| DELETE | `/saas/v2/staff/absence/:absenceId/delete` (+ `ext/:extId/delete`) | Delete an absence | `StaffManage` | — | `ru/exode-api/school/staff/absence` |
| GET | `/saas/v2/group/list/raw` | List groups | `SchoolManageUsers` | — | `ru/exode-api/school/group/list` |
| GET | `/saas/v2/group/member/list/raw` | List group members | `SchoolManageUsers` | — | `ru/exode-api/school/group-member/list` |
| POST | `/saas/v2/group/:groupId/member/create-many` | Add members (userIds ≤250) | `SchoolManageUsers` | — | `ru/exode-api/school/group-member/create-many` |
| DELETE | `/saas/v2/group/:groupId/member/delete-many` | Remove members (userIds ≤250) | `SchoolManageUsers` | — | `ru/exode-api/school/group-member/delete-many` |
| GET | `/saas/v2/course/list/raw` | List courses | `CourseCurator` \| `SchoolManageUsers` | — | `ru/exode-api/school/course/list` |
| GET | `/saas/v2/course/:courseId/progresses` | Participant progress for a course | `CourseCurator` \| `SchoolManageUsers` | — | `ru/exode-api/school/course/progresses` |
| GET | `/saas/v2/certificate/list/raw` | List certificates | `CourseManage` \| `CourseStudentManage` | — | `ru/exode-api/school/certificate/list` |
| GET | `/saas/v2/invoice/list/raw` | List invoices | `SellerSales` | — | `ru/exode-api/school/invoice/list` |
| GET | `/saas/v2/product-access/list/raw` | List product accesses | `SchoolManageUsers` \| `CourseStudentManage` | — | `ru/exode-api/school/product-access/list` |
| GET | `/saas/v2/form/layout/list` | List form layouts | `FormManage` | — | `ru/exode-api/school/form-layout/list` |
| POST | `/saas/v2/form/layout/create` | Create a form layout | `FormManage` | — | `ru/exode-api/school/form-layout/create` |
| PUT | `/saas/v2/form/layout/:layoutId/update` | Update a form layout | `FormManage` | — | `ru/exode-api/school/form-layout/update` |
| DELETE | `/saas/v2/form/layout/:layoutId/delete` | Delete a form layout | `FormManage` | — | `ru/exode-api/school/form-layout/delete` |
| GET | `/saas/v2/form/custom-field/value/get` | Custom field values | `FormManage` | — | `ru/exode-api/school/custom-field/get` |
| POST | `/saas/v2/form/custom-field/value/set` | Write field values (by fieldId) | `FormManage` | — | `ru/exode-api/school/custom-field/set` |
| POST | `/saas/v2/form/custom-field/value/set-by-slug` | Write field values (by slug) | `FormManage` | — | `ru/exode-api/school/custom-field/set` |
| POST | `/saas/v2/query-export/generate` | Create an asynchronous export | auth (API client) | 100/hour | `ru/exode-api/school/query-export/generate` |
| GET | `/saas/v2/workflow-execution/:executionUuid/result` | Export result (polling) | auth (API client) | — | `ru/exode-api/school/query-export/result` |

## Parameters and responses per method

### Users
- **create** (body `CreateUserInput`): `email?`, `phone?` (international), `tgId?`, `extId?` (≤50), `status?`(Active|OnLeave|Banned|Blocked|Terminated; the `banned` field was removed, `Deleted` is system-only), `profile?` `{ firstName?(≤15), lastName?(≤15), bdate?(YYYY-MM-DD), sex?(Ufo|Women|Men), role?(Student|Tutor|Parent), contact?{phone,email,messengerUrl} }`. Response: `{ user: userWithProfile }`.
- **update** (path `userId`, body `UpdateUserInput` — all create fields optional). Response: `{ user }`. Unban: pass `status: Active` — the effective status is recalculated from employments/absences.
- **upsert** (body `UpdateUserInput`). Response: `{ user, isCreated: boolean }`.
- **find** (query): exactly one of `login`(2..50) | `tgId` | `extId`(1..50). Response: `{ user | null }`.
- **find-many** (body): at least one non-empty list of `logins[]`(each 2..50; email, international phone, or `id12345` domain), `tgIds[]`, `extIds[]`(each 1..50) — each list ≤250 items. Response: `{ users: userWithProfile[] }`. Users that were not found are simply omitted — match the result to the request by `email`/`phone`/`tgId`/`extId` on your side.
- **list** (query `FilterUserInput`, all opt.): `search`(≤50), `statuses[]`(Active|OnLeave|Banned|Blocked|Terminated|Deleted), `activated`, `archived`, `userIds[]`, `extIds[]`(≤250), `createdAtDateRange{from,to}`, `lastOnlineAtDateRange{from,to}`; sort `id|createdAt|lastOnlineAt`(ASC|DESC) + pagination. Response: page of `userWithProfile[]`. The `active`/`banned` filter fields were removed — use `statuses`.
- **delete-many** (body): `userIds: number[] (≤250)`, `reason: string (≤256)`. Response: `{ deleted: number[], skipped: number[] }`.
- **state set** (path `userId`, query `key`, body `{ value }`). Response: `{ set: boolean }`.
- **state get** (path `userId`, query `key`). Response: `{ value: any | null }`.
  - Writable keys: `UtmSignupParams`, `PersonalInfoFilled`, `OnBoardingProgress`, `ContentCategoryIds`. Additionally readable: `VkToken` (masked). Anything else → `Not allowed key`.
- **session/auth-token** (body `CreateSessionInput`): `userId: number`, `forceCreate?: boolean`. Response: `{ session, isCreated: boolean }`.

### Staff (HR) — `Corporate` schools only
- **department/tree** — returns a **flat array** of all school departments; hierarchy via `parentId` (`null` = root), build the tree client-side.
- **department/list** (query, all opt.): `parentIds[]`(≤250), `extIds[]`(≤250), `search`(≤50, by name), `createdAt`(ASC|DESC) + pagination. Item: `{ id, schoolId, parentId?, extId?, name, createdAt, updatedAt, archivedAt? }`.
- **department/create** (body): `name!`(1..100, trimmed), `extId?`, parent via `parentId` **or** `parentExtId` (exactly one of the pair; none → root), primary manager via `primaryManagerEmploymentId` **or** `primaryManagerEmploymentExtId`. Errors: `StaffDepartmentExtIdIsNotUniq`, `StaffDepartmentNotFound` (parent).
- **department/:departmentId/update** (body = create fields, all opt.). `parentId: null` makes it root; the new parent must not be the department itself or its descendant (`StaffDepartmentParentCreatesCycle`). `primaryManagerEmploymentId: null` unsets the primary manager. `ext/:extId/update` — same body, lookup by `extId` (`StaffDepartmentNotFound`).
- **department/:departmentId/delete** (also `ext/:extId/delete`). Only a leaf department with no active employees can be deleted: errors `StaffDepartmentHasChildren`, `StaffDepartmentHasActiveEmployments`. Response: `{ affected }`.
- **position/list** (query, all opt.): `search`(≤50), `extIds[]`(≤250), `createdAt`(ASC|DESC) + pagination. Item: `{ id, schoolId, name, extId?, ... }`. Position `name` is unique per school (`StaffPositionNameIsNotUniq`).
- **position/create** (body): `name!`(1..100, trimmed, unique per school), `extId?`. **position/:positionId/update** / `ext/:extId/update` — same fields, all opt. **position/:positionId/delete** / `ext/:extId/delete` — fails with `StaffPositionHasActiveEmployments` while active employees hold the position. Response: `{ affected }`.
- **employment/list** (query, all opt.): `employmentIds[]`, `extIds[]`, `userIds[]`, `departmentIds[]`, `departmentExtIds[]`, `positionIds[]`, `positionExtIds[]`, `statuses[]`(Active|Terminated), `activeOnly`, `search`(≤50) + pagination. Item: `{ id, schoolId, userId, positionId?(null = no position), departmentId, extId?, startAt, finishAt?, status(Active|Terminated), kind(Main|InternalSecondary|ExternalSecondary), type(FullTime|PartTime), rate(0.01..1), createdAt, updatedAt }`.
- **employment/hire** (body): `userId!`, department via `departmentId`/`departmentExtId` (exactly one, required), position via `positionId`/`positionExtId` (optional pair — omit both to hire without a position), `extId?`, `startAt?`(ISO, default now), `kind?`(default Main), `type?`(default FullTime), `rate?`(default 1). Only one active employment per department+position pair (or department+user when positionless) — else `StaffEmploymentAlreadyExists`. Hiring a `Terminated` user returns them to `Active`. Errors: `StaffEmploymentExtIdIsNotUniq`, `StaffPositionNotFound`, `StaffDepartmentNotFound`, `UserNotBelongsToSchool`.
- **employment/transfer** (body): `employmentId!`, target via `toDepartmentId`/`toDepartmentExtId` (exactly one), `startAt?` (must fall inside the current employment interval — else `StaffEmploymentInvalidTransitionDate`). Closes the current record (`finishAt`, status `Terminated`) and creates a **new** active one in the target department, keeping the position; `kind`/`type`/`rate`/`extId` carry over. Returns the new record. `ext/:extId/transfer` — same body without `employmentId`.
- **employment/promote** (body): `employmentId!`, target via `toPositionId`/`toPositionExtId` (exactly one), or `toPositionId: null` to **remove** the position; passing neither → `StaffEmploymentInputRequired`. `startAt?` as in transfer. Same close-and-recreate semantics, in the same department. `ext/:extId/promote` — same body without `employmentId`.
- **employment/terminate** (body): `employmentId!`, `finishAt?` (inside the interval). Closes the record and removes the employee from department management. Terminating the **last active** employment switches the user to status `Terminated` (login blocked, sessions ended); re-hiring restores `Active`. Protections on the last employment: `StaffCannotTerminateSelf`, `StaffCannotTerminateSchoolOwner`. `ext/:extId/terminate` — same body without `employmentId`.
- **department-manager/set** (body): department via `departmentId`/`departmentExtId`, employment via `employmentId`/`employmentExtId` (exactly one field per pair; employment must be active), `extId?`, `isPrimary?`(default false). Works as an upsert per department+employment pair. A department has at most one primary manager: `isPrimary=true` demotes the previous primary automatically. Errors: `StaffDepartmentNotFound`, `StaffEmploymentNotFound`, `StaffDepartmentManagerExtIdIsNotUniq`.
- **department-manager/:managerId/remove** (also `ext/:extId/remove`, error `StaffDepartmentManagerNotFound`) — soft-deletes the manager record. Response: `{ affected }`.
- **absence/list** (query, all opt.): `extIds[]`, `employmentIds[]`, `positionIds[]`, `types[]`(Absent|Vacation|DayOff|BusinessTrip|SickLeave|ParentalLeave|StudyLeave), `currentOnly` + pagination. Item: `{ id, schoolId, employmentId, extId?, type, startAt, finishAt?, note?, createdAt, updatedAt }`.
- **absence/create** (body): employment via `employmentId`/`employmentExtId` (exactly one), `type!`, `startAt!`(ISO, ≤ `finishAt` — else `StaffAbsenceInvalidInterval`), `finishAt?`, `note?`(≤500, trimmed), `extId?`. **absence/:absenceId/update** / `ext/:extId/update` — same fields, all opt.; the employment link cannot be changed. **absence/:absenceId/delete** / `ext/:extId/delete` — response `{ affected }`; error `StaffAbsenceNotFound`.
  - Absences auto-sync the user status `Active` ↔ `OnLeave` (informational — does not block login); recalculated on API calls and hourly against the calendar. Users in `Banned`/`Blocked`/`Terminated` are not affected.

### Group
- **list/raw** (query `FilterGroupInput`, all opt.): `groupIds[]`, `productIds[]`, `courseIds[]`, `search`(≤50) + pagination. Item: `{ groupId, name, courseId?, courseName? }`.
- **member/list/raw** (query `FilterMemberGroupInput`, all opt.): `groupIds[]`, `userIds[]`, `memberIds[]`, `inviterUserIds[]`, `productIds[]`, `active`, `search`(≤50, by login/name), `createdAtDateRange{from,to}` + pagination. Item: `{ id, groupId, groupName, userId, inviterId?, active, blockedUntil?, enrollmentSource(Manual|System|Automatic), tgChannelMeta?, tgGroupChatMeta?, createdAt, updatedAt, archivedAt?, user?(userWithProfile), inviter?(userWithProfile) }`.
- **member/create-many** (body `userIds[] ≤250`). Response: `{ exist: groupMember[], created: groupMember[], excluded: user[] }`. `excluded` is always empty for this method (exclusions only restrict automatic assignment); manual adding **clears** a previously set exclusion.
- **member/delete-many** (body `userIds[] ≤250`). Response: `{ affected: number }`. The removal counts as manual and **blocks** subsequent automatic assignment of the user to this group (exclusion with reason "removed manually"); cleared by re-adding via `member/create-many`. Relevant only for corporate groups with auto-assignment configured.

### Course
- **list/raw** (query `FilterCourseInput`, all opt.): `courseIds[]`, `aliases[]`, `types[]`(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), `tags[]`, `search`(≤50), `subjectCategoryIds[]`, `contentCategoryIds[]`, `archived`, `participation`(All|Active|Completed|NotParticipant), `manage`, `administrate`, `access`(=FilterAccessProductInput), `product`(FilterProductInput) + pagination. Item: `{ courseId, name, type, groupIds[] }`.
- **:courseId/progresses** (query — pagination; the courseId filter is fixed server-side). Items: `courseProgress` (see entities).
- **Course enrollment:** there is no dedicated endpoint — enroll a user by adding them to a group tied to the course: find the group via `group/list/raw` with `courseIds`, then call `group/:groupId/member/create-many`. Access records are created automatically. Docs: `ru/exode-api/school/course/enroll`.

### Certificate
- **list/raw** (query `FilterCertificateInput`, all opt.): `certificateIds[]`, `courseIds[]`, `userIds[]`, `groupIds[]` (groups of the recipient, not of the certificate), `issuedAtDateRange{from,to}`, `archived` + pagination. Item: `{ certificateId, uuid, link, courseId, courseName?, issuedAt, expireAt?, user?(userWithProfile) }`. `link` is a public certificate URL (opens without authentication).

### Invoice
- **list/raw** (query `FilterInvoiceInput`, all opt.): `invoiceIds[]`, `userIds[]`, `productIds[]`, `types[]`(Regular|InstallmentPay|InstallmentInit|SubscriptionPay|SubscriptionInit), `search`(≤50), `createdAtDateRange{from,to}`, `totalAmountRange{from,to}`, `utmParams{value:[{key,value}]}`, `payment{paymentIds[],acquiringIds[],statuses[],actualStatuses[]}` + pagination. Item: `{ invoiceId, invoiceUuid, type, status(Active|Canceled), totalAmount, discountAmount, currency, createdAt, expireAt?, user{id,tgId?,login?,email?,phone?,fullName?}, products[{productId,courseId?,totalPrice,discountAmount}] }`.

### ProductAccess
- **list/raw** (query `FilterAccessProductInput`, all opt.): `accessIds[]`, `active`, `userIds[]`, `enrolledByUserIds[]`, `participantCuratorIds[]`, `launchIds[]`, `currentLessonIds[]`, `search`(≤50), `participantStatuses[]`(InUse|Completed), `withParent`, ranges `expireAtDateRange`/`createdAtDateRange`/`progressPercentRange`; billing: `billingActive`, `hasProductBillingTypes[]`(Installment|Subscription), `billingStatuses[]`, `billingIntervals[]`(Week|Month|Year), `billingInvoiceIds[]`, `billingAmountRange`, `billingCurrentPaymentAtDateRange`, `billingNextPaymentAtDateRange`; nested `product`/`price`/`user` + pagination. Item: `{ accessId, productId, courseId?, active, expireAt?, user{id,extId?,tgId?,login?,email?,phone?,fullName?} }`.

### Form
- **layout/list** (query `FilterFormLayoutInput`, all opt.): `layoutIds[]`, `layoutUuids[]`, `slugs[]`, `modes[]`(Form|Signup|Custom|Welcome|Participant), `statuses[]`(Draft|Published), `productIds[]`, `search`(≤50); sort `id|createdAt`(ASC|DESC) + pagination. Response: page of `formLayout[]`.
- **layout/create** (body `CreateFormLayoutInput`): `mode!`(Form|Signup|Custom|Welcome|Participant), `name!`(≤255), `internalName!`(≤255), `status?`(Draft|Published), `slug?`(1..50), `note?`(≤255), `productIds?[]`, `config?{resubmitMode(NewFill|Overwrite|NotAllowed)}`. Response: `formLayout`.
- **layout/:layoutId/update** (body = PartialType create). Response: `formLayout`.
- **layout/:layoutId/delete**. Response: `{ affected }`.
- **custom-field/value/get** (query `FilterFormFieldValueInput`, all opt.): `userIds[]`, `fieldIds[]`, `fieldSlugs[]`, `fillIds[]`, `layoutUuids[]`, `layoutSlugs[]`, `layoutModes[]`, `productIds[]` + sort `id|createdAt|updatedAt`(ASC|DESC) + pagination. Response: page of `formFieldValue[]`. Fields with `read.api=false` are excluded.
- **custom-field/value/set** (body): `userId!`, `layoutId!`, `values: [{ fieldId!, text?|number?|boolean?|date?|json? }] (min 1)`. Response: `formFieldValue[]`.
- **custom-field/value/set-by-slug** (body): `userId!`, `layoutId!`, `values: [{ slug!, value? }] (min 1)`. Response: `formFieldValue[]`. Fields with `write.api=false` reject writes.

### QueryExport (asynchronous exports)
- **generate** (body `GenerateQueryExportInput`): `type!`(QueryExportType), `variables!`(object `{ filter, sort?, list? }`), `format?`(Xlsx|Csv|Json, default Xlsx). Limit 100/hour. Response: `{ uuid, flow, status(Waiting|Processing|Failed|Canceled|Completed), isCompleted, userId?, createdAt, updatedAt? }`.
  - `type` = `QUERY_EXPORT_TYPE_GROUP_MEMBER_FIND_MANY` | `QUERY_EXPORT_TYPE_COURSE_LESSON_PRACTICE_ATTEMPT_FIND_MANY` (also `*_SCHOOL_USER_FIND_MANY`, `*_INVOICE_MANAGE_FIND_MANY`, `*_SCHOOL_STUDENT_FIND_MANY`, `*_PRODUCT_BILLING_ACCESS_FIND_MANY`).
- **workflow-execution/:executionUuid/result** (polling). Response: `{ total, completed, status, result? }` or `null` (not found). On completion `result = { fileUrl, fileName, fileSize }`.

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
- **course**: `+ type(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), name, description, alias?, tags[], seoTags[], image?, promoVideo?, settings, order, isBundle?`.
- **courseProgress**: `+ courseId?, userId, lessonId, status?, scheduleStartAt?, scheduleFinishAt?, practiceDeadlineAt?, isCompleted?, isOnReview?, completedAt?, onReviewAt?, statusHistoryLogs?`.
- **certificate**: `+ uuid, link (public URL), userId, courseId, templateId?, snapshot, issuedAt, expireAt?`.
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
- **Success:** `200|201|202`. **Timeout:** 15s. **Retries:** up to 5 (~11/22/44/88/176 min). Order is not guaranteed; dedupe by `idempotencyKey`. Maximum 5 endpoints per seller.
- **Events and `data`:**
  - `UserSignedUp` / `UserAcquainted`: `{ user, profile?, states?{utmSignupParams?} }`.
  - `UserTgConnected`: `{ user, profile?, prevTgId? }`.
  - `CourseProgressChanged`: `{ user, course, product?, groups?, status?, lessonId? }`.
  - `CourseCompleted`: `{ user, course, product?, groups? }`.
  - `CourseLessonPracticeCompleted`: `{ user, course?, lesson?, practice?, attempt?, variantId? }`.
  - `CertificateIssued`: `{ user, course, product?, certificate }` — certificate issued for a completed course.
  - `PaymentCompleted`: `{ payment }` (with the invoice/products/acquiring tree). Sent only on an actual charge: card binding (recurrent init, `BindingCompleted`) does not trigger it.
  - `ProductEnrolledToFree`: `{ user, profile?, access?, product?, course? }`.
  - `ProductEnrolledByInviteLink`: `{ user, profile?, access?, product?, course?, inviteLinkId }` — enrollment via an invite link. Arrives **together with** `ProductEnrolledToFree` (the link grants free access); distinguished by the presence of `inviteLinkId`.
  - `SchoolCreated`: `{ school(+seller?) }` — system level only (not available for seller subscription).

## Analytics target events (frontend, not REST API)

The platform dispatches target events in the student's browser as DOM `CustomEvent`s and forwards them automatically to ad platforms whose snippet is pasted into **Custom Code (JS)** in the school settings — Meta Pixel, Google Analytics (GA4), Yandex Metrika, VK Ads; no extra code needed. Any other platform can subscribe itself: `document.addEventListener('<event>', e => ...)`. Docs: `ru/analytics/`.

- `analytics:signup-completed` — new account via email/phone (not sent for social/OTP sign-in). `detail: { method: 'email'|'phone' }`.
- `profile:personal-info-filled-success` — onboarding form completed (lead). No `detail`.
- `analytics:course-viewed` — course page view. `detail: { courseId }`.
- `analytics:demo-lesson-opened` — demo lesson opened from the course page. `detail: { courseId, lessonId }`.
- `analytics:free-course-enrolled` — free course enrollment. `detail: { productId }`.
- `analytics:checkout-initiated` — checkout started (price plan selected). `detail: { productId, priceId }`.
- `analytics:purchase-completed` — successful invoice payment, sent **once per invoice** (deduped by invoice uuid for 90 days on the device; not sent if the page is opened later than 5 minutes after payment on another device). `detail: { value, currency(Rub|Uzs|Kzt|Usd|Eur|Exes|Free), invoiceUuid, productIds[] }`.
- `analytics:course-completed` — course completed. `detail: { productId }`.

Documentation (Mintlify): see `docs.json` and the `ru/exode-api/` directory.
