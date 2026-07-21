# Dayframe

Dayframe is a morning productivity dashboard for tasks, goals, habits,
projects, notes, journaling, and a rotating daily quote.

The app stores user data in the browser with `localStorage`, so it does not
require a database for the current version.

## Requirements

- Node.js `>=22.13.0`
- A Cloudflare account for direct deployment

## Local Development

```bash
npm install
npm run dev
```

## Validate The App

```bash
npm run lint
npm run build
npm test
```

## Direct Deployment To Cloudflare

This project builds to a Cloudflare Worker through `vinext`. The generated
deployment config is written to `dist/server/wrangler.json` during `npm run build`.

Log in to Cloudflare once:

```bash
npm run cloudflare:login
```

Check the deployment package without uploading:

```bash
npm run deploy:cloudflare:dry-run
```

Deploy to your Cloudflare account:

```bash
npm run deploy:cloudflare
```

The default Worker name is `dayframe`. If that name is already taken in your
Cloudflare account, change the `--name dayframe` value in `package.json`.

## Custom Domain

After deploying to Cloudflare, attach a custom domain from the Cloudflare
dashboard or deploy with Wrangler route/domain options.

## Current Hosting Note

The existing `chatgpt.site` URL was published with Codex Sites for previewing.
Direct Cloudflare deployment is separate and will use your own Cloudflare
account, Worker, and domain settings.
