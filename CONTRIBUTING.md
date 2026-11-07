# Contributing

Thanks for taking a look at Resonance. Small, focused changes are the easiest to review.

## Setup

```bash
npm install && npm run dev
```

The app is at http://localhost:8080. Sound starts after a click or a key press. Please keep that. Do not start audio on load.

## Before a pull request

```bash
npm run lint
npm run typecheck
npm run build
```

Those are the checks GitHub Actions runs. `npm run format` rewrites files with Prettier. Match the style of the code around your change.

`npm test` covers helper scripts. A few of them look for local tooling files that are not in the git checkout, so a failure there is not always a problem in the app.

## Pull requests

- Say what changed and why.
- Keep the diff to the thing you came to do.
- Screenshots help when the change is visual.
- Do not rewrite published git history.

## Issues

Open a bug report, a feature request, or a question from the templates in `.github/ISSUE_TEMPLATE`. If you are new here, a small theme, a saved setting, or a single button is a good place to start. Open an issue before a large change so we can agree on the shape of it.

## Secrets

Do not commit tokens, passwords, or `.env` files. If you find a secret already in the history, say so in an issue. Leave the history as it is unless a maintainer asks for a rewrite.
