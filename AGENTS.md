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

The discovery and social routes are in `contract/`, pinned to a pushed commit of
`feat/api-social-graph` (`0aa2e7c3`): `GET /v1/places` (list and map), the review routes,
`PATCH /v1/admin/reviews/{coReview}`, `/v1/follows` and the check-in route. The rule that matters when
the API moves again: run `scripts/sync-contract.sh <commit>` only when that commit is **remote**, because
the `contract` CI job fetches it from the API's repository; pinning an unpushed one turns the job red for
a reason that means nothing. The script refuses a checkout that is not at that commit, so do not switch
the API session's HEAD to satisfy it — a temporary worktree does the job.

Facts that each cost a bug already:

- **Coordinate order differs per parameter.** `near=<lat>,<long>`; `bbox=<minLon>,<minLat>,<maxLon>,<maxLat>`
  (longitude first, like GeoJSON). Swapping them yields a plausible, wrong map.
- **Map clusters come from the server**, grouped in H3 cells. Do not enable MapLibre's own clustering:
  two clusterers means two answers to "how many venues are here".
- **`sort=trending` works, with a per-zone condition.** The ranking producer runs in the worker and
  publishes per-zone rankings with a one-hour TTL, so `degraded: false` plus a numeric `trendingRank`
  arrive when the zone has ranking. When `degraded` is true the sort fell back to `rating`: that is a
  valid state for a zone without ranking, never an error. Show "trending" copy only when
  `degraded === false`, or the panel would promise an ordering it did not get.
- **Errors**: always `{"error":{"code","message","details"?}}`; parse `code`, never `message`. Validation
  is `422` with `details.fields[]` over a closed vocabulary (`required|invalid|too_short|too_long|unknown`).
  An unknown or inactive place is `404` on the review routes too.
- **Moderating a review frees the author's slot (Q7, decided).** The unique index now reads
  `WHERE dt_deleted_at IS NULL AND tx_status = 'ACTIVE'` (`20-review-active-unique.sql`), so a
  `MODERATED` review no longer blocks the author from reviewing that place again, and it stays visible
  to the author marked as moderated. Consequences for the moderation screen: **one control**, changing
  the status between `ACTIVE`, `INACTIVE` and `MODERATED` — not "moderate" plus "withdraw" as two
  destructive actions, and the status is a label rather than a permanent punishment. Preventing
  someone from publishing again is an account-level write block, a different feature. A second `ACTIVE`
  review still answers `409 review_already_exists`.
- **`GET /v1/admin/reviews` exists** (`status|placeId|authorId`, page/limit, newest first, requires
  `review.moderate`) and is the only way to discover a `coReview`. It deliberately **ignores the public
  visibility predicate**: it returns moderated and logically deleted rows too, so the moderation screen
  must show the state per row and must never filter client-side by "it does not appear". An out-of-enum
  `status` is `422 validation_failed` with `field: status`, and a session without `review.moderate` gets
  `403` before the service is reached.
- **`viaFollowedAuthor` is per-viewer.** A review row carries it as `true` when the reader follows the
  author; an anonymous request gets `false`. Never cache it across users or use it as a cache key —
  it describes the session, not the row.
- **A running container may serve an older image than the code you read.** If a new filter returns `200`
  with exactly the result it should have changed, suspect the deployed commit before the contract.

## The panel is administrative, never participatory

This SPA administers the site. It moderates content and accounts; it does not act as a client of the
product. Concretely, the panel **does not**:

- join a plan, accept or decline an invitation, vote on a place, follow someone, check in, or send a
  friendship request — those are client flows by definition, and building them here would create a second
  participant surface with its own permission model to get wrong;
- show a customer inbox, a personal feed, or "my invitations".

What it does is the other side of the same data: moderate a review, curate or retire a place, suspend an
account, reassign a role, read the audit log. When a domain has no moderation route, the panel has no
screen — the missing piece is on the API, not a gap to fill with a participant flow.

Current state of that rule: reviews, places, users, roles, permissions, the audit log, **plans** and
**invitations** have admin routes. Plans and invitations are moderated, never joined: `/panel/plans`
suspends (which hides a plan from everyone but its owner and members) and `/panel/invitations` revokes a
pending one, which is terminal. `plan.moderate` and `invitation.moderate` are their own permissions, so
an `EDITOR` does not see those modules at all.

Two facts that shape those screens: a plan's `viewerRole` is `''` for a moderator — the empty string is a
real value, not a missing one — and an invitation row carries `planName` and `inviteeName`, so moderation
never shows a uuid. Votes and a plan's itinerary remain participant-side: there is no admin route for
either, and the panel does not invent one.

## Forms that reference another table

A field that needs another row's id is **never** a free-text uuid input when the catalogue can be
listed. The rule, in the order it applies:

- If an endpoint lists that table's **active** items, the field is a `<select>` fed by it. Not a
  datalist, not a uuid input with a hint: a select, so the value cannot be a typo the server rejects.
- If no such endpoint exists, say so and request it — do not derive the options from whatever ids
  happen to appear in the current page. That silently hides every valid option that is not already in
  use, and a select that cannot express the truth is worse than an honest text field.
- Read-only references (a row showing another row's id) follow the same logic: the payload should
  carry a display name. If it only carries a uuid, request the name in the payload rather than
  resolving it with N extra requests from the client.

Both gaps are closed: `GET /v1/place-categories?status=ACTIVE` is public taxonomy (the panel's select
and the app's filters read the same list), and an admin review row carries `place: {id, title}`.

Two traps worth keeping: use the category's **`code`** as the stable key (the uuid changes between
environments) while a place write still sends `coPlaceCategory`; and `place.title` is nullable, and the
admin listing is no longer shaped like the public one — the public row keeps `viaFollowedAuthor` and has
no `place`, the admin row has `place` and no `viaFollowedAuthor`.

## Syncing the contract: pin against the tip, never a remembered SHA

Before every sync, resolve the API's tip instead of reusing a SHA from a message or from memory:

```bash
git -C ../melia fetch origin dev && git -C ../melia rev-parse origin/dev
```

That SHA is the one to pin. A remembered SHA is how you end up building against a contract that already
changed and then arguing about who is looking at stale data — it happened four times, and every time the
stale side was the one holding the old pin. If the API checkout has uncommitted work, create a
temporary worktree at the commit (`git worktree add --detach /tmp/x <sha>`, then `MELIA_SRC=...`) and
remove it afterwards; never switch the API session's own checkout.

## Branches and commits

**Prototype stage, until the first version ships.** We are the only people working on this repository,
so the branch/PR ceremony is suspended on purpose: commit directly on `dev`, push, and let CI report.
Do not open a pull request for routine work, and do not block on green CI before pushing — CI here is a
smoke signal, not a gate.

What still holds, because it costs nothing and prevents real damage:

- keep a commit about one thing, with its tests and docs alongside it;
- never commit `dist/` or `node_modules/`;
- `dev` → `quality` → `prod` remains the promotion direction whenever releases start, and `prod` is
  never where development happens.

When the first version is tagged, reinstate the short-lived branch and the PR against `dev` — the
protection is worth it once more than one person can push.

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

## Places backoffice

`/v1/admin/places` exists (`contract/API.md` §14) and the panel must speak it rather than a local store.
The four rules that are easy to get wrong:

- **Scope is `place.manage_all`**, never `admin.access`: an `EDITOR` holds `admin.access`, so gating on it
  would hand an editor the whole catalogue. With the permission: full list, create, owner reassignment.
  Without it: only the caller's own places, no create, no owner control.
- **A row that is not yours answers `404`**, deliberately, so the catalogue cannot be enumerated by status
  code. Copy must read "does not exist or is not yours" — never offer "request access".
- **`coOwnerUser` is ignored, not refused**, for a caller without `place.manage_all`: the response comes
  back unchanged and nothing errors. The UI must not send the field at all in that case.
- **`status=DELETED` is a listing filter**, not a place status: it is the only way to see logically retired
  rows, which then disappear from discovery, reviews and check-ins.

## What the API has that the panel does not use yet

`dev` of the API also carries **plans** (`/v1/plans`, membership, places in a plan, votes ordered by
net votes) and **invitations** (`/v1/invitations`, host view, accept as `VIEWER`, reject, `expiresAt`,
`revealed`). Both are mobile-domain features with no panel screen; they are in the snapshot only because
the snapshot is the whole contract. Adding a panel surface for them is a product decision, not a gap.

**Blocking** now exists (`POST/DELETE /v1/blocks`, `GET /v1/blocks`). It is not a panel feature, but it
changes what the panel's data means: follow listings and review visibility exclude blocks **in both
directions**, so a review can legitimately disappear from a result the panel is reading. The panel needs
no code for it — and must not cache viewer-relative results across users because of it.

**Notification preferences** exist in the contract (`GET`/`PATCH /v1/notifications/preferences`) and the
panel deliberately does **not** surface them. Their only kind is `invitation.received`, a client-side
event: configuring when an invitation reaches you is participation, and this panel does not participate.
The rules are recorded for when a kind exists that an administrator actually receives: the `GET` returns
the whole catalogue so switches are rendered rather than guessed, an absent row means **enabled**, and an
unknown `kind` is a `422` instead of a stored lie.
The invitation email itself is **courtesy, never a condition**: the invitation answers `201` whether or
not the mail can leave, so no UI logic may depend on it having arrived.

One invariant worth checking whenever a list looks wrong: a page of rows and its `total` must agree. The
API once answered `total=1` with zero rows under an active block; paginating that pages forever through
empty results. If a total does not match the rows, report it to the API rather than compensating in the
client — a client-side workaround hides a server bug instead of fixing it.

## Place content: what the admin form owns

The place dialog now edits identity, location, **opening hours**, **attributes** and **menu**. Three
properties of those writes, each of which has already caused a bug elsewhere:

- **Every one of them replaces a whole set.** Schedules, attributes and the menu are `PUT` as complete
  collections: a day, a code or a dish left out is a day, a code or a dish that disappears. An editor
  must therefore load first and send everything it means to keep — never a diff.
- **A legal state can look like an error.** A closing time at or before the opening one means the venue
  crosses midnight, and a menu section with no dishes is a menu with nothing in it yet. Both are valid;
  only equal opening/closing times, a missing currency or a negative price are refused.
- **`code` is the key, not the uuid.** Attributes and categories are taxonomy: filters and writes take
  `code`, while the catalogue's uuid only identifies the row. Reusing the vocabulary from an endpoint is
  the only way to keep the options honest — hardcoding codes is the mistake the id-field rule forbids.

**Photos** now have upload, delete and read. The read comes free with `GET /v1/admin/places/{coPlace}`,
which carries `schedules`, `attributes`, `menus`, `photos` and `rating` — so the dialog loads from **one**
call. The listing still omits them on purpose: that would be two extra queries per row. **Photos** were
the last place-content gap; what remains is the `PUT` for ordering and choosing a cover without
re-uploading (the API is adding it, and its `order` field was being ignored until they fix it). The decision taken: **a local volume for dev**, revisited before
any production release — a container-local volume is lost when the container is recreated, so it is a
development answer, not a deployment one. Nothing is built until the API exposes the upload routes;
the panel will send bytes, never a path, and the contract has to say where the files are served from so
a preview can be rendered.
