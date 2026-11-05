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

## Panel UI base

The panel's own table and dialog presentation lives in `src/app/shared/`:

- `app-data-table` (`data-table/`) renders the panel table — column definitions, a text value per
  cell, an optional actions template, an empty state. **A new screen renders its rows through it**,
  including a screen built on `ng-crud-maker`; the vendor table is what created the second visual
  language in the first place.
- `app-dialog-shell` (`dialog-shell/`) is the body inside an `nz-modal`: lead line, both error slots,
  and two projected columns (`slot="left"` / `slot="right"`). The modal still owns the portal, focus
  and footer. Dialog field styles are global, in `src/styles.css`, because a portalled dialog cannot
  read a component stylesheet.
- `Users` and `Audit` still render `crud-list-screen`; migrating them is outstanding work, and the
  migration target is `app-data-table`, not a third idiom.

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
scripts/sync-contract.sh <melia commit>       # refuses a checkout that is not at that commit
scripts/generate-api-client.sh                # snapshot -> src/app/core/generated/api-types.ts
```

- `contract/openapi.yaml` and `contract/API.md` are copies; `contract/UPSTREAM` names the `melia`
  commit they came from. Commit the copy, the `UPSTREAM` and the regenerated types together.
- The `contract` CI job checks two things that do not imply each other: the snapshot matches the
  declared commit (fetched from the API's repository, so a stale snapshot fails), and the committed
  generated types are what that snapshot produces through the pinned generator.
- The generated types describe the wire; the hand-written types in `AdminApi` stay the source of
  truth for the logic. `src/app/core/wire-contract.ts` is the compile-time guard between them, so a
  contract change that the hand-written types did not follow breaks the type check.
- The generator version is pinned exactly in `package.json`; a caret would move the generated diff
  without the contract having changed.
- A field this SPA needs starts as a contract change in `melia` (`openapi.yaml` + `API.md` + its
  contract test), never as a silent change here.

Rules that matter here:

- Clients parse `error.code`, never `message`.
- The session uses the browser transport: refresh token only in an httpOnly cookie, `csrf_token`
  echoed from `sessionStorage`, access token in memory, one shared in-flight rotation.
- The panel renders from `permissions` (`GET /v1/me`), never from role names.

## Discovery endpoints (in `melia`, not in `contract/` yet)

`GET /v1/places` (list and map modes), the review routes and `PATCH /v1/admin/reviews/{coReview}`
exist on `feat/api-place-discovery` in the sibling, **not pushed**. Until a remote SHA exists:

- Do **not** run `scripts/sync-contract.sh`. The `contract` CI job fetches the declared commit from the
  API's repository, so pinning an unpushed one turns the job red for a reason that means nothing.
  Develop against `../melia/api/openapi.yaml` and `../melia/api/API.md`, and commit the snapshot in one
  move when the SHA is remote.

Facts that each cost a bug already:

- **Coordinate order differs per parameter.** `near=<lat>,<long>`; `bbox=<minLon>,<minLat>,<maxLon>,<maxLat>`
  (longitude first, like GeoJSON). Swapping them yields a plausible, wrong map.
- **Map clusters come from the server**, grouped in H3 cells. Do not enable MapLibre's own clustering:
  two clusterers means two answers to "how many venues are here".
- **`sort=trending` currently degrades to `rating`** and answers `degraded: true`. Even once the ranking
  producer exists, `degraded` is a valid per-zone state, not an error: a zone without ranking. Never
  treat it as a failure, and do not tie copy to "trending" while it can silently be rating.
- **Errors**: always `{"error":{"code","message","details"?}}`; parse `code`, never `message`. Validation
  is `422` with `details.fields[]` over a closed vocabulary (`required|invalid|too_short|too_long|unknown`).
  An unknown or inactive place is `404` on the review routes too.
- **Moderating a review does not free the author's slot.** The partial unique index is
  `WHERE dt_deleted_at IS NULL`, so a `MODERATED` review still blocks a new one from the same author
  (`409 review_already_exists`). Pending decision Q7 in `melia`; if moderating also sets
  `dt_deleted_at`, "moderate" and "withdraw" stop being the same action and the moderation screen must
  offer both.
- **`GET /v1/admin/reviews` does not exist yet.** Moderation needs it to discover a `coReview`; it is
  planned with `status|placeId|authorId` filters. Do not build the screen before it lands.
- **A running container may serve an older image than the code you read.** If a new filter returns `200`
  with exactly the result it should have changed, suspect the deployed commit before the contract.

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
