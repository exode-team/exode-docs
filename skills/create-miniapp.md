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
  enhance it when it arrives (the showcase below is built this way:
  `renderMode: 'immediate'` plus cards that fill in as data arrives).
- Avoid full-screen spinners and heavy client bundles; prefer static/SSR content
  with small interactive islands.

## Match the Exode look & feel (mandatory design language)

The mini app opens **inside** the Exode platform — it must read as a native part of
it, not as a foreign website in a frame. Build every screen in this design language,
in **both themes at once**, and paint it with the **school's own palette**.

### Foundations

- **Canvas and surfaces.** Light: a soft neutral canvas (`#f5f6f8`-like) with content
  in white cards. Dark: near-black canvas (`#101114`) with `#1a1c21` cards. Depth
  comes from thin 1px borders (`#e5e7eb` / `#2a2d34`) and background contrast —
  almost no shadows (only popovers/dropdowns float with a soft shadow).
- **Rounding everywhere.** Cards and panels 14–16px; inputs, buttons and segmented
  controls 10–12px; chips, badges, counters and avatars — fully round (999px).
- **One accent color** (the school's brand color) drives every interactive element:
  active nav items, links, filled buttons, outline of the selected card, linear
  icons, big stat numbers. Its **muted tint** (accent at ~12% alpha) fills icon
  squares (rounded-12), secondary buttons, tags and active list rows.
- **Typography.** Humanist sans (system stack), large semibold headings (24–28px),
  body 14–15px, secondary text in muted gray; metric numbers are oversized semibold
  in the accent color.
- **Icons** are linear/outline (~2px stroke, 20–24px), tinted accent or muted gray —
  never filled multicolor glyphs.

### Components

- **Buttons.** Primary: filled accent, rounded-12, usually with a leading linear
  icon. Secondary: accent-muted background with accent text. Tertiary/chips: white
  pill with a thin border. Destructive actions: red text in menus.
- **Pills and badges everywhere.** Statuses (green = success, red = blocked/error,
  orange = warning/frozen), counters (small filled circles with a number), muted
  capsule tags; tooltips are black pills with white text.
- **Lists and tables.** No grid lines — airy rows; avatars are colored circles with
  initials (deterministic pastel per user); cells are two-line (title + muted meta);
  sortable column headers with tiny sort icons; pagination as small round buttons.
- **Navigation.** A narrow icon sidebar (active item tinted accent); section menus
  are icon+label lists where the active row gets a light rounded background;
  segmented controls are pill groups where the active segment is filled.
- **Empty states.** A large linear accent icon, a semibold title, a muted one-line
  hint and a centered filled CTA button.
- **Gamification surfaces** (ratings, podiums): vivid gradient backgrounds with
  translucent "glass" white cards (`rgba(255,255,255,.2–.35)` + backdrop-blur),
  white text and accent pills — use only for playful full-bleed screens.

### Both themes, school palette

- **Always ship light and dark together.** The starter's CSS tokens (Step 2.4)
  already do this — style exclusively through the tokens, never hardcode grays.
- **Use the school's palette.** The host passes the school's brand variables in the
  bridge context: `useExodeSchool().school.preferenceSettings?.colorVariables` —
  an object of shape `{ BrightLight?: Record<string, string>, SpaceGray?: Record<string, string> }`
  where keys are CSS custom properties (including `--accent`) for the light and dark
  scheme respectively. The starter's `SchoolPalette` component (Step 2.2) applies
  them on top of the default tokens, so the mini app automatically wears the
  school's brand color.

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
(e.g. `src/app/showcase.tsx`) — the content is identical. On Path B also add
`import './globals.css';` at the top of `src/app/layout.tsx`.

The starter is intentionally a **showcase, not bare text**: a card-based layout with
its own small design system (CSS variables, light + dark theme synced with the Exode
host), server-verified identity, live user/school context from the host bridge and a
host command button. Keep this visual level when you build the user's actual idea.

### 2.1 `app/api/exode/verify/route.ts` — server: verify the signature

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

### 2.2 `app/showcase.tsx` — client: theme sync, verified identity, live context, host commands

```tsx
'use client';

import { useEffect, useState } from 'react';

import {
    ExodeMiniAppProvider,
    useExodeConfig,
    useExodeInitData,
    useExodeSchool,
    useExodeTheme,
    useExodeUI,
    useExodeUser,
} from '@exode-team/sdk/miniapp/react';

type VerifiedUser = { id: number; firstName: string | null } | null;
type VerifyStatus = 'loading' | 'ok' | 'guest' | 'error';

/** Theme sync: the Exode host theme wins; until the host answers, the CSS
 *  media query keeps the system theme — so both light and dark always work. */
function ThemeSync() {
    const { scheme, isReady } = useExodeTheme();

    useEffect(() => {
        if (!isReady) return;
        document.documentElement.dataset.theme = scheme;
    }, [scheme, isReady]);

    return null;
}

/** School palette: apply the school's brand CSS variables (incl. --accent)
 *  for the active scheme on top of the starter tokens. */
function SchoolPalette() {
    const { school } = useExodeSchool();
    const { scheme } = useExodeTheme();

    useEffect(() => {
        const vars = (school as any)?.preferenceSettings?.colorVariables;
        const palette = scheme === 'dark' ? vars?.SpaceGray : vars?.BrightLight;
        if (!palette) return;

        // Keys arrive both as "--accent" and as bare "accent" — normalize to a CSS variable
        for (const [name, value] of Object.entries(palette)) {
            document.documentElement.style.setProperty(name.startsWith('--') ? name : `--${name}`, String(value));
        }
    }, [school, scheme]);

    return null;
}

/** Server-side verification of the signed initData — the only trusted identity. */
function VerifiedIdentityCard() {
    const { initData } = useExodeInitData();
    const [user, setUser] = useState<VerifiedUser>(null);
    const [status, setStatus] = useState<VerifyStatus>('loading');

    useEffect(() => {
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
    }, [initData]);

    if (status === 'loading') return null;

    return (
        <div className={`status status--${status}`}>
            <span className="status__dot" aria-hidden/>
            {status === 'ok' && user && `Server-verified: ${user.firstName ?? 'user'} (id ${user.id})`}
            {status === 'guest' && 'Guest mode — opened outside Exode.'}
            {status === 'error' && 'Could not verify the Exode signature.'}
        </div>
    );
}

/** Live context from the host bridge — updates without a reload. */
function ContextCards() {
    const { user, isLoggedIn } = useExodeUser();
    const { school } = useExodeSchool();
    const { scheme } = useExodeTheme();
    const { platform, language, isDesktop } = useExodeConfig();

    return (
        <section className="cards">
            <article className="card">
                <h2>User</h2>
                <div className="person">
                    {user?.avatar?.medium && <img alt="" src={user.avatar.medium} className="person__avatar"/>}
                    <div>
                        <div className="person__name">
                            {isLoggedIn && user
                                ? [user.firstName, user.lastName].filter(Boolean).join(' ') || `id ${user.id}`
                                : 'Guest'}
                        </div>
                        <div className="muted">{user ? user.role : 'not logged in'}</div>
                    </div>
                </div>
            </article>

            <article className="card">
                <h2>Environment</h2>
                <dl className="kv">
                    <div><dt>School</dt><dd>{String(school?.name ?? '—')}</dd></div>
                    <div><dt>Theme</dt><dd>{scheme}</dd></div>
                    <div><dt>Platform</dt><dd>{platform} · {isDesktop ? 'desktop' : 'mobile'} · {language}</dd></div>
                </dl>
            </article>
        </section>
    );
}

/** Commands to the host: control the Exode UI from inside the mini app. */
function HostActions() {
    const { showSnackbar } = useExodeUI();

    return (
        <section className="card">
            <h2>Host commands</h2>
            <p className="muted">The mini app drives the Exode UI through the bridge:</p>
            <button className="btn" onClick={() => showSnackbar({ type: 'success', message: 'Hello from the mini app!' })}>
                Show a snackbar in Exode
            </button>
        </section>
    );
}

export function Showcase() {
    return (
        <ExodeMiniAppProvider config={{ appId: 'my-miniapp', renderMode: 'immediate' }}>
            <ThemeSync/>
            <SchoolPalette/>
            <VerifiedIdentityCard/>
            <ContextCards/>
            <HostActions/>
        </ExodeMiniAppProvider>
    );
}
```

`renderMode: 'immediate'` keeps SSR content visible from the first paint — the hooks
fill in when the host handshake completes. The `appId` is your own identifier — it
does **not** need to be registered anywhere in Exode: for school pages the host
trusts the page URL's origin, so any appId works. Beyond this showcase the bridge also
offers `useExodeNavigation` (navigate the host, go back), `setTabbarVisible` /
`setHeaderVisible` / `close` in `useExodeUI`, and `useExodeVisibility` (pause
polling/video while the keep-alive iframe is hidden) — reference:
https://docs.exode.biz/ru/exode-sdk/miniapp/react

### 2.3 `app/page.tsx` — the page

```tsx
import { Showcase } from './showcase';

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

            <Showcase/>
        </main>
    );
}
```

### 2.4 `app/globals.css` — the starter design system (light + dark)

Replace the generated file (it is imported by `app/layout.tsx` already; on Path B
add the import to `src/app/layout.tsx` yourself). Light is the default, dark comes
either from the system (`prefers-color-scheme`) or is forced by the host via
`data-theme` — `ThemeSync` sets it:

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
    :root:not([data-theme='light']) {
        --bg: #101114;
        --surface: #1a1c21;
        --text: #f2f3f5;
        --muted: #9ca3af;
        --border: #2a2d34;
        --accent: #818cf8;
    }
}

:root[data-theme='dark'] {
    --bg: #101114;
    --surface: #1a1c21;
    --text: #f2f3f5;
    --muted: #9ca3af;
    --border: #2a2d34;
    --accent: #818cf8;
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

.hero { margin-bottom: 20px; }
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
    margin-top: 16px;
}

.card {
    margin-top: 16px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
}
.cards .card { margin-top: 0; }
.card h2 { margin: 0 0 6px; font-size: 16px; }
.card p { margin: 0 0 4px; font-size: 14px; }

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

.person { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.person__avatar { width: 40px; height: 40px; border-radius: 999px; object-fit: cover; }
.person__name { font-weight: 500; font-size: 14px; }

.kv { margin: 10px 0 0; font-size: 14px; }
.kv div { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; font-weight: 500; }

.btn {
    margin-top: 12px;
    padding: 9px 16px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}
.btn:hover { filter: brightness(1.08); }
```

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

## Step 6. Talk to Exode from your backend (optional — `@exode-team/sdk/api`)

When the mini app needs to **read or write school data** (users, courses, groups,
custom fields, invoices...), its backend calls the Exode REST API. Everything is
already wrapped in the SDK — same package, entrypoint `@exode-team/sdk/api`.

### 7.1 Credentials

Ask the user to open the school admin panel → **Company → For developers** and:

1. Create an **API key** — this is the Bearer token.
2. Note the **Seller ID** and **School ID** shown there.

Put all three into the server env (never the client): `EXODE_API_TOKEN`,
`EXODE_SELLER_ID`, `EXODE_SCHOOL_ID`.

### 7.2 The API client

```ts
import { ExodeAPI } from '@exode-team/sdk/api';

const exodeApi = new ExodeAPI({
    token: process.env.EXODE_API_TOKEN!,
    sellerId: Number(process.env.EXODE_SELLER_ID),
    schoolId: Number(process.env.EXODE_SCHOOL_ID),
});
```

Namespaces on `exodeApi.school`: `user`, `staff`, `group`, `course`, `certificate`,
`form`, `invoice`, `productAccess`, `queryExport` — every method is typed and maps
1:1 to a REST route (full reference: https://docs.exode.biz, SDK README on npm).
Errors throw a typed `ExodeAPIError` with `code` and `errorCause`.

### 7.3 Example: write a custom field from the mini app

The flagship scenario: the user answers something inside your mini app → your
backend verifies who they are (Step 2.1) → stores the answer into an Exode
**custom field** on that user, so the school sees it in the admin panel, filters,
exports and automations.

```ts
// app/api/answer/route.ts
import { verifyInitData } from '@exode-team/sdk/miniapp/server';
import { ExodeAPI } from '@exode-team/sdk/api';

const exodeApi = new ExodeAPI({
    token: process.env.EXODE_API_TOKEN!,
    sellerId: Number(process.env.EXODE_SELLER_ID),
    schoolId: Number(process.env.EXODE_SCHOOL_ID),
});

export async function POST(request: Request) {
    const { initData, answer } = await request.json();

    // 1. Trusted identity — never take userId from the request body
    const { user } = verifyInitData(initData, { secret: process.env.EXODE_PAGE_SECRET! });
    if (!user) return new Response('Login required', { status: 401 });

    // 2. Store the answer into a custom field by its slug
    await exodeApi.school.form.customFieldValueSetBySlug({
        userId: user.id,
        layoutId: Number(process.env.EXODE_FORM_LAYOUT_ID),
        values: [{ slug: 'favorite-topic', value: answer }],
    });

    return Response.json({ ok: true });
}
```

The custom field itself (and its `slug`) is created by the school in the admin
panel form builder — or by your backend via `exodeApi.school.form.layoutCreate`.

### 7.4 Receive webhooks from Exode

Exode pushes events (new user, enrollment, payment, ...) to your backend:

1. The user opens admin panel → **Company → For developers → Webhooks**, creates an
   endpoint with your app's URL (e.g. `https://my-miniapp.vercel.app/api/exode/webhook`)
   and copies its **secret key** → env `EXODE_WEBHOOK_SECRET`.
2. Every delivery is a POST signed with the endpoint's secret key. Verify it with
   the SDK against the **raw** body (`request.text()`, not `request.json()` — a
   re-serialized body will not match) before doing anything:

```ts
// app/api/exode/webhook/route.ts
import { verifyWebhookSignature } from '@exode-team/sdk/miniapp/server';

export async function POST(request: Request) {
    const rawBody = await request.text();

    const valid = verifyWebhookSignature(rawBody, {
        secret: process.env.EXODE_WEBHOOK_SECRET!,
        signature: request.headers.get('signature'),
    });

    if (!valid) return new Response('Invalid signature', { status: 401 });

    const event = JSON.parse(rawBody);
    // handle event.event / event payload here

    return Response.json({ ok: true });
}
```

Failed deliveries are retried (5 attempts with growing backoff) — make the handler
**idempotent** (dedupe by the event id) and answer 2xx fast; do slow work async.
The admin panel has a "send test webhook" action — use it to verify the endpoint.

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
- The Exode API token and webhook secret live only in the server env, like the page
  secret. Always verify the webhook `signature` before trusting a delivery, and take
  the acting `userId` only from `verifyInitData` — never from the request body.
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
