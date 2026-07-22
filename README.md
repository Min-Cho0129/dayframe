# Dayframe

Dayframe is a morning productivity dashboard for tasks, goals, habits,
projects, notes, journaling, and a rotating daily quote.

The current app stores user data in the browser with `localStorage`, so it can
run on Vercel without a backend or database.

## Deploy On Vercel

1. Open Vercel and choose `Add New` -> `Project`.
2. Import the GitHub repository: `Min-Cho0129/dayframe`.
3. Keep the framework preset as `Next.js`.
4. Vercel will read `vercel.json` and use `npm run build:vercel`.
5. Deploy.

No environment variables are required for the current version. After the project
is connected, every push to `main` will trigger a new Vercel deployment.

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
