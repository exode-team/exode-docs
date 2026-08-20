# Exode Agent Skills

Ready-made skills for AI agents (Claude Code, Cursor, any agent that reads
markdown instructions) that perform Exode platform tasks end-to-end — from
obtaining API credentials to a verified, working result. Each skill is a single
self-contained markdown file with YAML frontmatter (`name`, `description`)
following the [Agent Skills](https://agentskills.io) format.

Canonical URLs — fetch the raw markdown directly:

```text
https://docs.exode.biz/skills/<file>.md
```

## Skills

| Skill | File | Use when the user wants to |
|---|---|---|
| `exode-api-integration` | [integrate-exode-api.md](https://docs.exode.biz/skills/integrate-exode-api.md) | Connect to the Exode SaaS REST API: credentials, headers, response envelope, errors, rate limits, pagination. The auth foundation for every skill below. |
| `exode-import-users` | [import-users.md](https://docs.exode.biz/skills/import-users.md) | Mass-import or migrate students from CSV/Excel/another platform: idempotent upsert by `extId`, course enrollment, groups, verification report. |
| `exode-staff-sync` | [sync-staff-hr.md](https://docs.exode.biz/skills/sync-staff-hr.md) | Sync org structure and employees from an HR system (1C ZUP, custom HR) into a corporate school: departments, positions, employments, absences, terminations. |
| `exode-export-reports` | [export-reports.md](https://docs.exode.biz/skills/export-reports.md) | Export school data — students, invoices, practice attempts, accesses — via the query-export API into a CSV/Excel file. |
| `exode-setup-webhooks` | [setup-webhooks.md](https://docs.exode.biz/skills/setup-webhooks.md) | Receive platform events (registrations, payments, progress, accesses) in their own service: receiver endpoint, HMAC verification, dedupe, retries. |
| `exode-setup-analytics` | [setup-analytics.md](https://docs.exode.biz/skills/setup-analytics.md) | Connect Google Analytics 4, Yandex Metrika, Meta Pixel or VK Ads to a school and verify events flow. |
| `exode-customize-school` | [customize-school.md](https://docs.exode.biz/skills/customize-school.md) | Customize the school itself: Custom Code (JS), custom pages, Telegram Mini App auto-login, mobile deep links — with a decision guide per request. |
| `exode-create-miniapp` | [create-miniapp.md](https://docs.exode.biz/skills/create-miniapp.md) | Build and deploy their own mini app embedded into a school via iframe: scaffold, `exodeInitData` verification, deploy, connect to the school. |

## How to use a skill

- **Claude Code / Cursor and similar:** save the file as
  `~/.claude/skills/<skill-name>/SKILL.md` (or the equivalent skills folder of
  your agent), or simply tell the agent to fetch the URL and follow it.
- **Plain chat:** paste the file content (or its URL, if the agent can browse)
  into the conversation and describe your task.

Every skill detects its execution environment (agent with a terminal, cloud
sandbox, or plain chat) and adapts the steps accordingly — they are written for
non-technical users too.

## Discovery

- Agent Skills Discovery endpoint: `https://exode.biz/.well-known/agent-skills/index.json`
- Developer docs: https://docs.exode.biz (LLM reference: https://docs.exode.biz/llms-full.md)
- REST API base: `https://api.exode.biz/saas/v2` — SDK: [`@exode-team/sdk`](https://www.npmjs.com/package/@exode-team/sdk)
