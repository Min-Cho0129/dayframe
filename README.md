# Dayframe

Dayframe is a morning productivity dashboard for tasks, goals, habits,
projects, notes, journaling, and a rotating daily quote.

The current app stores user data in the browser with `localStorage`, so it can
run as a static site on GitHub Pages without a backend or database.

## Let People Try It On GitHub Pages

1. Push this repository to GitHub.
2. In the GitHub repository, go to `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to the `main` branch.

The workflow in `.github/workflows/github-pages.yml` will build the static app
and publish it to GitHub Pages.

After the workflow finishes, GitHub will show the public Pages URL in the
workflow summary and in `Settings` -> `Pages`.

## Local Development

```bash
npm install
npm run dev
```

## Build For GitHub Pages

```bash
npm run build:github-pages
```

The static output is written to `gh-pages-dist/`.

## Validate The App

```bash
npm run lint
npm test
```

`npm test` checks both:

- the existing worker build used by the current preview deployment
- the static GitHub Pages build

## Current Preview URL

The existing `chatgpt.site` URL was published with Codex Sites for previewing.
GitHub Pages is now prepared as the simpler sharing path for people to try the
app from a GitHub repository.
