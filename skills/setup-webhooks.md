---
name: exode-setup-webhooks
description: Receive Exode platform events in the user's own service via webhooks — build the receiver endpoint, register it in the school admin panel, verify the HMAC signature, deduplicate retries. Use when a user wants their service to receive Exode events — new registrations, payments, course progress, access changes, certificates — in real time.
---

# Set up Exode webhooks — receive platform events in your own service

You are an engineer wiring **Exode webhooks** for a user who may not be a developer.
Exode webhooks are **outgoing** HTTP notifications: when an event happens on the
platform (registration, payment, course progress, access grant), Exode sends a
`POST` request with a JSON body to the user's URL. Your job: build a receiver,
deploy it to a public https URL, register it, and prove delivery works.

## First: detect where you are running

- **Mode A — agent on the user's computer** (Claude Code, Cursor, any CLI agent with
  terminal access). You run every command yourself; local testing can use a tunnel.
- **Mode B — cloud agent with its own sandbox.** You can run commands, but the user
  cannot reach your `localhost`. Skip local browser checks; validate on a public
  deploy (`npx vercel` preview, then `npx vercel --prod`). Hosting login may need
  the token/URL confirmation flow (`npx vercel login` prints a URL for the user).
- **Mode C — plain chat, no command execution.** Turn every step into exact
  copy-paste instructions (which app to open, what to paste, expected output) and
  wait for the user to report each result.

Unsure? Try `node -v`: runs → Mode A or B (B if the user can't reach your
localhost); fails → Mode C.

## How webhooks work (facts from the docs — do not deviate)

- Delivery is near-real-time via a queue with retries. The receiver must be
  **idempotent** and answer `200`, `201` or `202` **within 15 seconds**.
- Every request body is JSON with exactly this envelope:

  ```json
  {
    "event": "PaymentCompleted",
    "timestamp": "2025-01-18T12:44:55.812Z",
    "idempotencyKey": "7qqQL3bE0o8R8d3X",
    "data": { /* depends on the event */ }
  }
  ```

- `idempotencyKey` is the same across all endpoints **and across retries** — dedupe
  by it on your side. Delivery **order is not guaranteed**.
- The signature header is literally **`signature`** (lowercase — not `X-Signature`):
  `HMAC-SHA256` (lowercase hex, no `sha256=` prefix) of the **raw request body**,
  keyed with the endpoint's `secretKey` **used as-is** (a 64-character ASCII string —
  do not hex/base64-decode it).
- Retries: any non-`200/201/202` response, timeout or network error counts as a
  failure → up to **5 attempts** with growing delays (~11 → 22 → 44 → 88 → 176
  minutes). After 5 failures the event is marked failed and is not sent again.
- Limit: **max 5 endpoints per seller**. Endpoint fields: `url` (https, ≤255 chars),
  `events` (subscription list), `active` flag, `note`, auto-generated `secretKey`.

### Supported events (only these have a fixed `data` contract)

| Event | Fires when | Key `data` fields |
|---|---|---|
| `UserSignedUp` | user completed registration | `user`, `profile`, `states.utmSignupParams` |
| `UserAcquainted` | user finished onboarding | same as `UserSignedUp` |
| `UserTgConnected` | Telegram linked | `user`, `profile`, `prevTgId` |
| `CourseProgressChanged` | lesson status changed | `user`, `course`, `product?`, `groups?`, `status?`, `lessonId?` |
| `CourseCompleted` | course finished | `user`, `course`, `product?`, `groups?` |
| `CourseLessonPracticeCompleted` | practice task done | `user`, `course?`, `lesson?`, `practice?`, `attempt?`, `variantId?` |
| `PaymentCompleted` | money actually charged | `payment` with full tree: `invoice`, `invoice.user`, `invoice.products`, `acquiring` |
| `ProductEnrolledToFree` | free access granted | `user`, `profile?`, `access?`, `product?`, `course?` |
| `ProductEnrolledViaLms` | access granted manually (LMS/API) | same as `ProductEnrolledToFree` |
| `ProductEnrolledViaPayment` | access granted after payment | same as `ProductEnrolledToFree` |
| `ProductEnrolledByInviteLink` | self-enrolled via invite link | same + `inviteLinkId` |
| `CertificateIssued` | certificate issued (once per user+course) | `user`, `course`, `product?`, `certificate` (with public `link`) |

Gotchas documented by Exode:

- `PaymentCompleted` fires only on a **real charge** — recurrent-card binding
  (a zero payment with status `BindingCompleted`) does not trigger it.
- An invite-link enrollment sends **two** events: `ProductEnrolledToFree` **and**
  `ProductEnrolledByInviteLink` — distinguish by `inviteLinkId` and don't
  double-count enrollments.
- Other events (`UserSignedIn`, `UserLoggedOut`, `UserJoinedByReferral`,
  `UserCreatedViaLms`, `CourseLessonPracticeDetailedSent`,
  `CourseLessonPracticeAutoVerifySent`, `ProductRefundCompleted`,
  `ProductAccessSubscriptionEnding7Days`, `ProductAccessSubscriptionEnding1Day`)
  are subscribable but their `data` contract is **not fixed** — confirm with
  [Exode support](https://t.me/exode_support_biz) before relying on them.

Nested entities (`user`, `payment`, `course`, ...) are described in the object
reference: https://docs.exode.biz/ru/exode-api/objects/entities/index. Full docs:
https://docs.exode.biz/ru/exode-api/webhooks/about.

## Step 1. Build the receiver (Next.js on Vercel — same stack as `exode-create-miniapp`)

If the user already has a Next.js app (e.g. built with the `exode-create-miniapp`
skill), add one file to it. Otherwise scaffold:
`npx create-next-app@latest my-webhooks --ts --app --no-eslint --no-tailwind --src-dir=false --import-alias "@/*" --use-npm`

`app/api/webhooks/exode/route.ts`:

```ts
import crypto from 'crypto';

export async function POST(request: Request) {
    // 1) Raw body — never re-serialize JSON before verifying (field order,
    //    whitespace or unicode escaping would change the signature).
    const rawBody = await request.text();
    const received = request.headers.get('signature') ?? '';

    const expected = crypto
        .createHmac('sha256', process.env.EXODE_WEBHOOK_SECRET!)
        .update(rawBody)
        .digest('hex');

    const valid =
        received.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));

    if (!valid) return new Response('invalid signature', { status: 401 });

    const payload = JSON.parse(rawBody);
    // payload = { event, timestamp, idempotencyKey, data }

    // 2) Deduplicate: retries and multi-endpoint fan-out reuse the same
    //    idempotencyKey. Check-and-store it in durable storage (a DB table or
    //    Vercel KV/Redis with a unique key) — an in-memory Set does NOT survive
    //    serverless invocations. If already seen → return 200 and do nothing.

    // 3) Respond fast (15s timeout!). Do the real work after acknowledging:
    //    write the payload to a queue/DB here and process asynchronously.
    console.log('exode webhook:', payload.event, payload.idempotencyKey);

    return new Response('ok', { status: 200 });
}
```

Rules baked into this handler — keep them if the user changes stacks:
verify the raw body, compare with a timing-safe equal, answer 401 on a bad
signature, dedupe by `idempotencyKey`, return `200` fast and process async.
(Express/PHP/Python versions of the verification live in the doc linked above.)

## Step 2. Deploy to a public https URL

Same Vercel flow as the `exode-create-miniapp` skill (Step 4 there): user creates a
free https://vercel.com account → `npx vercel login` → `npx vercel --prod`. Note the
URL, e.g. `https://my-webhooks.vercel.app` — the endpoint is
`https://my-webhooks.vercel.app/api/webhooks/exode`. The secret is added in Step 3:
`npx vercel env add EXODE_WEBHOOK_SECRET production`, then `npx vercel --prod` again.
Any other https hosting works — the URL just must be public https, ≤255 chars.

## Step 3. Register the endpoint and get the secret

Webhook endpoints are configured **in the school admin panel** (settings section) —
the docs do not document a public API method for creating endpoints. Managing them
requires the `SchoolManageSettings` right (or the school owner). If the user also
needs API access for other tasks, use the sibling `exode-api-integration` skill —
credentials/headers are covered there, not here.

Guide the user click by click:

1. Open the school admin panel → settings → webhooks section, create an endpoint:
   the `url` from Step 2, the list of `events` to subscribe to, `active` on.
2. **Save the endpoint first** — the permanent `secretKey` is generated on save.
3. Copy `secretKey` from the endpoint's settings (if it is not shown, ask
   [support](https://t.me/exode_support_biz)). Never paste it back into the chat.
4. Put it into the hosting env (`EXODE_WEBHOOK_SECRET`) and redeploy (Step 2).

## Step 4. Test

1. **Test send from the admin panel**: the saved endpoint's form has a test-send
   action, signed with the endpoint's own `secretKey` — same body format, algorithm
   and header as real events, so the receiver needs no special test branch.
   **Important**: a test from an *unsaved* endpoint is signed with a temporary key
   and will fail verification against the permanent secret — save first, then test.
2. **Real event**: trigger one, e.g. register a test student in the school
   (`UserSignedUp`) or grant a free access (`ProductEnrolledToFree`), and check the
   receiver logs (`npx vercel logs <url>`) for the event and a `200` response.
3. **Negative check**: `curl -s -o /dev/null -w '%{http_code}' -X POST <endpoint> -H 'Content-Type: application/json' -H 'signature: bad' -d '{}'` → expect `401`.
4. **Local testing (Mode A, optional)**: run `npm run dev`, expose it with a tunnel
   (`npx cloudflared tunnel --url http://localhost:3000` or ngrok), put the tunnel
   URL into a *separate* test endpoint, and remember `EXODE_WEBHOOK_SECRET` must be
   in `.env.local`. Remove or deactivate the test endpoint afterwards (5-endpoint limit).

## Security (never skip)

- The `secretKey` lives only in the server env — never in client code, the repo, or
  the chat history.
- Always verify the signature before touching `data`; anyone on the internet can
  POST to a public URL.
- Log `event`, `timestamp`, `idempotencyKey` and the verification result — the docs
  recommend it and it speeds up incident reconciliation with Exode.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Every request fails verification | Signature computed over re-serialized JSON — use the raw body; or the header read as `X-Signature` — it is literally `signature`; or the secret was hex/base64-decoded — use it as-is. |
| Test send fails, real events would too | Endpoint was not saved before testing — the test used a temporary key. Save, copy the permanent `secretKey`, redeploy, retest. |
| Events arrive twice or more | Retries or invite-link double event (`ProductEnrolledToFree` + `ProductEnrolledByInviteLink`). Dedupe by `idempotencyKey`; distinguish invite enrollments by `inviteLinkId`. |
| Events stop after several failures | After 5 failed attempts an event is marked failed and never resent — fix the receiver; missed events must be recovered via the REST API (see `exode-api-integration`). |
| Retries keep coming for a handled event | The handler answered something other than `200/201/202`, or took >15s. Return 2xx immediately and process async. |
| No `PaymentCompleted` on card binding | Expected: recurrent initialization (zero payment, `BindingCompleted`) does not fire the event — only real charges do. |
| Cannot create a 6th endpoint | Documented limit: max 5 endpoints per seller. Delete/deactivate an unused one. |
| Cannot find the webhooks section / secret | Requires `SchoolManageSettings` (or owner). If the secret is not displayed, request it from support: https://t.me/exode_support_biz. |
| Events out of order | Documented: order is not guaranteed. Use `timestamp` in the payload, not arrival order. |

## Final checklist

1. Public https endpoint deployed; bad-signature POST returns `401`.
2. Endpoint saved in the admin panel with the right events, `active = true`.
3. `EXODE_WEBHOOK_SECRET` set in the hosting env only; not present in chat or repo.
4. Admin-panel test send (from the **saved** endpoint) verifies and returns `200`.
5. A real event (test registration or access grant) shows up in the receiver logs.
6. Handler dedupes by `idempotencyKey` in durable storage and responds in <15s.
