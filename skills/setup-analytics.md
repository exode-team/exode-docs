---
name: exode-setup-analytics
description: Connect analytics to an Exode school and verify data flows — Google Analytics 4, Yandex Metrika, Meta Pixel, VK Ads, plus custom systems via the platform's target events. Use when a user wants to connect Google Analytics, Yandex Metrika, Meta Pixel, or VK Ads to their Exode school, track conversions/events, or set up custom analytics.
---

# Connect analytics to an Exode school

You are helping a school owner — possibly non-technical — connect analytics to their
Exode school. This is a **browser/admin-panel task**: the user clicks through the
admin panel and the analytics provider's site themselves, while you guide them
click by click and write every code snippet ready to paste. You never need terminal
access; if you do have a browser tool and the user consents, you may drive it, but
the default is "you paste what I write and tell me what you see".

## How it works on the platform

All four supported systems connect the same way: paste the provider's standard
snippet into **Custom Code (JS)** in the school settings. The platform detects the
snippet and starts sending its target events automatically — no extra code needed.

Every target event is also dispatched as a plain `CustomEvent` on `document`
(payload in `event.detail`), so it is visible in the browser console and can be
intercepted by custom code for any other system.

Platform events (the source of truth for what fires and when):

| Event | `event.detail` | Notes |
|---|---|---|
| `analytics:signup-completed` | `method`: `email` \| `phone` | Not sent for social login (VK, Telegram) or OTP |
| `profile:personal-info-filled-success` | — | Onboarding form filled (lead) |
| `analytics:course-viewed` | `courseId` | Course page view |
| `analytics:demo-lesson-opened` | `courseId`, `lessonId` | Demo lesson opened from course page |
| `analytics:free-course-enrolled` | `productId` | Free course enrollment |
| `analytics:checkout-initiated` | `productId`, `priceId` | Tariff chosen, checkout started |
| `analytics:purchase-completed` | `value`, `currency`, `invoiceUuid`, `productIds` | Once per invoice: 90-day on-device guard by invoice uuid; not sent if the page opens >5 min after payment (other device / email link) |
| `analytics:course-completed` | `productId` | Course finished |

Purchase amounts and currencies come from the real invoice (ISO 4217); payments in
internal points are excluded so revenue/ROAS stay accurate.

## Step 1. Intake

Ask two questions, then do only the relevant sections:

1. **Which systems?** Google Analytics 4, Yandex Metrika, Meta Pixel, VK Ads,
   something else (→ Custom analytics), or "not sure".
2. **What do you want to measure?** Traffic and behavior → GA4 and/or Metrika;
   ad conversions → the pixel of the network they buy ads on (Meta Pixel, VK Ads)
   plus goals in Metrika; sales funnel → any system, the purchase/checkout events
   cover it.

Also confirm they can open the school settings (**Custom Code (JS)** field) in the
admin panel. If they cannot find it, walk the admin panel menus together — the
field lives in the school settings.

## Step 2. Google Analytics 4

1. **No property yet?** Have them create one at https://analytics.google.com
   (Admin → Create property → add a Web data stream with the school domain) and
   copy the **Measurement ID** (`G-XXXXXXXXXX`).
2. Write the standard **Google tag (gtag.js)** snippet with their Measurement ID
   and have them paste it into **Custom Code (JS)** in the school settings, then save.
3. That is all — the platform detects `window.gtag` and sends automatically:
   - `sign_up` (param `method`), `generate_lead`, `view_item` (`items` with the
     course `item_id`), `begin_checkout` (`items`), `purchase` (`value`,
     `currency`, `items`, `transaction_id` = invoice uuid — GA4 deduplicates by it;
     not sent for internal-points payments);
   - custom events: `view_demo_lesson` (`item_id`, `lesson_id`),
     `free_course_enroll` (`item_id`), `complete_course` (`item_id`).
4. Optionally mark `purchase`, `begin_checkout`, `sign_up`, `generate_lead` as
   key events (conversions) in GA4 Admin → Events.

## Step 3. Yandex Metrika

1. **No counter yet?** Create one at https://metrika.yandex.ru for the school
   domain and copy the counter snippet and its number.
2. Paste the standard counter snippet into **Custom Code (JS)** **and** add the
   counter number to `window.YM_ID` — the platform needs it to call `reachGoal`:

   ```html
   <script>
       // ... standard Yandex Metrika counter snippet ...
       window.YM_ID = 12345678; // your counter number
   </script>
   ```

3. In the counter settings create **JS goals**
   (https://yandex.ru/support/metrica/general/goal-js-event.html) with exactly
   these identifiers: `signup`, `lead`, `view_course`, `view_demo_lesson`,
   `free_course_enroll`, `begin_checkout`, `purchase`, `complete_course`.
   The `purchase` goal receives `order_price` and `currency` (omitted for
   internal currencies).

## Step 4. Meta Pixel (Facebook)

1. **No pixel yet?** Create one in Meta Events Manager
   (https://business.facebook.com/events_manager) and copy the **Pixel ID**.
2. Write the standard Meta Pixel snippet with their Pixel ID and have them paste
   it into **Custom Code (JS)**. The platform detects `window.fbq` and sends:
   - standard events (usable for ad optimization): `CompleteRegistration`
     (`registration_method`), `Lead`, `ViewContent` (`content_type: 'product'`,
     `content_ids`), `StartTrial` (`content_ids`), `InitiateCheckout`
     (`num_items`, `content_ids`), `Purchase` (`value`, `currency`,
     `content_ids`; the invoice uuid goes as `eventID` — Meta collapses
     duplicates with the same `eventID` within 48 h; not sent for internal-points
     payments — Meta requires a real currency);
   - custom events: `ViewDemoLesson` (`content_ids`, `lesson_id`) and
     `CompleteCourse` (`content_ids`) — set up custom conversions for them in
     Events Manager if needed.

## Step 5. VK Ads

1. **No pixel yet?** Create a pixel (top.mail.ru) in the VK Ads cabinet
   (https://ads.vk.com) and copy its ID.
2. Paste the standard VK Ads pixel snippet into **Custom Code (JS)** **and** add
   the pixel ID to `window.VK_PIXEL_ID`:

   ```html
   <script>
       // ... standard VK Ads pixel snippet ...
       window.VK_PIXEL_ID = 3456789; // your pixel ID
   </script>
   ```

3. In the VK Ads cabinet create goals with the **same identifiers as Metrika**:
   `signup`, `lead`, `view_course`, `view_demo_lesson`, `free_course_enroll`,
   `begin_checkout`, `purchase` (receives `value`; omitted for internal
   currencies), `complete_course`.

## Step 6. Custom analytics (any other system)

When the built-in four are not enough, subscribe to the platform events with your
own code in **Custom Code (JS)** and call the target system's JS API:

```html
<script>
    document.addEventListener('analytics:purchase-completed', function (e) {
        // any pixel: e.detail.value, e.detail.currency, e.detail.productIds
    });
    document.addEventListener('analytics:signup-completed', function (e) {
        // e.detail.method: 'email' | 'phone'
    });
</script>
```

Use the event table from "How it works" for the full list and payloads. If the
user's system deserves built-in support, suggest writing to Exode support
(https://t.me/exode_support_biz) — the team adds systems on the platform side.

## Step 7. Verify data flows

First, the platform-level check (works for every system): open the school in a
browser, open DevTools Console, run
`document.addEventListener('analytics:course-viewed', e => console.log(e.detail))`,
then open any course page — the event must log. Then per system:

- **GA4** — Reports → Realtime: browse the school in another tab, the session and
  events (`view_item`, etc.) appear within a minute or two.
- **Metrika** — check `window.YM_ID` is set in the console; trigger a goal (open a
  course page) and watch Reports → Goals / the counter's real-time visitors.
- **Meta Pixel** — install the Meta Pixel Helper browser extension or use Events
  Manager → Test Events; browse the school and confirm `ViewContent` fires.
- **VK Ads** — check `window.VK_PIXEL_ID` in the console; watch the goal
  statistics in the VK Ads pixel dashboard.

For purchases, remember the dedup rules: a test purchase reports once per invoice,
and repeating it on the same device within 90 days sends nothing.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No events in GA4 / Meta | The platform did not find `window.gtag` / `window.fbq` — the snippet in Custom Code (JS) is missing, broken, or was saved without publishing. Re-paste the provider's standard snippet unmodified. |
| Metrika / VK goals never fire | `window.YM_ID` / `window.VK_PIXEL_ID` is not set — the snippet alone is not enough for these two. Add the assignment next to the snippet. |
| Goals fire in console but not in reports | Goal identifiers in the provider cabinet do not match exactly (`signup`, `lead`, `view_course`, ...) — they are case-sensitive; recreate them as JS goals with the exact ids. |
| No `sign_up` for some registrations | Expected: social login (VK, Telegram) and OTP do not emit the signup event — only email/phone registration does. |
| Test purchase not tracked | Dedup guard: one event per invoice, repeat sends blocked for 90 days on the device; a page opened >5 min after payment (other device, email link) sends nothing. Use a fresh invoice. |
| Purchase missing but other events work | Paid with internal points — purchase is not sent to GA4/Meta and value/currency are omitted for Metrika/VK, by design. |
| Nothing works only for some visitors | Adblockers block analytics scripts client-side; verify in a clean browser profile without extensions before debugging further. |

## Final checklist

1. The needed snippets are pasted into **Custom Code (JS)** and saved (plus
   `window.YM_ID` / `window.VK_PIXEL_ID` where applicable).
2. Metrika / VK Ads goals exist with the exact identifiers listed above.
3. The console check logs a platform event (`analytics:course-viewed`).
4. Each connected system shows live data (GA4 Realtime, Metrika goals, Meta Test
   Events / Pixel Helper, VK pixel stats).
5. The user knows the purchase dedup rules, the social-login signup gap, and, if
   relevant, has the custom-events listener pattern for other systems.
