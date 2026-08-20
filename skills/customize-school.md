---
name: exode-customize-school
description: Customize an Exode school's look and behavior end-to-end for a non-technical owner — Custom Code (JS) tweaks, custom pages with embedded mini apps, auto-login into the school's Telegram Mini App, and deep links into the ExodeBiz mobile app. Use when a user wants to customize their Exode school's look and behavior — JS config tweaks, custom pages, a Telegram mini app for the school, or mobile app setup.
---

# Customize an Exode School

You are configuring an **existing Exode school** for a user who may be a non-technical
school owner. Most work here is: you write a snippet or a link, the user pastes it into
the admin panel or their bot. Only the Telegram/mobile auto-login flows involve calling
the Exode API.

**Execution note.** No local project or deploy is needed for this skill. If a step does
require running code (building a deep link, calling `POST /saas/v2/...`), use the same
mode logic as the `exode-create-miniapp` skill: run it yourself if you have a terminal
(Mode A/B), otherwise give exact copy-paste commands and wait for results (Mode C).
JS config snippets are always **written by you and pasted by the user** into the admin
panel — never ask a non-technical user to write code.

## Route the request first (the heart of this skill)

Match what the user wants to the right mechanism before doing anything:

| User wants | Mechanism | Go to |
|---|---|---|
| Hide/tweak a built-in UI element or system banner on every platform page | **Custom Code (JS)** | §1 |
| A new page at `https://<school>/<slug>` inside the school (landing, tool, service) | **Custom page** (embeds a mini app via iframe) | §2 |
| Build the website/app that the custom page embeds | **Hand off to the `exode-create-miniapp` skill** — it covers scaffold, initData verification, deploy | §2 |
| Students to open the school inside Telegram, logged in automatically | **Telegram Mini App auto-auth** (`___uat` token) | §3 |
| Their own native app to open a lesson/course in the ExodeBiz mobile app | **Mobile deep link** (`exodebizapp://`) | §4 |

If the request mixes several (common: "make a custom page" → also needs the mini app
built), do the school-side steps here and delegate the app build to `exode-create-miniapp`.

## §1. Custom Code (JS) — behavior tweaks on every page

School settings expose a **Custom Code (JS)** field. `<script>` tags placed there run on
**every page of the platform**. Use only the documented options — do not invent config
keys; anything else is unsupported and may break silently.

**Hide the "Download the app" system banner:**

```html
<script>
    (((window.exode ||= {}).common ||= {}).content ||= {}).banners ||= {};
    (window.exode.common.content.banners.system ||= {}).hideDownloadAppBanner = true;
</script>
```

**Hide specific UI elements** via `excludeElements` (array of element keys):

```html
<script>
    (window.exodeJsConfig ||= {}).excludeElements = [ 'videoWatchProgress' ];
</script>
```

Documented keys (the full current list):
- `videoWatchProgress` — video watch progress in the student card (student management section).

All documented parameters: `window.exode.common.content.banners.system.hideDownloadAppBanner`
(boolean, default `false`) and `window.exodeJsConfig.excludeElements` (string[], default `[]`).
If the user asks to hide something not in this list, say the key is not documented and
suggest contacting Exode support instead of guessing.

**Safety:** this JS runs on every page for every visitor — a syntax error or a script
that touches the DOM aggressively can degrade the whole school UI. Keep snippets minimal,
paste exactly what is shown, and remove the snippet to roll back.

## §2. Custom pages — your own page at `/<slug>`

A custom page gives the school a page at `https://<school>/<slug>` that embeds a
**mini app** (any https site — Vercel, own server, etc.) in an iframe. The mini app
receives signed user Init Data it can verify on its backend.

Create one (user does this in the browser — guide click by click):

1. Open **Control panel → Company → "School pages"** (`https://<school-domain>/manage/school/pages`).
2. Press **Create page** and fill in:
   - **Title** — shown in the header and menu (per school language);
   - **Slug** — lowercase latin letters, digits, hyphens, 2–64 chars; page opens at `/<slug>`; system platform addresses are reserved;
   - **App URL** — the https address of the mini app (opens in the iframe);
   - **Available without login** — whether unauthenticated visitors can see it.
3. Page menu → **Show secret** — the mini app's server needs it to verify Init Data. Store it only on the server; never print it into chat.
4. Add a left-menu item for the page in **Settings → Left menu** with link `/<slug>` — navigation stays internal, no reload.

Extra abilities:
- **Main page:** in the page list you can assign any page (system or custom) as the main one — it opens at `/`. A custom page set as main cannot be deleted or disabled until another main page is assigned.
- **Iframe lifecycle:** the iframe loads once and stays in memory across platform navigation — reopening is instant. The mini app can close itself with `app.ui.close()`.

**To build the embedded app itself** (scaffold, `retrieveInitData`, server-side
`verifyInitData`, deploy, connecting the secret) — switch to the **`exode-create-miniapp`**
skill; it is the complete end-to-end guide.

## §3. Telegram Mini App — auto-login for the school in Telegram

The school opens inside a Telegram WebApp and accepts a user token via the GET parameter
`___uat`. With a valid token the user lands straight in the school interface with no
login screens.

1. **Create the school user:** `POST /saas/v2/user/create` with one login (email, phone,
   or domain); pass `tgId` to link the account to Telegram; profile fields optional.
   Save `user.id` from the response — it is needed to issue the token.
2. **Issue a session token** for that `user.id`: `POST /saas/v2/user/session/auth-token`
   (docs: `/ru/exode-api/school/user/session/auth-token`); take `token` from the response.
3. **Build the URL** and hand it to Telegram:

   ```
   https://my-school.exode.biz?___uat=<token>
   ```

   For a bot deep link use `https://t.me/your_school_bot?startapp=<payload>` where the
   payload is the mini app URL encoded as **base64 without `=` padding** — Telegram
   passes it to the WebApp unchanged. Or send the URL to the user as a plain link.

**Safety:** never post `___uat` links in open chats or groups — anyone with the link
logs in as that user. Personal, short-lived links only.

## §4. Mobile app — deep links into ExodeBiz

A native app can open the ExodeBiz app on a specific screen (select school → optional
token login → open lesson) by opening a scheme URL the standard way
(`Intent.ACTION_VIEW` on Android / `UIApplication.open` on iOS).

Format — everything goes into one URL-encoded `data` query string:

```
exodebizapp://?data=<url-encoded "action=open-page&domain=...&pageId=...&params=...&extra=...">
```

- `action` — always `open-page`; `domain` — the school's exact FQDN;
- `pageId` + `params` (JSON) select the screen:
  - Lesson: `pageId=/courses/:page([0-9]+)/:courseId([0-9]+)/study/:lessonId([0-9]+)`, `params={"page":"1","courseId":"42","lessonId":"123"}`;
  - Course: `pageId=/course/:courseId([0-9_A-Za-z]+)`, `params={"courseId":"42"}`;
  - other screens — ask Exode support for the correct `pageId`/params.
- `extra` (optional) — `base64url(JSON.stringify({ actions: [...] }))`. Supported actions:
  `login-by-token` (`token` from `POST /saas/v2/user/session/auth-token`) and `open-page`.
  Guaranteed order: `extra` actions first, then the outer navigation — so
  open-page + login-by-token means open → log in → open the screen.

Rules that actually bite:
- **Double encoding:** build the inner query first (values URL-encoded), then URL-encode
  the whole string into `data`. Never assemble by hand — use `URLSearchParams` /
  `Uri.Builder` / `URLComponents` (ready-made builders are in `/ru/customization/mobile-app`).
- **base64url**, not plain base64 (`-`/`_`, no `=` padding), for `extra`.
- The link fires **only if the app is installed** — catch the failure
  (`ActivityNotFoundException` / `success == false`) and show a store or website fallback.
- If the school is not yet added in the app, it is added automatically and becomes active.
- `login-by-token` links log anyone in as that user — short-lived, personal, never published.

## Verification

- **JS config:** open any school page in a fresh tab after saving — the banner/element is
  gone; check the browser console for errors introduced by the snippet.
- **Custom page:** `https://<school>/<slug>` opens and renders the iframe app; the
  left-menu item navigates without a full reload; if set as main, `/` opens it.
- **TG Mini App:** opening the `___uat` link with a fresh token skips the login screen
  entirely; with the token stripped, the login screen appears.
- **Mobile deep link:** on a device with ExodeBiz installed the link opens the exact
  lesson; with `extra` login the user is authenticated first; without the app installed
  the fallback triggers.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| JS snippet has no effect | Not saved in **Custom Code (JS)**, page not reloaded, or an undocumented key was used — stick to documented options. |
| School UI broken after adding custom code | The snippet errors on every page — remove it from Custom Code (JS) to roll back, then re-add a corrected version. |
| Custom page slug rejected | Slug must be lowercase latin/digits/hyphen, 2–64 chars, and not a reserved system address — pick another. |
| Cannot delete/disable a custom page | It is the main page — assign another main page first. |
| Mini app on the page fails signature verification | Wrong or regenerated page secret — re-copy via **Show secret**; full pipeline debugging lives in the `exode-create-miniapp` skill. |
| TG Mini App shows the login screen | `___uat` missing, malformed, or expired — issue a fresh token; also verify `user.id` came from the create-user step. |
| Telegram does not open the WebApp | Bot's `startapp` not enabled, or the school domain is not allowed in the bot's Mini App settings. |
| Deep link does nothing | App not installed or the context ignores custom schemes — implement the fallback. |
| Deep link opens the wrong lesson | `pageId` must match character-for-character; check `params` values and the double encoding of `data`. |
| "School not found" in the app | Wrong `domain` — use the school's exact FQDN. |
| App opens on the login screen | User unauthenticated and no `extra` login — add `login-by-token` to `extra`. |

## Final checklist

1. The request was routed to the right mechanism (and to `exode-create-miniapp` if the
   user actually needs a standalone embedded app built).
2. Only documented JS config options were used; the snippet was verified on a live page
   with a clean console.
3. Custom page: slug + App URL + login access set; secret stored server-side only and
   never printed into chat; left-menu item added.
4. Tokens (`___uat`, `login-by-token`) were issued fresh, shared only via personal
   links, and never posted in public chats or chat history.
5. Every mechanism touched was verified with its check from the Verification section.
