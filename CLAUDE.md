# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # starts on port 3500
npm run build    # prisma generate + next build
npm run lint     # eslint
```

No test suite exists. Verify changes by running `npm run build` (TypeScript + Next.js build) before deploying.

## Deploying

Project is linked to Vercel (`worklog-daily`). Deploy with:
```bash
npx vercel --prod
```

**Schema changes**: Prisma CLI cannot speak `libsql://` — `npx prisma db push` will fail. Add columns directly via Turso HTTP API:
```bash
curl -X POST "https://<db>.turso.io/v2/pipeline" \
  -H "Authorization: Bearer $DATABASE_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"type":"execute","stmt":{"sql":"ALTER TABLE ... ADD COLUMN ..."}},{"type":"close"}]}'
```
Then update `prisma/schema.prisma` to match and commit.

## Architecture

**Stack**: Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Prisma 7 + libSQL adapter → Turso · NextAuth v4 (Google OAuth) · shadcn/ui new-york · dark theme (OKLch lime accent)

**Auth flow**: Google OAuth via NextAuth → PrismaAdapter stores User/Account in Turso. Session carries `user.id`, `user.name`, `user.email`. GitHub OAuth is a separate parallel connection stored in `GithubAuth` table (not NextAuth provider).

**Route groups**:
- `src/app/page.tsx` — login (public)
- `src/app/(authed)/` — sidebar layout wrapping dashboard, history, settings, weekly

**Key lib files**:
- `src/lib/auth.ts` — NextAuth config; session callback adds `user.id`
- `src/lib/db.ts` — singleton Prisma client using libSQL adapter; falls back to `file:./prisma/dev.db` locally
- `src/lib/email.ts` — builds HTML email tables + sends via Gmail API (RFC 2822 base64url). `sendWorkReport` / `sendWeeklyWorkReport` accept `subjectName` (for email subject) separately from `userName` (for From header and body)
- `src/lib/odoo.ts` — XML-RPC calls to Odoo 18. `createTimesheetEntry` maps our status to Odoo's two-value `status` field: `Completed → completed`, everything else → `ongoing`
- `src/lib/utils.ts` — `istDayUtcRange(date)` converts IST date string to UTC range for GitHub API queries (hardcoded IST = UTC+5:30); `utcInstantToIstDate` for reverse; `buildStyleBlock` for AI style prompts
- `src/lib/status.ts` — centralized status constants (Ongoing / Completed / On-Hold / On-Queue), colors

**Timezone**: All GitHub date queries use `istDayUtcRange()` — never pass bare ISO date strings to GitHub API (they're treated as UTC, missing IST commits from the previous UTC day).

**GitHub integration**:
- `GithubAuth` table stores `accessToken`, `username`, `name`, `emails` (comma-separated)
- `/api/github/suggest` — main suggest endpoint: three sources (search/commits, public events, user events), deduped by SHA, merge commits excluded via `parents.length > 1` + subject regex. PushEvent commits filtered by author name/email against stored `GithubAuth.emails`
- `/api/github/match` — per-repo AI description generator (OpenRouter)
- Hint field on dashboard: populated from `sug.description` = subject-only commit lines joined by `\n\n`

**AI**: OpenRouter API (`OPENROUTER_MODEL` env, default `openai/gpt-oss-120b:free`). Used in `/api/ai/describe` (Generate button) and `/api/github/match` (per-repo description). Style injection via `buildStyleBlock`.

**Weekly report**: Reads Gmail sent folder (`subject:Daily Work Report to:<filterTo>`), parses HTML tables from past daily emails, groups by project+task, AI-summarizes each group. `weeklyFilterTo` setting controls the Gmail `to:` filter.

**Email subjects**: `Daily Work Report_${formattedDate}_${subjectName.toUpperCase()}`. `subjectName` = `settings.displayName` if set, else `session.user.name`. From header uses `session.user.name` (Google name) unchanged.

**Prisma schema notable fields**:
- `UserSettings.displayName` — overrides name in email subject only
- `UserSettings.weeklyFilterTo` — Gmail filter address for weekly report
- `GithubAuth.emails` — comma-separated list of user's git commit emails for PushEvent authorship matching
