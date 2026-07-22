# Dayframe

Dayframe is a daily planning app for time-blocked tasks, goals, habits,
projects, notes, journaling, and a rotating daily quote.

The current app stores user data in the browser with `localStorage`, so it can
run on Vercel without a backend or database.

## Product Scope

- Plan today with one critical task, a start time, estimated duration, and intention.
- Generate a draft plan from natural language with the AI planning flow.
- Build an AI planning brief from guided fields for fixed events, must-do work, optional work, and constraints.
- Edit the AI draft task titles, times, durations, priorities, areas, and critical marker before accepting it.
- Check the daily schedule for time overlaps, unscheduled work, open space, and workload fit.
- See scheduled tasks and open gaps in a visual daily timeline.
- Schedule open tasks automatically into available time slots.
- Auto-space scheduled tasks to remove overlaps while preserving task order and durations.
- Edit existing tasks inline to fix schedule issues after a plan has been accepted.
- Save a daily review that feeds future AI plans with recent context and carry-over tasks.
- Add tasks with scheduled time, duration, and priority.
- Start from a blank first-run state instead of seeded demo goals or projects.
- Review a visible daily schedule instead of only a status dashboard.
- Track habits with today completion and streak labels.
- See how momentum is calculated from tasks, habits, and daily check-in.
- Add a project next action directly into today's task list.
- Store each day by the browser's local date key.
- Store planning memory on the same device with `localStorage`.
- Validate sync-ready daily state and planning memory payloads through `/api/sync`.
- Show sync validation status in the app before full account-based storage is enabled.

## Server Sync Foundation

The app now includes a server-side sync contract and database schema foundation:

- `app/api/sync/route.ts` validates sync payloads for the current day state and planning memory.
- `app/sync-contract.js` normalizes the sync payload shape shared by tests and routes.
- `app/page.tsx` sends the local day state and planning memory to `/api/sync` for automatic and manual validation.
- `db/schema.ts` defines future user profile, daily state, and planning memory tables.

The current `/api/sync` endpoint is intentionally `contract-only`; it accepts and
validates payloads but does not persist them yet. The app labels this as sync
validation, not server storage. The next backend step is adding authentication
and wiring the validated payload into the database tables.

## Deploy On Vercel

1. Open Vercel and choose `Add New` -> `Project`.
2. Import the GitHub repository: `Min-Cho0129/dayframe`.
3. Keep the framework preset as `Next.js`.
4. Vercel will read `vercel.json` and use `npm run build:vercel`.
5. Deploy.

No environment variables are required for the current version. After the project
is connected, every push to `main` will trigger a new Vercel deployment.

Optional AI planning variables:

- `OPENAI_API_KEY`: enables the OpenAI-backed planner.
- `OPENAI_MODEL`: overrides the default planning model. If unset, the app uses `gpt-5-mini`.

Without `OPENAI_API_KEY`, Dayframe still returns a local draft plan so the UI can
be tested without external API access.

GitHub Actions are not required for this Vercel setup. GitHub Actions are
automation workflows that run inside GitHub, but Vercel already has its own
GitHub integration for building and publishing this app.

## Local Development

```bash
npm install
npm run dev:vercel
```

## Build For Vercel

```bash
npm run build:vercel
```

## Validate The App

```bash
npm run lint
npm test
```

`npm test` checks both:

- the existing worker build used by the current preview deployment
- the Vercel/Next.js production build

## Current Preview URL

The existing `chatgpt.site` URL was published with Codex Sites for previewing.
Vercel is now prepared as the primary sharing path for people to try the app
from the GitHub repository.
