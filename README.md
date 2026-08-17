# Rental Maintenance Tracker

AI-powered rental property maintenance request tracker built for MNGT 745 Assignment 5B.

## Live App

https://rental-maintenance-tracker.vercel.app

## What this app does

A small internal tool for a landlord/property manager to log tenant maintenance requests, get an AI-assisted priority recommendation for each one, and track them to completion.

- **Maintenance Dashboard** (`/`) — every unresolved request, with title, property, priority (final if set, otherwise Claude's recommendation), status, responsible party, and a follow-up flag, plus summary counts for open requests and requests needing follow-up.
- **New Maintenance Request** (`/new`) — a form to log a new request (property, tenant, contact method, title, description, how it was received, date received). Saving creates a row in Supabase.
- **Request Details** (`/requests/[id]`) — the original request, an "Analyze Request" button, Claude's recommendation (advisory only), an accept/override control, a responsible-party dropdown (Jack / Tenant / Contractor), a notes log, and a "Mark Request Complete" button.

There is no login system. The app has a single implicit user (the property manager) and every database operation runs through server-side code using the Supabase secret key, so Row Level Security stays enabled without needing an auth layer.

## Which piece is scheduled vs. on demand

| Piece | Type | What it does |
|---|---|---|
| `GET /api/cron/follow-up` | **Scheduled** — Vercel Cron, once daily (`vercel.json`) | For every unresolved request, sets `needs_follow_up = true` if `updated_at` is 3+ days old, otherwise `false`. Never touches priority, status, or anything else, and never contacts anyone. |
| `POST /api/requests/[id]/analyze` | **On-demand** — triggered by the "Analyze Request" button | The agentic step. Calls the Anthropic API from server-side code only, asking Claude to recommend one priority, explain it, and suggest a next action, and writes the result back to Supabase. |
| `POST /api/requests/[id]/work-order` | **On-demand** — triggered by the "Generate Contractor Work Order" button | Assignment 6 capstone addition. Calls the Anthropic API from server-side code only to draft a contractor-ready work order from the maintenance record, and writes it back to Supabase. Only runs when the request has a saved final priority, Responsible Party is Contractor, and the request isn't Complete. |

## Which step calls Claude

Only `app/api/requests/[id]/analyze/route.ts` calls the Anthropic API. It:

1. Runs entirely server-side (`ANTHROPIC_API_KEY` is never sent to the browser).
2. Uses model `claude-opus-5` with a forced tool call (`submit_recommendation`) so the response is always structured as `{ priority, explanation, suggested_action }` — one of exactly `Emergency`, `High`, `Medium`, or `Low`.
3. Sets `export const maxDuration = 60` — a higher execution time limit than the Vercel platform default, so a slow Claude response isn't cut off mid-request.
4. Writes the result to `claude_priority`, `claude_explanation`, `claude_suggested_action`. Claude never writes to `status`, `final_priority`, or `recommendation_decision` — those only change when the property manager explicitly accepts or overrides the recommendation in the UI (`recommendation_decision` + `final_priority`).

Claude is advisory only: the UI always shows the recommendation separately from an "Accept" button and an "Override" control (final priority dropdown + save), and only the human's decision is stored as the authoritative `final_priority`.

## AI Contractor Work Order Generator (Assignment 6 Capstone)

An addition to the Request Details page that drafts a contractor-ready work order from a maintenance request already on file.

A work order can only be generated (or edited) once all three are true:

- a final priority has been saved (`final_priority` is set),
- Responsible Party is set to `Contractor`, and
- the request is not `Complete`.

Both `POST /api/requests/[id]/work-order` (generation) and the PATCH action `update_work_order_draft` (manual edits) enforce these checks server-side — the UI mirrors them for clarity, but they aren't UI-only rules.

`POST /api/requests/[id]/work-order` calls Claude with a forced tool call (structured output, same pattern as Analyze) and asks it to draft a work order with exactly these sections:

- Property
- Priority
- Issue
- Reported Condition
- Relevant History / Troubleshooting
- Requested Scope
- Important Limitations

Claude drafts only — it is explicitly instructed, and has no means, to: choose or contact a contractor, authorize repairs, authorize spending, provide or promise pricing, change the final priority, change the responsible party, mark the request complete, or state an uncertain diagnosis as established fact. The route's own Supabase update is scoped so Claude's output can only ever write to `work_order_draft`, `work_order_generated_at`, and `updated_at` — never to priority, status, or responsible-party fields.

The prompt sent to Claude excludes the tenant's name and preferred contact method entirely — only property, request title, description, date received, final priority, responsible party, notes, and the earlier `claude_suggested_action` are included.

The landlord reviews the generated draft in an editable textarea and may revise it before deciding whether to use or share it with a contractor — the app never sends, emails, or otherwise transmits the draft on its own. Edits are saved back via the `update_work_order_draft` PATCH action, which only ever touches `work_order_draft` and `updated_at`.

Drafts persist in Supabase in two new nullable columns on `maintenance_requests`: `work_order_draft` (text) and `work_order_generated_at` (timestamptz). An existing draft is not deleted if Responsible Party later changes away from Contractor — it just becomes read-only again until eligibility is restored. Once a request is marked `Complete`, any saved draft is shown for reference but can no longer be generated or edited.

### Capstone Governance

- **Hallucination risk** — Claude could invent or overstate facts about a repair it has no way of verifying. The prompt restricts it to only the information already on the maintenance record, and every draft is reviewed by a human before use.
- **Privacy risk** — only maintenance-relevant fields are sent to Claude; the tenant's name and contact information are excluded from the work-order prompt entirely.
- **Accountability** — the landlord/property manager remains responsible for reviewing the draft and deciding whether to act on it; Claude's output is never treated as a decision.
- **Autonomy limit** — Claude only drafts text. It cannot send anything, contact anyone, select a contractor, or change any operational field (priority, responsible party, status).
- **Sign-off point** — a human reviews the draft before it is shared with a contractor; nothing leaves the app automatically.
- **Failure handling** — because nothing is sent automatically, an inaccurate or unusable draft can simply be edited or ignored before any real-world action is taken, making this AI step fully reversible.

## Required environment variables

Copy `.env.local.example` to `.env.local` and fill in real values — **never commit `.env.local`** (it's already git-ignored).

| Variable | Used where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Server-side Supabase client | Public by convention (project URL), but currently only read on the server in this app. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Reserved for future client-side use | Not currently used to query Supabase from the browser — every read/write goes through server code with `SUPABASE_SECRET_KEY` so the app works without an auth layer despite RLS being enabled. Included because the assignment spec requires it. |
| `SUPABASE_SECRET_KEY` | Server only (`lib/supabase/server.ts`) | Bypasses Row Level Security. Never imported into a Client Component; the file is guarded with the `server-only` package so a stray client-side import fails the build instead of leaking the key. |
| `ANTHROPIC_API_KEY` | Server only (`app/api/requests/[id]/analyze/route.ts`) | Only ever read inside a Route Handler. |
| `CRON_SECRET` | Optional, server only (`app/api/cron/follow-up/route.ts`) | If set, the cron route requires `Authorization: Bearer <value>`. Vercel sends this automatically for scheduled Cron Jobs when `CRON_SECRET` is configured as a project environment variable. Safe to leave unset for local dev. |

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev
```

## Deployment notes (Vercel + Supabase)

- The `maintenance_requests` table and its columns are configured in Supabase with Row Level Security enabled, and the app accesses it through the server-side Supabase secret key.
- Add the four required environment variables above (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`) in Vercel Project Settings → Environment Variables before deploying. `CRON_SECRET` is optional.
- The daily follow-up job is defined in `vercel.json` (`crons`) and requires a paid or Hobby-eligible Vercel plan that supports Cron Jobs; if `CRON_SECRET` is set as a Vercel env var, Vercel automatically authenticates its own cron requests with it.
- **Caveat:** if your Supabase table has a database-level trigger that auto-updates `updated_at` on *every* row update (a common Supabase pattern, not shown in the schema I was given), the daily cron job's own write to `needs_follow_up` would itself reset the "last updated" clock. If you have such a trigger, either remove it for this table or exclude `needs_follow_up`-only updates from it, so the 3-day staleness check reflects genuine inactivity rather than the cron job's own writes.
- "Rental Property" is a free-text column with no properties table behind it, so the New Request form's property dropdown is a hardcoded placeholder list in `lib/constants.ts` (`PROPERTIES`) — edit that list to match your actual properties.
