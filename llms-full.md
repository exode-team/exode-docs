# Exode SaaS API — сводный справочник (для LLM)

Машиночитаемый обзор Exode SaaS API: соглашения, все методы, параметры, формы ответов, сущности и вебхуки.
Полная документация — в каталоге `ru/exode-api/`. Источник истины — серверные zod-схемы (`shared/schemas`).

> Есть официальный npm-SDK `@exode-team/sdk` (типизированный клиент REST API + bridge мини-приложений).
> Справочник для LLM: `ru/exode-sdk/llms.txt`. npm: https://www.npmjs.com/package/@exode-team/sdk

## Базовые соглашения

- **Base URL:** `https://api.exode.biz`. Префикс всех методов: `/saas/v2`.
- **Аутентификация:** заголовок `Authorization: Bearer <TOKEN>` — токен сервисного пользователя (API-клиента).
- **Обязательные заголовки:** `Authorization`, `Seller-Id`, `School-Id`.
- **Ответ (успех):** `{ "success": true, "code": <200..206>, "payload": <данные> }`.
- **Ответ (ошибка):** `{ "success": false, "code": <4xx/5xx>, "cause": "<код>", "message": "<текст>", "error": "<текст>", "data": <опц.> }`.
  - Типичные `cause`: `validation` (400), `Unauthorized` (401, нет/неверный токен), `Blocked` (401, юзер забанен), `Forbidden` (401 — нет доступа к продавцу/школе; 403 — нет права RBAC), `Rate` (429).
- **Rate-limit:** при превышении — HTTP `429`, `cause:"Rate"`, `data.retryAfter` (дата). Лимит — по токену.
- **Пагинация** (списочные методы): query `take` (1–1000, по умолчанию 100), `page` (≥1), `skip` (≥0; игнорируется при `page`).
  - Тело страницы: `{ items[], page, count, pages, isFirst, isLast, next:{skip,take,page}, prev:{skip,take,page} }`.
- **Массивы** в query — повтором ключа: `userIds=1&userIds=2`. **Диапазоны** — объект `{ from, to }`.
- **RBAC:** при нескольких правах у метода достаточно любого одного (OR). Признак API-клиента у токена обязателен для всех SaaS-методов.

## Сводная таблица методов

| Метод | Путь | Назначение | Право (RBAC) | Лимит | Документация |
|---|---|---|---|---|---|
| POST | `/saas/v2/user/create` | Создать пользователя | `SchoolManageUsers` | — | `ru/exode-api/school/user/create` |
| PUT | `/saas/v2/user/:userId/update` | Обновить пользователя | `SchoolManageUsers` | — | `ru/exode-api/school/user/update` |
| PUT | `/saas/v2/user/upsert` | Создать или обновить (по email/phone/tgId/extId) | `SchoolManageUsers` | — | `ru/exode-api/school/user/upsert` |
| GET | `/saas/v2/user/find` | Найти пользователя (login \| tgId \| extId) | `SchoolManageUsers` | — | `ru/exode-api/school/user/find` |
| DELETE | `/saas/v2/user/delete-many` | Массовое удаление (userIds ≤250, reason) | `SchoolManageUsers` | — | `ru/exode-api/school/user/delete-many` |
| PUT | `/saas/v2/user/:userId/state/set?key=` | Записать состояние по ключу | `SchoolManageUsers` | — | `ru/exode-api/school/user/state` |
| GET | `/saas/v2/user/:userId/state/get?key=` | Прочитать состояние по ключу | `SchoolManageUsers` | — | `ru/exode-api/school/user/state` |
| POST | `/saas/v2/user/session/auth-token` | Создать/получить токен сессии пользователя | `SchoolManageUsers` | — | `ru/exode-api/school/user/session/auth-token` |
| GET | `/saas/v2/group/list/raw` | Список групп | `SchoolManageUsers` | — | `ru/exode-api/school/group/list` |
| POST | `/saas/v2/group/:groupId/member/create-many` | Добавить участников (userIds ≤250) | `SchoolManageUsers` | — | `ru/exode-api/school/group-member/create-many` |
| DELETE | `/saas/v2/group/:groupId/member/delete-many` | Удалить участников (userIds ≤250) | `SchoolManageUsers` | — | `ru/exode-api/school/group-member/delete-many` |
| GET | `/saas/v2/course/list/raw` | Список курсов | `CourseCurator` \| `SchoolManageUsers` | — | `ru/exode-api/school/course/list` |
| GET | `/saas/v2/course/:courseId/progresses` | Прогресс участников по курсу | `CourseCurator` \| `SchoolManageUsers` | — | `ru/exode-api/school/course/progresses` |
| GET | `/saas/v2/invoice/list/raw` | Список счетов | `SellerSales` | — | `ru/exode-api/school/invoice/list` |
| GET | `/saas/v2/product-access/list/raw` | Список доступов к продуктам | `SchoolManageUsers` \| `CourseStudentManage` | — | `ru/exode-api/school/product-access/list` |
| POST | `/saas/v2/form/layout/create` | Создать макет формы | `FormManage` | — | `ru/exode-api/school/form-layout/create` |
| PUT | `/saas/v2/form/layout/:layoutId/update` | Обновить макет формы | `FormManage` | — | `ru/exode-api/school/form-layout/update` |
| DELETE | `/saas/v2/form/layout/:layoutId/delete` | Удалить макет формы | `FormManage` | — | `ru/exode-api/school/form-layout/delete` |
| GET | `/saas/v2/form/custom-field/value/get` | Значения кастомных полей | `FormManage` | — | `ru/exode-api/school/custom-field/get` |
| POST | `/saas/v2/form/custom-field/value/set` | Записать значения полей (по fieldId) | `FormManage` | — | `ru/exode-api/school/custom-field/set` |
| POST | `/saas/v2/form/custom-field/value/set-by-slug` | Записать значения полей (по slug) | `FormManage` | — | `ru/exode-api/school/custom-field/set` |
| POST | `/saas/v2/query-export/generate` | Создать асинхронную выгрузку | auth (API-клиент) | 100/час | `ru/exode-api/school/query-export/generate` |
| GET | `/saas/v2/workflow-execution/:executionUuid/result` | Результат выгрузки (polling) | auth (API-клиент) | — | `ru/exode-api/school/query-export/result` |

## Параметры и ответы по методам

### Users
- **create** (body `CreateUserInput`): `email?`, `phone?` (междунар.), `tgId?`, `extId?` (≤50), `banned?`, `profile?` `{ firstName?(≤15), lastName?(≤15), bdate?(YYYY-MM-DD), sex?(Ufo|Women|Men), role?(Student|Tutor|Parent), contact?{phone,email,messengerUrl} }`. Ответ: `{ user: userWithProfile }`.
- **update** (path `userId`, body `UpdateUserInput` — все поля create опциональны). Ответ: `{ user }`.
- **upsert** (body `UpdateUserInput`). Ответ: `{ user, isCreated: boolean }`.
- **find** (query): ровно одно из `login`(2..50) | `tgId` | `extId`(1..50). Ответ: `{ user | null }`.
- **delete-many** (body): `userIds: number[] (≤250)`, `reason: string (≤256)`. Ответ: `{ deleted: number[], skipped: number[] }`.
- **state set** (path `userId`, query `key`, body `{ value }`). Ответ: `{ set: boolean }`.
- **state get** (path `userId`, query `key`). Ответ: `{ value: any | null }`.
  - Ключи на запись: `UtmSignupParams`, `PersonalInfoFilled`, `OnBoardingProgress`, `ContentCategoryIds`. На чтение дополнительно `VkToken` (маскируется). Прочие → `Not allowed key`.
- **session/auth-token** (body `CreateSessionInput`): `userId: number`, `forceCreate?: boolean`. Ответ: `{ session, isCreated: boolean }`.

### Group
- **list/raw** (query `FilterGroupInput`, все опц.): `groupIds[]`, `productIds[]`, `courseIds[]`, `search`(≤50) + пагинация. Ответ items: `{ groupId, name, courseId?, courseName? }`.
- **member/create-many** (body `userIds[] ≤250`). Ответ: `{ exist: groupMember[], created: groupMember[] }`.
- **member/delete-many** (body `userIds[] ≤250`). Ответ: `{ affected: number }`.

### Course
- **list/raw** (query `FilterCourseInput`, все опц.): `courseIds[]`, `aliases[]`, `types[]`(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), `tags[]`, `search`(≤50), `subjectCategoryIds[]`, `contentCategoryIds[]`, `archived`, `participation`(All|Active|Completed|NotParticipant), `manage`, `administrate`, `access`(=FilterAccessProductInput), `product`(FilterProductInput) + пагинация. Ответ items: `{ courseId, name, type, groupIds[] }`.
- **:courseId/progresses** (query — пагинация; фильтр по courseId фиксируется сервером). Ответ items: `courseProgress` (см. сущности).

### Invoice
- **list/raw** (query `FilterInvoiceInput`, все опц.): `invoiceIds[]`, `userIds[]`, `productIds[]`, `types[]`(Regular|InstallmentPay|InstallmentInit|SubscriptionPay|SubscriptionInit), `search`(≤50), `createdAtDateRange{from,to}`, `totalAmountRange{from,to}`, `utmParams{value:[{key,value}]}`, `payment{paymentIds[],acquiringIds[],statuses[],actualStatuses[]}` + пагинация. Ответ items: `{ invoiceId, invoiceUuid, type, status(Active|Canceled), totalAmount, discountAmount, currency, createdAt, expireAt?, user{id,tgId?,login?,email?,phone?,fullName?}, products[{productId,courseId?,totalPrice,discountAmount}] }`.

### ProductAccess
- **list/raw** (query `FilterAccessProductInput`, все опц.): `accessIds[]`, `active`, `userIds[]`, `enrolledByUserIds[]`, `participantCuratorIds[]`, `launchIds[]`, `currentLessonIds[]`, `search`(≤50), `participantStatuses[]`(InUse|Completed), `withParent`, диапазоны `expireAtDateRange`/`createdAtDateRange`/`progressPercentRange`; биллинг: `billingActive`, `hasProductBillingTypes[]`(Installment|Subscription), `billingStatuses[]`, `billingIntervals[]`(Week|Month|Year), `billingInvoiceIds[]`, `billingAmountRange`, `billingCurrentPaymentAtDateRange`, `billingNextPaymentAtDateRange`; вложенные `product`/`price`/`user` + пагинация. Ответ items: `{ accessId, productId, courseId?, active, expireAt?, user{id,extId?,tgId?,login?,email?,phone?,fullName?} }`.

### Form
- **layout/create** (body `CreateFormLayoutInput`): `mode!`(Form|Signup|Custom|Welcome|Participant), `name!`(≤255), `internalName!`(≤255), `status?`(Draft|Published), `slug?`(1..50), `note?`(≤255), `productIds?[]`, `config?{resubmitMode(NewFill|Overwrite|NotAllowed)}`. Ответ: `formLayout`.
- **layout/:layoutId/update** (body = PartialType create). Ответ: `formLayout`.
- **layout/:layoutId/delete**. Ответ: `{ affected }`.
- **custom-field/value/get** (query `FilterFormFieldValueInput`, все опц.): `userIds[]`, `fieldIds[]`, `fieldSlugs[]`, `fillIds[]`, `layoutUuids[]`, `layoutSlugs[]`, `layoutModes[]`, `productIds[]` + сортировка `id|createdAt|updatedAt`(ASC|DESC) + пагинация. Ответ: страница `formFieldValue[]`. Поля с `read.api=false` исключаются.
- **custom-field/value/set** (body): `userId!`, `layoutId!`, `values: [{ fieldId!, text?|number?|boolean?|date?|json? }] (min 1)`. Ответ: `formFieldValue[]`.
- **custom-field/value/set-by-slug** (body): `userId!`, `layoutId!`, `values: [{ slug!, value? }] (min 1)`. Ответ: `formFieldValue[]`. Поля с `write.api=false` запрещены к записи.

### QueryExport (асинхронные выгрузки)
- **generate** (body `GenerateQueryExportInput`): `type!`(QueryExportType), `variables!`(object `{ filter, sort?, list? }`), `format?`(Xlsx|Csv|Json, default Xlsx). Лимит 100/час. Ответ: `{ uuid, flow, status(Waiting|Processing|Failed|Canceled|Completed), isCompleted, userId?, createdAt, updatedAt? }`.
  - `type` = `QUERY_EXPORT_TYPE_GROUP_MEMBER_FIND_MANY` | `QUERY_EXPORT_TYPE_COURSE_LESSON_PRACTICE_ATTEMPT_FIND_MANY` (а также `*_SCHOOL_USER_FIND_MANY`, `*_INVOICE_MANAGE_FIND_MANY`, `*_SCHOOL_STUDENT_FIND_MANY`, `*_PRODUCT_BILLING_ACCESS_FIND_MANY`).
- **workflow-execution/:executionUuid/result** (polling). Ответ: `{ total, completed, status, result? }` или `null` (если не найдено). При завершении `result = { fileUrl, fileName, fileSize }`.

## Сущности (компактно, публичные zod-схемы)

Общие поля аудита у большинства: `id, createdAt, updatedAt, deletedAt?, archivedAt?`. Даты — ISO 8601, деньги — числа.

- **user**: `+ uuid, active, activated, banned, alive?, domain, email?, phone?, tgId?, vkId?, appleId?, extId?, schoolId?, language?(Ru|Uz|En|Qa), timezone?, lastOnlineAt?, createdOnDomain(Ru|Uz|Kz|Biz|Global), product(BizSchool|Marketplace), starsBalance, permissions[]`. `userWithProfile = user + profile?`.
- **profile**: `+ userId?, official, firstName?, lastName?, fullName?, fullNameShort?, avatar, bdate?, sex(Ufo|Women|Men), country?, city?, role(Student|Tutor|Parent), status?, title?, emojiTitle?, titleState{...}`.
- **session**: `+ uuid, userId?, deviceUuid, token, alive, isOnline, launcher, appLocation?, appLocationParams, appVersion?, language?, timezone?, lastActivityAt?, expireAt?`.
- **group**: `+ uuid, space(Education), name, order?, maxMembers?, communication, accessLimitation, scheduleLimitation, contentLimitation, isTgConnected?, tgConnectionMode?(Disconnected|Connected|Required)`.
- **groupMember**: `+ groupId?, userId?, inviterId?, active, blockedUntil?, isAddedToTg?, tgChannelMeta?, tgGroupChatMeta?, user?`.
- **course**: `+ type(Bundle|Webinar|TextCourse|Assessment|VideoCourse|PersonalLesson), name, description, alias?, tags[], seoTags[], image?, promoVideo?, settings, order, isBundle?`.
- **courseProgress**: `+ courseId?, userId, lessonId, status?, scheduleStatus?(OnTimeChoose|WaitingStart|InProgress|Completed|Canceled), scheduleStartAt?, scheduleFinishAt?, practiceDeadlineAt?, isCompleted?, isOnReview?, completedAt?, onReviewAt?, statusHistoryLogs?`.
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
- **acquiring**: `{ id, uuid, active?, name?, description?, hasProviderCommission?, provider?{id,type?,active?} }` (без секретов провайдера).
- **school**: `+ name, description?, segment(Commerce|Corporate), accessType(Public|Private), domainType(Base|Custom), baseDomain, customDomain?, domain?, fqdn?, baseFqdn?, publicUrl?, iconUrl?, active, isPublic?, isPrivate?`.
- **seller**: `+ type(Tutor|School|Producer|University), active, verified, balance, payoutBalance, baseCurrency, isSchool?, organization?`.
- **organization**: `+ form, name, organizationName?, selfEmployedName?, inn?, ogrn?, logo?, address?, isOrganization?`.
- **formLayout**: `+ uuid, slug, name, internalName?, note?, mode(Form|Signup|Custom|Welcome|Participant), status?(Draft|Published), config, sellerId, isEdited?`.
- **formFieldValue**: `+ userId, fieldId, fillId?, value?, text?, number?, boolean?, date?, json?, field?{ id, slug?, type?(Text|File|Json|Date|Radio|Switch|Number|Select|Boolean|Textarea|Checkbox|Multiselect), order?, layoutId?, props?, preference?, permissions?{read{api,user,manager},write{api,user,manager}} }`.

## Вебхуки (исходящие)

- **Доставка:** HTTP `POST`, `Content-Type: application/json`. Тело: `{ event, timestamp(ISO), idempotencyKey, data }`.
- **Подпись:** заголовок `signature` = `HMAC-SHA256(secretKey, raw_body)` в hex (подписывается всё тело). Секрет — в настройках вебхука в админ-панели.
- **Успех:** `200|201|202`. **Таймаут:** 15с. **Повторы:** до 5 (~11/22/44/88/176 мин). Порядок не гарантирован; дедуп по `idempotencyKey`. Максимум 5 эндпоинтов на продавца.
- **События и `data`:**
  - `UserSignedUp` / `UserAcquainted`: `{ user, profile?, states?{utmSignupParams?} }`.
  - `UserTgConnected`: `{ user, profile?, prevTgId? }`.
  - `CourseProgressChanged`: `{ user, course, product?, groups?, status?, lessonId? }`.
  - `CourseCompleted`: `{ user, course, product?, groups? }`.
  - `CourseLessonPracticeCompleted`: `{ user, course?, lesson?, practice?, attempt?, variantId? }`.
  - `PaymentCompleted`: `{ payment }` (с деревом invoice/products/acquiring).
  - `ProductEnrolledToFree`: `{ user, profile?, access?, product?, course? }`.
  - `SchoolCreated`: `{ school(+seller?) }` — только системный уровень (не для подписки продавцом).

Документация (Mintlify): см. `docs.json` и каталог `ru/exode-api/`.
