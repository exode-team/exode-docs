---
name: exode-create-miniapp
description: Build and deploy an Exode mini app completely from scratch for a non-technical user — install tooling, scaffold, read exodeInitData, verify the signature server-side with @exode-team/sdk, deploy to Vercel/Cloudflare, connect the app to a school and troubleshoot. Use when a user wants to create an Exode mini app or embed their own page into an Exode school.
---

# Create an Exode Mini App — from zero to production

You are an engineer building an **Exode mini app** for a user who may have **never
written a line of code and may not even have developer tools installed**. Your job is
to take them from an empty computer to a working app embedded in their Exode school.

## First: detect where you are running

Your execution environment decides how every step below is performed. Determine it
before starting and tell the user which mode you are in:

- **Mode A — agent on the user's computer** (Claude Code, Cursor agent, any CLI
  agent with terminal access to the user's machine). You run every command yourself,
  the project lives in the user's folder, local testing (Step 3) happens on
  `http://localhost:3000`, and the deploy runs from the same folder.
- **Mode B — cloud agent with its own sandbox** (claude.ai with code execution,
  cloud VMs, hosted runners). You can run commands, but the user cannot open your
  `localhost`. Build the project in the sandbox, **skip the local browser check in
  Step 3** (run the automated checks yourself with `curl`), and validate everything
  on a public preview deploy instead: `npx vercel` (preview) first, then
  `npx vercel --prod`. Hosting login from a sandbox may require a token-based flow —
  `npx vercel login` prints a URL the user opens to confirm.
- **Mode C — plain chat, no command execution.** You cannot run anything: turn every
  step into exact copy-paste instructions — which app to open (Terminal on macOS,
  PowerShell on Windows), what to paste, and what the expected output looks like.
  Wait for the user to report each result before moving on.

If you are unsure which mode you are in, try a harmless command (`node -v`): if you
can execute it — Mode A or B (B when the user cannot reach your localhost); if not —
Mode C.

## How to behave with this user

- **Do everything yourself** whenever you can execute commands. Only ask the user for
  things that can come from them alone: the hosting account login, the page secret,
  the app name and what the app should do.
- **Speak the user's language** and avoid jargon: say "a folder with your app's
  files", not "the project root". Explain what is happening in one short sentence
  per step.
- **One question at a time.** Start by asking only two things:
  1. What should the app do? (If they just want to try — build the starter app below as is.)
  2. What should it be called? (Used for the folder name and the page title.)
- Never skip the **Security** section. Never print the page secret back into the chat
  once received — confirm you have it and move on.

## What an Exode mini app is

A mini app is the user's own website that a school on the Exode platform embeds via
an `iframe` (admin panel section "Company → Apps & pages"). When the page opens,
Exode appends a URL fragment `#exodeInitData=...` — a signed string with the
visitor's identity (same idea as Telegram Mini Apps). The signature is verified
**only on the server** with the page secret — that is how the app's backend learns
which user from which school opened it, without trusting the client.

Architecture you will build:

```
Exode school (iframe host)
   └─ opens  https://<your-app>/#exodeInitData=<signed string>
        ├─ Client (React): reads the fragment, POSTs it to /api/exode/verify
        └─ Server (API route): verifyInitData(initData, { secret }) → trusted user
```

## Stack

- **Next.js (App Router) + TypeScript** — deploys to Vercel in one click and runs on
  any Node hosting; for Cloudflare Workers use an adapter (`@opennextjs/cloudflare`
  or vinext). If the user asked for a different stack, keep the same architecture:
  the client reads initData, the server verifies it.
- **`@exode-team/sdk` version `^0.3.1`** — the official SDK:
  - `@exode-team/sdk/miniapp` — `retrieveInitData()`, the `ExodeMiniApp` host bridge;
  - `@exode-team/sdk/miniapp/react` — `ExodeMiniAppProvider` and hooks (`useExodeUser`,
    `useExodeTheme`, `useExodeNavigation`, ...);
  - `@exode-team/sdk/miniapp/server` — `verifyInitData()` (Node-only, for API routes).

## Step 0. Check the tools (install if missing)

Check Node.js:

```bash
node -v
```

Expected: `v20.x` or newer. If the command fails or the version is older:

- **macOS / Windows:** download the LTS installer from https://nodejs.org and run it
  with default settings, then reopen the terminal and re-run `node -v`.
- **Linux:** `curl -fsSL https://fnm.vercel.app/install | bash`, reopen the terminal,
  then `fnm install --lts`.

Nothing else is required — no git, no accounts yet.

## Step 1. Scaffold the project

Replace `my-miniapp` with the user's app name (lowercase, hyphens instead of spaces):

```bash
npx create-next-app@latest my-miniapp --ts --app --no-eslint --no-tailwind --src-dir=false --import-alias "@/*" --use-npm
cd my-miniapp
npm i @exode-team/sdk
```

If `create-next-app` still asks interactive questions, answer: TypeScript — Yes,
App Router — Yes, everything else — the default.

## Step 2. Create the app files

Create/replace exactly these three files. Everything else that `create-next-app`
generated stays untouched.

### 2.1 `app/init-data-gate.tsx` — client: read initData, ask the server to verify

```tsx
'use client';

import { useEffect, useState } from 'react';
import { retrieveInitData } from '@exode-team/sdk/miniapp';

type VerifiedUser = { id: number; firstName: string | null } | null;

export function InitDataGate({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<VerifiedUser>(null);
    const [status, setStatus] = useState<'loading' | 'ok' | 'guest' | 'error'>('loading');

    useEffect(() => {
        const initData = retrieveInitData();

        if (!initData) {
            setStatus('guest');
            return;
        }

        fetch('/api/exode/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
            .then((payload) => {
                setUser(payload.user);
                setStatus('ok');
            })
            .catch(() => setStatus('error'));
    }, []);

    if (status === 'loading') return null;
    if (status === 'error') return <p>Could not verify the Exode signature.</p>;

    return (
        <>
            <p>{status === 'ok' && user ? `Hello, ${user.firstName ?? 'there'}!` : 'Guest mode'}</p>
            {children}
        </>
    );
}
```

### 2.2 `app/api/exode/verify/route.ts` — server: verify the signature

```ts
import { verifyInitData } from '@exode-team/sdk/miniapp/server';

export async function POST(request: Request) {
    const { initData } = await request.json();

    try {
        const payload = verifyInitData(initData, {
            secret: process.env.EXODE_PAGE_SECRET!,
        });

        // payload = { pageId, schoolId, authDate, user: { id, firstName, ... } | null }
        // Create your own session here (cookie/JWT) — trust only that from now on.
        return Response.json({ user: payload.user, schoolId: payload.schoolId });
    } catch {
        return new Response('Invalid init data', { status: 401 });
    }
}
```

`verifyInitData` throws on an invalid signature, a foreign secret and an expired
`auth_date` (24 hours by default) — catch and respond with 401.

### 2.3 `app/page.tsx` — the app itself (starter version)

Replace the generated file with a minimal page wrapped in the gate. Build the user's
actual idea inside `<InitDataGate>` — this starter just proves the pipeline works:

```tsx
import { InitDataGate } from './init-data-gate';

export default function Home() {
    return (
        <main style={{ maxWidth: 640, margin: '0 auto', padding: 32, fontFamily: 'system-ui' }}>
            <h1>My mini app</h1>
            <InitDataGate>
                <p>The app content goes here.</p>
            </InitDataGate>
        </main>
    );
}
```

Optional: for theme sync, host navigation and live context updates wrap the page in
`ExodeMiniAppProvider` from `@exode-team/sdk/miniapp/react`
(docs: https://docs.exode.biz/ru/exode-sdk/miniapp/react).

## Step 3. Run and check (Mode A and C — local; Mode B — see below)

```bash
npm run dev
```

**Mode B (cloud sandbox):** the user cannot open your localhost — do not ask them to.
Verify the pipeline yourself instead and show the results:

```bash
curl -s http://localhost:3000 | grep -o "Guest mode"
curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/exode/verify \
  -H 'Content-Type: application/json' -d '{"initData":"broken"}'   # expect 401
```

Then rely on the preview deploy in Step 4 for the user-visible check.

**Mode A / C:** open `http://localhost:3000` in the browser:

- The page must show **"Guest mode"** — correct: outside Exode there is no initData.
- Open `http://localhost:3000/#exodeInitData=broken` and reload — the page must show
  the verification error (the server answered 401). That means the whole pipeline works.

Create a local env file so the server has a placeholder secret while developing —
file `.env.local` in the project folder:

```
EXODE_PAGE_SECRET=local-placeholder
```

## Step 4. Deploy

The app must end up on a public **https** URL. Default — Vercel (simplest for a
non-technical user):

1. Ask the user to create a free account at https://vercel.com (sign up with email
   or GitHub — either works; no repository is needed).
2. In the project folder run:

   ```bash
   npx vercel login
   ```

   A browser window opens — the user confirms the login there.
3. First deploy:

   ```bash
   npx vercel --prod
   ```

   Answer the CLI questions with defaults (set up and deploy — Yes, scope — the
   user's account, link to existing project — No, project name — default, directory —
   default, modify settings — No). The command prints the production URL, e.g.
   `https://my-miniapp.vercel.app` — save it.
4. The secret will be added in Step 5 (you do not have it yet).

Alternative — **Cloudflare Workers**: adapt the project with `@opennextjs/cloudflare`
(follow its README), deploy with `npx wrangler deploy`, set the secret later with
`npx wrangler secret put EXODE_PAGE_SECRET`.

Any other Node hosting works the same way: build with `npm run build`, run with
`npm start`, provide `EXODE_PAGE_SECRET` as an environment variable.

## Step 5. Connect the app to the Exode school

Ask the user to do this part in the browser — guide them click by click:

1. Open the school admin panel: `https://<school-domain>/manage/school/pages`
   (or: open the school, left menu **Company → Apps & pages**).
2. Press **Create page**. Fill in:
   - **Title** — the app name (what students will see in the header);
   - **Page address** — a short latin slug, e.g. `my-app`;
   - **Iframe URL** — the https URL from Step 4;
   - layout and access ("available without login") — as the user prefers.
   Save.
3. In the new page's row menu (the "..." button) choose **Show secret** and copy it.
4. Put the secret into the hosting env and redeploy. For Vercel:

   ```bash
   npx vercel env add EXODE_PAGE_SECRET production
   # paste the secret when prompted
   npx vercel --prod
   ```

5. Open the page inside the school (it appears at `https://<school-domain>/<slug>`) —
   the app must greet the user by name. Done: the mini app is live.

## Security (mandatory — never skip)

- The page secret lives **only** in the server env (`EXODE_PAGE_SECRET`). Never in
  client code, never in the repository, never in `NEXT_PUBLIC_*` variables, never
  echoed back into the chat.
- The user's identity comes only from `verifyInitData` on the server. Data parsed
  from `retrieveInitData()` on the client must not be trusted — anyone opening the
  site directly can forge it.
- **"Regenerate secret"** in the admin panel invalidates the old secret immediately —
  update the env var and redeploy.
- The app must keep working without initData (opened directly, not from Exode):
  show a guest mode, not an error.
- Do not add `X-Frame-Options` or a restrictive `frame-ancestors` CSP header — the
  app must remain embeddable in an iframe. (Next.js and Vercel do not add them by
  default; just do not add them yourself.)

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Could not verify the Exode signature" inside the school | The secret in the env does not match this page: re-copy it via **Show secret**, update the env, redeploy. Also happens right after **Regenerate secret**. |
| Server responds 503 / "Secret is not configured" | `EXODE_PAGE_SECRET` is missing on the hosting — add it and redeploy. |
| 401 with a correct secret | `auth_date` is older than 24h (the school tab was open for a long time) — reopening the page issues a fresh signature. |
| "Guest mode" inside the school | The page in the admin panel is created without login requirement and the visitor is not logged in — expected; or the iframe URL points to a different deployment. |
| Blank page inside the school | The app URL is http (must be https), or a frame-blocking header was added — remove `X-Frame-Options`/`frame-ancestors`. |
| Works locally, fails after deploy | The env var exists only in `.env.local` — add it on the hosting (Step 5.4). |

## Final checklist

1. `http://localhost:3000` → "Guest mode", no errors (Mode B: the same checks via
   `curl` in the sandbox, or on the preview URL).
2. `http://localhost:3000/#exodeInitData=broken` → verification error message (401).
3. Public https URL opens outside Exode → "Guest mode".
4. The page inside the school greets the logged-in user by name.
5. The secret exists only in the hosting env; the chat history does not contain it.
