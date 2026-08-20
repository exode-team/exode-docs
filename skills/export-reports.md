---
name: exode-export-reports
description: Export data from an Exode school into a report file — students, users, group members, invoices/payments, practice attempts, product/billing accesses — via the query-export API or direct list endpoints, ending with a CSV/Excel file delivered to the user. Use when a user asks to export/unload data from their Exode school ("выгрузи всех студентов", "все оплаты за месяц", "отчёт по попыткам") into CSV/Excel or a report.
---

# Export Exode school data into a report file

You are an engineer producing a data export for an Exode school owner who may be
non-technical. Your job: pick the right report, confirm the filters, run the
generate → poll flow, and hand the user a file that opens cleanly in Excel.

## First: detect where you are running

- **Mode A — agent on the user's computer** (Claude Code, Cursor, any CLI agent).
  Run every request yourself with `curl` or a small script, download the file into
  the user's folder (e.g. `~/Downloads` or the current directory), and tell them
  where it is.
- **Mode B — cloud agent with its own sandbox.** Run the requests yourself, download
  the file into the sandbox, then deliver it to the user through your environment's
  file-output mechanism (attach/share the file). If you cannot hand files over,
  give the user the `fileUrl` from the result — it is a direct download link.
- **Mode C — plain chat, no command execution.** Turn each step into exact
  copy-paste `curl` commands (Terminal on macOS, PowerShell on Windows), one at a
  time, and wait for the pasted output before continuing. The final `fileUrl` is a
  normal https link — the user opens it in the browser and the file downloads.

Unsure? Try `node -v` or `curl --version`: executable → Mode A/B, not → Mode C.

## Credentials (compact recap — full guide in `integrate-exode-api.md`, skill `exode-api-integration`)

- Base URL: `https://api.exode.biz/saas/v2`
- Headers on every request: `Authorization: Bearer <TOKEN>`, `Seller-Id`, `School-Id`
  (plus `Content-Type: application/json` on POST).
- Every response uses the envelope `{ "success": bool, "code": number, "payload": ... }`;
  errors add `cause`, `message`, and optional `data`.
- The token comes from the school admin panel: **Управление → Школа → API-ключи**
  (`/manage/school/api-keys`). Keep it in an env var (`EXODE_TOKEN`). Never print it
  back into the chat; in Mode C tell the user to paste it into the command themselves.

## Step 1. Choose the report — decision guide

All six exports go through one endpoint, `POST /query-export/generate`, differing
only by `type`. Map the user's request:

| User asks for | `type` |
|---|---|
| "выгрузи всех студентов" — students with course progress, groups, curators, tariffs | `QUERY_EXPORT_TYPE_SCHOOL_STUDENT_FIND_MANY` |
| "все пользователи школы" — users with profile, contacts, statuses, activity | `QUERY_EXPORT_TYPE_SCHOOL_USER_FIND_MANY` |
| "участники группы N / потока" — group members with progress | `QUERY_EXPORT_TYPE_GROUP_MEMBER_FIND_MANY` |
| "все оплаты/счета за месяц", sales report | `QUERY_EXPORT_TYPE_INVOICE_MANAGE_FIND_MANY` |
| "попытки по домашкам/практикам", grading report | `QUERY_EXPORT_TYPE_COURSE_LESSON_PRACTICE_ATTEMPT_FIND_MANY` |
| "подписки/рассрочки, кто не оплатил списание" | `QUERY_EXPORT_TYPE_PRODUCT_BILLING_ACCESS_FIND_MANY` |

Notes that disambiguate:

- **Students vs users**: students = one row per *course access* (progress, group,
  curator, tariff); users = one row per *person* (contacts, registration, last
  login). "Список учеников с прогрессом" → students; "база контактов" → users.
- Students and billing-access share the same `variables` structure (access filter);
  group-member also accepts `groupIds`, `productIds`, nested `product`/`price` filters.

**When a direct list endpoint is the shorter path.** If the user needs *data to look
at or feed into another system now* — small volume, JSON is fine, no formatted
Excel sheets — skip query-export and page through a list endpoint instead
(GET, standard pagination `take` ≤ 1000 / `page`, envelope `payload.items` +
`pages`/`next`):

- `GET /invoice/list/raw` — invoices (same filters as the invoice export).
- `GET /product-access/list/raw` — product accesses.
- `GET /certificate/list/raw` — issued certificates (**no query-export type exists
  for certificates — this is the only way**).
- `GET /course/:courseId/progresses` — per-lesson progress records for one course.

Array params repeat the key (`userIds=1&userIds=2`); ranges nest
(`createdAtDateRange[from]=...&createdAtDateRange[to]=...`). You then build the
CSV yourself (Step 4). For anything large or when the user wants a ready Excel
file with proper columns — use query-export: the server builds the file for you.

## Step 2. Confirm filters, then generate

**Before calling the API, restate the filters to the user in plain words** ("all
active students, added since June 1st — correct?"). One wrong filter wastes a
generation from the hourly budget.

```
POST https://api.exode.biz/saas/v2/query-export/generate
```

Body: `type` (from the table), `variables` (`filter` + `sort`, structure depends on
the type — see its doc page), optional `format`: `EXPORT_FORMAT_XLSX` (default),
`EXPORT_FORMAT_CSV`, `EXPORT_FORMAT_JSON`. Prefer the default XLSX unless the user
asked for CSV/JSON — the server does the formatting, including extra sheets
(students/group-members get a **Course Progress** sheet, billing gets **Billing Details**).

Real filter examples from the docs:

```jsonc
// Active students, newest first
{ "type": "QUERY_EXPORT_TYPE_SCHOOL_STUDENT_FIND_MANY",
  "variables": { "filter": { "active": true }, "sort": { "createdAt": "DESC" } } }

// Regular payments for a period ("все оплаты за 2025 год")
{ "type": "QUERY_EXPORT_TYPE_INVOICE_MANAGE_FIND_MANY",
  "variables": { "filter": { "types": ["Regular"],
      "createdAtDateRange": { "from": "2025-01-01T00:00:00Z", "to": "2025-12-31T23:59:59Z" } },
    "sort": { "paidAtOrCreatedAt": "DESC" } } }

// Members of groups 10 and 20
{ "type": "QUERY_EXPORT_TYPE_GROUP_MEMBER_FIND_MANY",
  "variables": { "filter": { "groupIds": [10, 20], "active": true } } }

// Active users (use statuses — the old active/banned filter fields are removed)
{ "type": "QUERY_EXPORT_TYPE_SCHOOL_USER_FIND_MANY",
  "variables": { "filter": { "statuses": ["Active"] } } }

// Billing: paid and failed charges; add "hasProductBillingTypes": ["Installment"]
// or ["Subscription"] to unlock the type-specific columns
{ "type": "QUERY_EXPORT_TYPE_PRODUCT_BILLING_ACCESS_FIND_MANY",
  "variables": { "filter": { "billingStatuses": ["Paid", "Failed"] } } }
```

The response (`code: 201`) contains `payload.uuid` — save it — plus
`flow: "QueryExport"`, `status: "Processing"`, `isCompleted: false`.

**Rate limit: 100 generations per hour** (per token). Batch wisely: one broad
export the user can filter in Excel beats five narrow ones; never regenerate to
"refresh" a file you already have — results stay downloadable for 24 hours, reuse
them. On HTTP 429 (`cause: "Rate"`) the error's `data.retryAfter` is an ISO
timestamp — wait until then and retry; do not hammer the endpoint.

## Step 3. Poll for the result

```
GET https://api.exode.biz/saas/v2/workflow-execution/:executionUuid/result
```

Poll every ~2 seconds. `payload`: `total` (always 100), `completed` (0–100),
`status` — `Waiting` → `Processing` → `Completed` (or `Failed` / `Canceled`).
On `Completed`, `payload.result` holds `fileUrl`, `fileName`, `fileSize`.
On `Failed`/`Canceled` — stop polling and regenerate (check the filters first).
`payload: null` means the uuid is unknown or the 24-hour retention expired.

```bash
curl -s 'https://api.exode.biz/saas/v2/workflow-execution/<uuid>/result' \
  -H "Authorization: Bearer $EXODE_TOKEN" -H "Seller-Id: $SELLER_ID" -H "School-Id: $SCHOOL_ID"
# repeat until payload.status == "Completed", then:
curl -L -o report.xlsx '<payload.result.fileUrl>'
```

**The result lives 24 hours.** Download the file immediately; if the user comes
back later, regenerate.

## Step 4. Deliver a file that opens in Excel

- **XLSX from query-export**: download `fileUrl` as-is, rename it to something
  human (`students-2026-08.xlsx`), hand it over. Nothing to convert.
- **JSON from query-export or a direct list endpoint**: build the CSV yourself.
  Flatten nested objects into dotted columns (`user.firstName` → `user_firstName`),
  join arrays with `; `. **Write a UTF-8 BOM (`\ufeff`) first** — without it,
  Russian Excel shows кракозябры instead of Cyrillic.

```python
import csv, json

def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key + "_"))
        elif isinstance(v, list):
            out[key] = "; ".join(map(str, v))
        else:
            out[key] = v
    return out

rows = [flatten(item) for item in items]  # items: all pages of payload.items, or the JSON export
headers = sorted({k for r in rows for k in r})
with open("report.csv", "w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig = UTF-8 BOM
    w = csv.DictWriter(f, fieldnames=headers)
    w.writeheader()
    w.writerows(rows)
```

Node.js equivalent: prepend the BOM manually —
`fs.writeFileSync('report.csv', '\ufeff' + csvString)`.

When paging a list endpoint, loop `page` until `payload.isLast` (or `pages`
reached) and concatenate `payload.items` before converting.

Ask the user to open the file and confirm the columns and Cyrillic look right.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| 401 `Unauthorized` | Token missing/invalid, or `Seller-Id`/`School-Id` absent — recheck all three headers. |
| 401/403 `Forbidden` | Token lacks rights for this data (e.g. invoices need `SellerSales`) or is not an API-client user — adjust the key's rights in `/manage/school/api-keys`. |
| 429 `Rate` | 100 generations/hour exceeded — wait until `data.retryAfter`, reuse already-generated files. |
| 400 `validation` | Malformed `variables` (wrong enum, `from` > `to` in a range) — fix against the type's doc page. Unknown filter fields are silently ignored, so a misspelled filter returns *unfiltered* data — verify row counts look plausible. |
| `status: Failed` | Generation error — retry once; if it persists, narrow the filters and contact support. |
| `payload: null` on result | Wrong uuid or the 24h retention expired — regenerate. |
| Cyrillic garbled in Excel | CSV lacks the UTF-8 BOM — rewrite with `utf-8-sig` / prepend `\ufeff`, or ship XLSX instead. |
| Export empty but data exists in the admin panel | Filters too narrow (e.g. `statuses` vs removed `active` field on the users export, timezone-shifted date range) — re-confirm filters with the user. |

## Final checklist

1. The chosen `type` matches what the user actually asked for (students vs users vs invoices...).
2. Filters restated to the user in plain words and confirmed before generating.
3. File downloaded within 24h, renamed meaningfully, and delivered (or `fileUrl` handed over in Mode C).
4. The user confirmed the file opens in Excel with readable Cyrillic and sensible columns.
5. Generations spent this hour are counted; no redundant regenerations of the same data.
6. The API token appears nowhere in the chat history — only in env vars or commands the user filled in themselves.
