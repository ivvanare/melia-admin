# AGENTS.md — melia-admin

Compact guidance for agents working on the melZone admin SPA. The API and the database live in
the sibling repository `melia`; this repository owns only the Angular app.

## Stack

- **Angular 22**, standalone components, signals, **zoneless** (no `zone.js` in the tree)
- **pnpm 12** (`pnpm-lock.yaml` is the source of truth; CI runs `--frozen-lockfile`)
- **vitest + jsdom** behind `ng test admin`; no browser and no API needed
- **Tailwind 4** for utilities plus hand-written CSS with design tokens (`src/styles.css`); no
  component library for our own layout
- **ng-zorro-antd 22** for the panel's tables, forms and dialogs — loaded lazily, only for `/panel`

## Repository structure

```
src/app/
├── landing/     # public product page at `/`
├── auth/        # login, two-step registration, password recovery
├── panel/       # layout, navigation catalogue, and one folder per screen
├── account/     # profile + change email
└── core/        # AuthService, ThemeService, AdminApi, AdminTransport, guards, interceptor
contract/        # versioned snapshot of the API contract; see "Backend contract" below
design/          # static artboards; not part of the build
public/
scripts/         # the sibling link and the contract sync, each with its behavioural test
```

## Commands

| Command | Purpose |
|---------|---------|
| `npx ng serve` | Dev server on `:4200`, API at `http://localhost:9000/v1` |
| `npx ng test admin --watch=false` | Full suite (the real gate) |
| `npx ng build` | Production build, with the budgets |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` | Compile gate, app |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json` | Compile gate, specs |

`tsc` and template type-checking are **not** a substitute for the suite: they cannot see a
dependency-injection error that only happens when a component renders. A spec that renders a
template with `routerLink` and stubs `Router` compiles and fails at runtime — that happened, and
the CI job `admin` is what caught it.

## The `crud-maker` sibling

`ng-crud-maker` and `ng-crud-maker-zorro` live in [`ivvanare/crud-maker`](https://github.com/ivvanare/crud-maker)
and build to `dist/crud-maker` / `dist/crud-maker-zorro`. Nothing is published yet, so both are
`link:` dependencies pointing at a **sibling checkout**:

```bash
cd ../crud-maker && pnpm install && pnpm exec ng build crud-maker && pnpm exec ng build crud-maker-zorro
```

- A clean clone of this repository needs that sibling before `pnpm install` works; CI clones and
  builds it.
- Never copy package files here: one source of truth, in that repository.
- Editing a package means editing it there, rebuilding, and re-running this suite.
- A failed build can leave `dist/crud-maker-zorro` empty; rebuild before blaming this repository.
- The linked package resolves `ng-zorro-antd` from its own checkout, so keep both on the same
  version or you get two copies in the graph.

## Backend contract

The API lives in `melia` (`api/`), and its contract is `api/openapi.yaml` + `api/API.md` **there**.
This repository consumes a **versioned snapshot** of it under `contract/`, never a submodule:

```bash
scripts/sync-contract.sh <melia commit>   # refuses a checkout that is not at that commit
```

- `contract/openapi.yaml` and `contract/API.md` are copies; `contract/UPSTREAM` names the `melia`
  commit they came from. Commit the copy and the `UPSTREAM` together, always.
- The `contract` CI job compares the snapshot against that declared commit; a snapshot edited by
  hand, or an `UPSTREAM` left behind, is a red check.
- A field this SPA needs starts as a contract change in `melia` (`openapi.yaml` + `API.md` + its
  contract test), never as a silent change here. The hand-written types in `AdminApi` and
  `AdminTransport` are the source of truth until a generated client is decided.

Rules that matter here:

- Clients parse `error.code`, never `message`.
- The session uses the browser transport: refresh token only in an httpOnly cookie, `csrf_token`
  echoed from `sessionStorage`, access token in memory, one shared in-flight rotation.
- The panel renders from `permissions` (`GET /v1/me`), never from role names.

## Branches and commits

`dev` → `quality` → `prod`, promoting in one direction; work on a short-lived branch and open the
PR against `dev`. This repository is one side, so the old cross-side guardrail does not apply;
keep a commit about one thing, with its tests and docs, and never commit `dist/` or
`node_modules/`.

## Testing

- Behaviour changes get a test that fails before the fix; `tsc` green is not evidence of runtime
  correctness.
- Never touch the network or a browser in tests: `provideHttpClientTesting` plus stubs of
  `AdminApi`/`AuthService`.
- A component that renders `routerLink` needs the real router (`provideRouter([])`), not a stubbed
  `Router` token.
- The panel's dialogs are portalled to `<body>`: query `document`, not the fixture, and clean the
  overlay between tests.

## Environment notes

- An agent sandbox may cap the process count far below what a builder needs (observed: 64 tasks
  per cgroup). Symptom: `failed to create new OS thread`, esbuild's service stopping, or
  `Cannot fork`. `GOMAXPROCS=1` lets library builds finish; `vitest` still needs a real terminal.
- Node's `path` in the Angular CLI: if `ng` cannot fork, run it as
  `node node_modules/@angular/cli/bin/ng.js …`.

## Knowledge

Feature documents live in `odd/tasks/`. They arrived here with the SPA when it left the `melia`
repository; the ones that describe the API's own work stayed there.
