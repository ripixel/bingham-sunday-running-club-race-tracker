# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start local dev server (Vite, http://localhost:5173)
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # Serve the built dist/ locally
```

No test or lint scripts exist. TypeScript errors surface via `npm run build`.

## Architecture

This is a mobile-first React 19 + TypeScript SPA. It acts as a **race director tool**: it reads runner profiles and writes race results directly to the `bingham-sunday-running-club-website` GitHub repository via the GitHub API — there is no dedicated backend.

### Authentication

Users authenticate via GitHub OAuth. The OAuth flow opens a popup pointing at `VITE_OAUTH_AUTH_URL` (defaults to `https://binghamsundayrunningclub.co.uk/api/auth`), which is a Firebase Cloud Function in the `-website` repo. The popup communicates back via `postMessage`. The resulting GitHub token is stored in `localStorage` and used to create an `Octokit` instance passed throughout the app.

### Data flow

All reads and writes go through `src/lib/github.ts` using Octokit:

- **Runners**: read from `content/runners/*.json` in the `-website` repo (one file per runner, filename = runner ID slug)
- **Seed times**: read from the most recent file in `content/results/` (parses YAML frontmatter with regex) to sort runners by previous finish time at race start
- **Run results**: written to `content/staging/runs/{YYYY-MM-DD}.json` in the `-website` repo. The website's build pipeline picks these up and renders them — they are not published directly as `content/results/`
- **Race photos**: uploaded as blobs to `assets/images/races/{date}.jpg`
- **New runners created from guests**: written to `content/runners/{id}.json`

All writes use the Git Data API (createBlob → createTree → createCommit → updateRef) to batch everything into a single atomic commit.

### TrackerPage state machine

`TrackerPage` drives the core workflow through three states: `setup → running → review`.

- **setup**: select runners (registered or guest), optionally load a previously staged run to correct it
- **running**: live loop counter per participant, global timer, immersive mode (header/nav hidden), Wake Lock API to prevent screen sleep. State auto-saved to `localStorage` on every render so a page reload mid-race resumes correctly.
- **review**: edit finish times/loop counts, upload race photo, optionally promote guests to full runners, then commit everything to GitHub

### Loop distances

Defined in `src/types/result.ts`:
- Small: 0.8 km (pink)
- Medium: 1.0 km (green)
- Long: 1.2 km (blue)
- Approach: 0.55 km added once per participant (not per loop)

### Environment variables

Copy `.env.example` to `.env`. The Firebase config (`VITE_FIREBASE_*`) must match the `-website` Firebase project. `VITE_OAUTH_AUTH_URL` can be left unset to use the production OAuth endpoint.

### Deployment

CircleCI builds on all branches; deploys to Firebase Hosting only on `main`.
