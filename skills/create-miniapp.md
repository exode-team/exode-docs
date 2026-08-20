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

## Stack — pick one of two paths

Both paths give **SSR out of the box** (App Router, React Server Components) — the
app is server-rendered and paints instantly inside the iframe. Ask the user one
question to choose: **is this a one-person project or a team, and does it have to
stay free?**

- **A team, or it must stay free → Path B (Cloudflare).** Cloudflare Workers'
  free tier is generous and a whole team can share one account/project at no cost —
  Vercel's free Hobby plan is limited to a single non-commercial developer, and team
  seats are paid.
- **A solo developer → Path A (Vercel) works too** and is the simplest start; Path B
  is equally fine solo.

- **Path A — Next.js on Vercel**: standard `create-next-app`, one-command deploy,
  env vars in the Vercel dashboard.
- **Path B — vinext on a Cloudflare Worker**: `vinext` is a Next.js-compatible
  App Router framework on Vite that deploys as a single Cloudflare Worker
  (`vinext deploy`). Same app code, same SSR.

The app code (Step 2) is identical for both paths. If the user asked for a different
stack entirely, keep the same architecture: SSR page, client reads initData, server
verifies it.

- **`@exode-team/sdk` version `^0.3.1`** — the official SDK:
  - `@exode-team/sdk/miniapp` — `retrieveInitData()`, the `ExodeMiniApp` host bridge;
  - `@exode-team/sdk/miniapp/react` — `ExodeMiniAppProvider` and hooks (`useExodeUser`,
    `useExodeTheme`, `useExodeNavigation`, ...);
  - `@exode-team/sdk/miniapp/server` — `verifyInitData()` (Node-only, for API routes).

## Render instantly: SSR-first (important)

The mini app opens inside an iframe — the user is already looking at the school page,
so every millisecond before the first paint is visible. Follow these rules:

- **Server-render the UI.** Keep pages as React Server Components (the Next.js App
  Router default): HTML and styles arrive in the first response, with no client JS
  needed for the initial paint. Add `'use client'` only to the small components that
  actually need interactivity or the Exode SDK.
- **Never block the first paint on identity.** initData verification is an async
  round-trip — render the page content immediately and let the verified identity
  enhance it when it arrives (the `InitDataGate` below is built this way: children
  are always visible, the greeting appears once verified).
- Avoid full-screen spinners and heavy client bundles; prefer static/SSR content
  with small interactive islands.

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

Replace `my-miniapp` with the user's app name (lowercase, hyphens instead of spaces).

### Path A (Next.js / Vercel)

```bash
npx create-next-app@latest my-miniapp --ts --app --no-eslint --no-tailwind --src-dir=false --import-alias "@/*" --use-npm
cd my-miniapp
npm i @exode-team/sdk
```

If `create-next-app` still asks interactive questions, answer: TypeScript — Yes,
App Router — Yes, everything else — the default.

### Path B (vinext / Cloudflare Worker)

Create a folder `my-miniapp` with the files below, then run `npm install`.

The dependency versions in this `package.json` are a **known-good set at the time of
writing, not a requirement** — prefer the current latest versions (e.g.
`npm i vinext@latest vite@latest wrangler@latest react@latest react-dom@latest`
plus the matching types/plugins) and fall back to the pinned set only if the latest
ones turn out to be incompatible with each other:

`package.json`:

```json
{
  "name": "my-miniapp",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinext dev --port 3000",
    "build": "vinext build",
    "start": "vinext start",
    "deploy": "vinext deploy"
  },
  "dependencies": {
    "@exode-team/sdk": "^0.3.1",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "1.49.1",
    "@types/node": "25.9.1",
    "@types/react": "19.2.15",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.2",
    "@vitejs/plugin-rsc": "0.5.26",
    "react-server-dom-webpack": "19.2.8",
    "typescript": "6.0.3",
    "vinext": "0.0.55",
    "vite": "8.2.0",
    "wrangler": "4.117.0"
  }
}
```

`vite.config.ts`:

```ts
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
    plugins: [
        vinext(),
        cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        }),
    ],
});
```

`wrangler.jsonc`:

```jsonc
{
  "name": "my-miniapp",
  "compatibility_date": "2026-05-25",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./worker/index.ts",
  "assets": { "directory": "dist/client", "not_found_handling": "none", "binding": "ASSETS" }
}
```

`worker/index.ts`:

```ts
export { default } from 'vinext/server/app-router-entry';
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "jsx": "react-jsx"
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
```

## Step 2. Create the app files

Create/replace exactly these four files. Everything else stays untouched.
File paths below are for Path A (`app/...`); **on Path B the app dir is `src/app/...`**
(e.g. `src/app/init-data-gate.tsx`) — the content is identical. On Path B also add
`import './globals.css';` at the top of `src/app/layout.tsx`.

The starter UI is intentionally designed, not bare text: a card-based layout with
its own small design system (CSS variables, light/dark via `prefers-color-scheme`).
Keep this visual level when you build the user's actual idea on top of it.

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

    // Children render immediately (SSR content stays visible) — the identity
    // card only enhances the page once verification completes.
    return (
        <>
            {status !== 'loading' && (
                <div className={`status status--${status}`}>
                    <span className="status__dot" aria-hidden/>
                    {status === 'ok' && user && `Hello, ${user.firstName ?? 'there'}! Your identity is verified.`}
                    {status === 'guest' && 'Guest mode — opened outside Exode.'}
                    {status === 'error' && 'Could not verify the Exode signature.'}
                </div>
            )}
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

### 2.3 `app/page.tsx` — the app itself (designed starter)

Replace the generated file. The starter proves the pipeline works and already looks
like a product: hero block, identity status card, and a card grid to grow into.
Replace the two placeholder cards with the user's actual idea:

```tsx
import { InitDataGate } from './init-data-gate';

export default function Home() {
    return (
        <main className="shell">
            <header className="hero">
                <span className="badge">Exode Mini App</span>
                <h1>My mini app</h1>
                <p className="muted">
                    A starter embedded into an Exode school — replace these blocks with your app.
                </p>
            </header>

            <InitDataGate>
                <section className="cards">
                    <article className="card">
                        <h2>First block</h2>
                        <p className="muted">Describe a feature of your app here.</p>
                    </article>

                    <article className="card">
                        <h2>Second block</h2>
                        <p className="muted">And another one here — or remove the grid entirely.</p>
                    </article>
                </section>
            </InitDataGate>
        </main>
    );
}
```

### 2.4 `app/globals.css` — the starter design system

Replace the generated file (it is imported by `app/layout.tsx` already; on Path B
add the import to `src/app/layout.tsx` yourself):

```css
:root {
    color-scheme: light dark;
    --bg: #f6f7f9;
    --surface: #ffffff;
    --text: #16181d;
    --muted: #6b7280;
    --border: #e5e7eb;
    --accent: #4f46e5;
    --ok: #16a34a;
    --warn: #d97706;
    --error: #dc2626;
}

@media (prefers-color-scheme: dark) {
    :root {
        --bg: #101114;
        --surface: #1a1c21;
        --text: #f2f3f5;
        --muted: #9ca3af;
        --border: #2a2d34;
        --accent: #818cf8;
    }
}

* { box-sizing: border-box; }

body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
}

.shell { max-width: 720px; margin: 0 auto; padding: 40px 24px; }

.hero { margin-bottom: 24px; }
.hero h1 { margin: 12px 0 8px; font-size: 28px; letter-spacing: -0.02em; }

.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
}

.muted { color: var(--muted); }

.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-top: 20px;
}

.card {
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
}
.card h2 { margin: 0 0 6px; font-size: 16px; }
.card p { margin: 0; font-size: 14px; }

.status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    font-size: 14px;
}
.status__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted); }
.status--ok .status__dot { background: var(--ok); }
.status--guest .status__dot { background: var(--warn); }
.status--error .status__dot { background: var(--error); }
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
file `.env.local` in the project folder (**Path B: name the file `.dev.vars`** —
that is what the Cloudflare runtime reads):

```
EXODE_PAGE_SECRET=local-placeholder
```

## Step 4. Deploy

The app must end up on a public **https** URL.

### Path A — Vercel

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
4. The secret will be added in Step 5 (you do not have it yet). Env vars go in with
   `npx vercel env add EXODE_PAGE_SECRET production`.

### Path B — Cloudflare Worker

1. Ask the user to create a free account at https://dash.cloudflare.com.
2. In the project folder run:

   ```bash
   npx wrangler login
   ```

   A browser window opens — the user confirms the login there.
3. Deploy:

   ```bash
   npm run deploy
   ```

   `vinext deploy` builds the app and publishes the Worker; the command prints the
   public URL, e.g. `https://my-miniapp.<account>.workers.dev` — save it.
4. Env note for Cloudflare: `process.env` on a Worker is populated from Worker
   secrets/vars, not from the shell. Locally put the secret into a `.dev.vars` file
   (`EXODE_PAGE_SECRET=...`); in production set it with
   `npx wrangler secret put EXODE_PAGE_SECRET` and redeploy.

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
4. Put the secret into the hosting env and redeploy. Path A (Vercel):

   ```bash
   npx vercel env add EXODE_PAGE_SECRET production
   # paste the secret when prompted
   npx vercel --prod
   ```

   Path B (Cloudflare): `npx wrangler secret put EXODE_PAGE_SECRET`, then `npm run deploy`.

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
| Works locally, fails after deploy | The env var exists only in `.env.local`/`.dev.vars` — add it on the hosting (Step 5.4). |
| Path B: secret set in shell env but server says 503 | Cloudflare Workers read `process.env` from Worker secrets/`.dev.vars`, not the shell — use `wrangler secret put` / `.dev.vars`. |

## Final checklist

1. `http://localhost:3000` → "Guest mode", no errors (Mode B: the same checks via
   `curl` in the sandbox, or on the preview URL).
2. `http://localhost:3000/#exodeInitData=broken` → verification error message (401).
3. Public https URL opens outside Exode → "Guest mode".
4. The page inside the school greets the logged-in user by name.
5. The secret exists only in the hosting env; the chat history does not contain it.
