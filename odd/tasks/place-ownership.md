# Design: place ownership and local-scoped administration

Status: **delivered on both sides** — API at `5c8e8f63`, SPA on `feat/reviews-moderation`. The four model questions that were open are settled below
(`D1`, `D3`, `D4`, review moderation) and converted into `S#` specs and a `T#` task table. The
remaining `D#` entries are design analysis kept as the record of why.
Objective: answer "an invitation is for what?", which cannot be answered until the panel knows what
a person may administer — the platform, or the stores that belong to them.
Sibling checked: `melia` at `be7df7f`, the same commit `contract/UPSTREAM` declares. Read-only.

## 1. Where we are today

Three facts, each verified in the code:

- **The panel is platform-global.** Permissions are flat codes — `admin.access`, `user.read`,
  `user.manage`, `role.manage`, `place.create|update|delete`, `menu.manage`, `review.moderate`,
  `route.manage` (`melia/database/init/06-seeds.sql`). `authmw.RequirePermission` guards a handler
  with one code and has no notion of *which* resource (`api/internal/httpapi/authmw.go:51`), and its
  `Authorizer` answers a bare boolean: `Can(ctx, userID, permission)` (`authmw.go:23`).
- **There is no store in the admin surface.** `GET /v1/admin/users?scope=` means `admin|app|none`,
  and `scope` is *derived* from whether a role grants `admin.access` (`api/internal/identity/admin.go:40-48`);
  it is not a stored type and it is not tenancy. No places route exists yet: `router.go` mounts only
  auth, `/me`, and the four admin families.
- **The invitation grants nothing.** `invitation.Service.Invite` queues a mail and stores no state
  (`api/internal/invitation/service.go:1-8`); the person registers, verifies, and lands on `/no-access`
  because a fresh account carries no role, so every admin endpoint answers `403 permission_denied`
  (`src/app/core/admin-access.guard.ts`, and `odd/tasks/admin-users.md` L7 verified it live).
  Recovering from that wall is a manual `PATCH /v1/admin/users/{id}/roles` by someone who already
  had access.

So today "invite a user" means "invite this person to be a platform administrator", and even then
the invitee arrives without the role that would let them in.

## 2. What the base model already decided

The ownership column exists and is documented; nobody reads it.

- `core.tb_place.co_owner_user uuid` — nullable, indexed (`ix_tb_place_owner`),
  `database/init/04-core-tables.sql:13-35`, FK to `seg.tb_user` in `05-foreign-keys.sql`.
- Canonical meaning, `database/diagram_base.txt:470`: "Dueño del lugar. NULL en lugares curados por
  el backoffice", and `:808`: "`>?` marca el lado opcional: co_owner_user es nullable, un lugar
  curado no tiene dueño".
- The rule that keeps this from becoming a user "type", `diagram_base.txt:54-58` (quoted in
  `admin-users.md` S2): one user entity, capability from RBAC, never a stored kind of user.

Consequences worth stating plainly, because they save a migration:

1. **Cardinality is already decided: one owner per place, N places per owner.** `co_owner_user` is a
   column on the place; a person owning four venues is four rows pointing at the same user.
2. **`NULL` already means "the platform curates this place".** Every existing row is `NULL`, so the
   ownership model is a no-op for current data and for the existing suites.
3. **Ownership is not a role.** A role says what verbs you have; `co_owner_user` says which rows you
   may apply them to. Neither alone is enough.

## 3. Decisions to settle

### D1 — Can a place have more than one manager?

| Option | Cost | When it is right |
|---|---|---|
| **One owner** (as modelled) | zero, ships today | One person per store is accountable; a second person is a liability/legal question, not a schema question |
| **Membership table** `core.tb_place_member(co_place, co_user, tx_role)` | new table, FK, indexes, history, seeds, every scoping query joins | Stores with staff turnover, or a manager plus an accountant who must both edit |

**Recommendation:** keep one owner. Add the bridge table only when a real store asks for a second
manager, and add it *beside* `co_owner_user` (owner = accountable party, members = delegated
editors), never by dropping the column that the base diagram defines. **Decided: one owner.**

### D2 — How is "may I touch this row?" expressed?

| Option | Shape | Cost |
|---|---|---|
| **(a) Ownership check in the handler** (recommended) | permission stays flat (`place.update`), handler resolves the row and compares its owner to the caller unless the caller holds `place.update.any` | one `Viewer` value threaded through the stores; no RBAC change |
| (b) Scoped permission codes | `place.update:own` / `place.update:any` | the permission catalogue is a public contract (`GET /v1/admin/permissions`, mirrored by `src/app/core/generated/api-types.ts`); adding a grammar to the codes breaks consumers and every seed/test expectation |
| (c) Scope column on `tb_role_permission` | `seg.tb_role_permission.nu_scope` | needs a migration plus history plus triggers plus contract plus UI; the largest of the three for the same behaviour |

**Recommendation:** (a). It keeps the catalogue flat and puts the boundary where the row actually is.
The hard requirement that makes it safe: the store layer must take a non-optional `Viewer` argument,
so a query without a scope cannot be written by forgetting a flag. **Decided: (a).**

```go
// api/internal/identity, sketch only — not written yet
type Viewer struct {
    UserID  string
    SeesAll bool // holds place.*.any / review.moderate.all
}
```

### D3 — What does a store owner's role look like?

A fourth seeded role, `OWNER`, with `admin.access`, `place.update`, `menu.manage` and nothing of
`user.read`, `user.manage`, `role.manage`, `place.delete`, `place.create`. It is a role, not a user
type, so it obeys the base rule; the limit on *which* places it reaches comes from `co_owner_user`,
not from the role name.

Open sub-question: `place.create` for an owner. Creating a place means choosing an owner, and
self-assignment is a privilege escalation. Options: the platform creates the place and assigns its
owner (recommended), or `POST /admin/places` by an owner is allowed and always sets the caller as
owner. The second one lets anyone with the role invent venues on the map.

### D4 — Does the invitation carry the place?

Today the invitation is stateless, which is exactly why it cannot grant anything. Two ways out:

| Option | Consequence |
|---|---|
| **Assign roles after registration** (current behaviour, fixed) | the invite must at least ask for a role, and the API needs a way to apply it to an account that does not exist yet — i.e. state |
| **Persist the invitation** (`seg.tb_invitation`: email, role, optional `co_place`, expiry, consumed_at) | registration consumes it and grants both the role and the ownership in one transaction; the invite dialog finally means something |

**Recommendation:** persist it. Without state the flow stays "invite, then remember to do the real
step by hand". This is the single change that makes the original question answerable.

Ordering matters: an invitation to a *store* implies `co_place` whose `co_owner_user` is still
`NULL`. Either the invitation sets the ownership when consumed, or the period between invite and
registration shows the venue as platform-curated. Pick the first. **Decided: persist it; the
invitation sets the ownership when consumed.**

### D5 — Same panel or a second surface?

**Recommendation:** same `/panel`. The shell already renders from `permissions`
(`src/app/panel/panel-nav.ts`, `visibleModules`) and the guard already bounces sessions without
`admin.access`. An owner signing in gets Users/Roles/Audit absent from the sidebar for free. What
changes is the *content* of Places/Menus/Reviews, not the frame. **Decided: same panel.**

A separate surface would duplicate auth, the shell and the theme to hide four links.

### D6 — Does the audit log say which place?

`seg.tb_security_event` records `co_actor_user` but no resource. Once an owner edits their own
venue, "who changed what" is incomplete without the place. Cheapest honest option: keep the column
set and put `place_id` into `metadata` (already `additionalProperties: true` by design, `API.md` §7),
and treat it as documentation, not as a filterable field — exactly the caveat `API.md` already states.

## 4. Impact on the contract

Everything starts in `melia` (`api/openapi.yaml` + `API.md` + its contract test), then the snapshot
moves here through `scripts/sync-contract.sh` + `scripts/generate-api-client.sh`:

| Change | Breaking? | Where it lands |
|---|---|---|
| `GET/POST /v1/admin/places`, `PATCH /v1/admin/places/{id}` | new routes, additive | new `router.go` family + handlers + `PlaceStore` |
| A place in a response carries `owner: {id, email} \| null` | additive to a new payload | new schema in `openapi.yaml` |
| `POST /v1/admin/invitations` gains `place_id` and `role` | additive optional fields | new table + handler |
| A permission code changes spelling | **breaking** | don't (see D2) |
| `scope` on `/admin/users` redefined | **breaking** | don't; tenancy gets its own name |

Also: `src/app/core/wire-contract.ts` is the compile-time guard between generated types and the
hand-written `AdminApi` types, so a contract change the SPA types do not follow fails `tsc`. That is
the intended tripwire, not an obstacle.

## 5. Migration path

Ordered so that every step is shippable and reversible:

1. `melia`: `GET /v1/admin/places` reading the existing table, platform-only, no ownership filter.
   The SPA's Places screen stops being `soon`.
2. `melia`: `Viewer` resolution + write endpoints (`PATCH`, `POST`) with the owner check from D2.
   Ownership stays `NULL` for every existing row, so behaviour does not change for anyone.
3. `melia`: seeded `OWNER` role + `seg.tb_invitation` + the consume-on-registration path (D4).
   First real ownership rows appear here.
4. This repo: scope the user-facing screens. Because the API decides, the SPA only renders what it
   is given — no client-side authorization claims.

## 6. Risks

- **Silent over-reach** — a list handler that forgets `Viewer` shows the whole platform to every
  owner. The non-optional argument plus T6 are the whole mitigation; keep them together.
- **Under-reach on shared rows** — menus hang from places, dishes from menus, reviews from places
  (`04-core-tables.sql`): the scoping walks the parent chain, and a `menu.manage` check that ignores
  the parent menu is a real hole.
- **Invitation double-spend** — a consumed invitation must be atomic; two concurrent verifications
  for the same address must not grant twice. `consumed_at` needs a conditional update, not a read
  followed by a write.
- **Routes are not stores** — `tb_route.co_user` is the *author* (an app user) and `route.manage` is
  platform moderation. Scoping routes to a place owner would be wrong; they are out of this design.
- **Stale authority** — a permission change takes effect on the next request because
  `RequirePermission` reads the database; ownership is read per query too, so an owner whose venue is
  reassigned loses edit rights on their next request while the session stays valid. State that in
  `API.md` instead of pretending it is instant everywhere.
- **`scope=admin` stops meaning "the team"** — an `OWNER` holds `admin.access`, so they land in
  `scope=admin` (`identity/admin.go:40-48`). The Users screen needs a place-aware column or filter,
  and no new meaning may reuse the name `scope`.

## 7. Specs

- **S1** (verbatim answer, user, L5): "Un dueño por local (recomendado)" — a place has at most one
  owner, carried by the existing `core.tb_place.co_owner_user`. No membership table is added. A
  second manager is out of scope until a real store needs one.
- **S2** (verbatim answer, user, L5): "Solo la plataforma crea y asigna (recomendado)" —
  `place.create` stays with platform roles (`SUPERADMIN`, `ADMIN`). An `OWNER` cannot create a place
  and therefore cannot self-assign one; the platform creates the row and sets `co_owner_user`.
- **S3** (verbatim answer, user, L5): "Persistir rol + local (recomendado)" — the invitation carries
  state: `seg.tb_invitation` (address, role, optional `co_place`, expiry, `consumed_at`).
  Registration verification consumes it in one transaction and grants the role, plus the place
  ownership when it names one. An invitation that grants nothing must no longer exist.
- **S4** (verbatim answer, user, L5): "Solo la plataforma (review.moderate global)" — an owner never
  moderates reviews of their own venue. `review.moderate` stays platform-wide; reviews are outside
  the ownership scope even though they hang from a place.
- **S5** (derived): ownership is a resource check where the row is, not a permission syntax. Every
  scoped store method takes a non-optional `Viewer`; a platform caller is expressed by
  `Viewer.SeesAll`, never by an optional filter that can be forgotten.
- **S6** (derived, constraint): the permission catalogue is a public contract
  (`GET /v1/admin/permissions`, mirrored by `src/app/core/generated/api-types.ts`). No code gains a
  `:own`/`:any` grammar; no existing code is renamed.
- **S7** (derived, D5): one surface. An owner signs into the same `/panel`; navigation and routes
  keep deriving from `permissions` (`panel-nav.ts`, `app.routes.ts`). No second app shell.
- **S8** (derived, D6): owner-scoped mutations record `place_id` in the audit `metadata`, which the
  contract already declares open. It is documentation, not a filterable field.
- **S9** (derived): routes are not scoped. `core.tb_route.co_user` is the author, an app user;
  `route.manage` remains platform moderation and gains no ownership check.
- **S10** (derived, constraint): the contract changes in `melia` first — `api/openapi.yaml`,
  `api/API.md` and its contract test in one commit — and only then moves here through
  `scripts/sync-contract.sh` and `scripts/generate-api-client.sh`, with `src/app/core/wire-contract.ts`
  keeping `tsc` honest.

## 8. Tasks

Ordered so each step ships and nothing is blocked by a later one. Repo column: `melia` is the sibling
API, `here` is this SPA.

| ID | Spec | Repo | Status | Work |
|----|------|------|--------|------|
| T1 | S5, S10 | melia | pending | `Viewer` in `identity`, `PlaceStore`, `GET /v1/admin/places` with the ownership filter |
| T2 | S5, S8 | melia | pending | `PATCH /v1/admin/places/{id}`; 403 when not the owner and not `SeesAll`; `place_id` in the audit metadata |
| T3 | S2 | melia | pending | `POST /v1/admin/places`, platform permission only, owner assignable |
| T4 | S3 | melia | pending | `seg.tb_invitation` migration: table, FK, indexes, history table and triggers per the base convention |
| T5 | S3 | melia | pending | Invitation service persists; `signup/verify` consumes it and grants role + ownership in one transaction |
| T6 | S1, S5 | melia | pending | Handler tests: an owner lists exactly one row and gets 403 on a foreign place, per endpoint |
| T7 | S6, S10 | melia | pending | `openapi.yaml` + `API.md` + contract test + `OWNER` role seed |
| T8 | S10 | done | Snapshot sync + generated types + `wire-contract.ts` green under `tsc` |
| T9 | S5, S7 | done | Places screen on the chosen artboard (`03-card-grid-dialog`): card grid, two-column dialog, owner vs platform scope, in-memory store until T1-T7 land. `src/app/panel/places/` + route + nav; 9 new tests, suite 112/112 |
| T10 | S3 | here | pending | Invite dialog asks role and, for `OWNER`, the place |
| T11 | S7 | here | pending | Test: an `OWNER` session sees Places/Menus and no Users/Roles/Audit |
| T12 | all | both | done | `go test ./...` in `api/`, `npx ng test admin --watch=false`, `npx ng build` |

## Log

- **L1** (verbatim, user): "yo tengo la opcion de invitar usuario pero si yo invito a un usuario es
  para que? va a hacer cliente de este panel administrativo, quevera deberia de ser para una
  tienda/local en particular? o para el admin de la plataforma, analizemos eso"
- **L2** (verbatim answer, user): "B — Multi-local: diseñar tenancy y permisos por local" — design
  first, contract change in `melia` before any UI.
- **L3** (verbatim, user, on reading the sibling): "eso aun se esta definiendo pero si puedes leer el
  api aunque mientra vamos trabjando la web, mientra la api ajustye la disponiblidad de los
  endpoins" — read-only access granted; the model is not final, so this document keeps the choices
  open instead of assuming them.
- **L4** (finding, parent): evidence gathered read-only from `melia` at `be7df7f` — `04-core-tables.sql`
  (`co_owner_user`, indexes), `06-seeds.sql` (10 permissions, 3 roles), `httpapi/router.go` (no places
  route exists), `httpapi/authmw.go:23,51` (`Can` is a boolean, `RequirePermission` is flat),
  `internal/identity/admin.go:40-48` (`scope` is capability, not tenancy), `internal/invitation/service.go`
  (stateless). No code touched in either repository.
- **L5** (decisions, user): all four settled with the recommendations — D1 "Un dueño por local
  (recomendado)", D3 "Solo la plataforma crea y asigna (recomendado)", D4 "Persistir rol + local
  (recomendado)", reviews "Solo la plataforma (review.moderate global)". Converted into S1-S4 and the
  task table; D2 and D5 stayed as the recommended design (S5, S7). Nothing implemented in either
  repository.
- **L6** (design, parent): `design/admin-places/` holds three directions for the Places screen, each
  with both sessions switchable inside the same artboard (owner vs superadmin):
  `01-list-and-drawer.html`, `02-master-detail.html`, `03-card-grid-dialog.html`. They encode S1, S2,
  S4, S5 and S7 — the owner loses create, delete, the owner column and the reviews module; the
  superadmin keeps them plus the scope filter and the reassignment field. None is implemented.
  `design/system.md` and `design/system.html` were generated first from `src/styles.css`, because the
  project had design sources but no system board.
- **L7** (handoff, user): "Implement the design artboard design/admin-places/03-card-grid-dialog.html".
  Chosen direction: card grid + two-column dialog. Implemented in the real stack
  (`src/app/panel/places/`) with a contract-shaped in-memory store, because no places endpoint exists
  yet (T1-T3 are `melia` work). Deliberate deviations from the artboard, all because the backend does
  not exist: no photo upload (the dialog states it needs the API instead of faking thumbs), no
  `DELETE` (a destructive control that cannot work is worse than an absent one), and reassignment is
  gated on `place.delete` for now because the catalogue has no `place.assign` — that code is T7's.
  Panel navigation: Places moves from `place.create` to `place.update` so an `OWNER` can open it, and
  the module is marked `mock` rather than `live`, since the screen is honest that nothing behind it
  is real yet.
- **L8** (delivered, parent): T9 implemented. `src/app/panel/places/` holds `places.ts` (screen),
  `places.html`, `places.css`, `places.store.ts` (contract-shaped in-memory store, `PLACE_SEED` with 9
  venues) and `places.spec.ts` (9 tests). `/panel/places` now loads the real screen instead of `Soon`;
  `panel-nav.ts` keys Places on `place.update` and marks it `mock`; the nav and the overview render a
  `Mock` / `Mock data` badge. Session boundary: a platform session is the one holding `place.delete`,
  so it sees every venue with its owner, the ownership select and the status select; an owner session
  sees only `owner.id === me.id`, and the ownership and status controls are absent, not disabled.
  Validation mirrors the DB checks (title and name required, latitude -90..90, longitude -180..180,
  description <= 600) before any write. Verified: `tsc` app and spec exit 0; `ng test admin` **112
  tests / 22 files green**; `ng build` green (places is its own 27 kB lazy chunk).
  Regressions the change forced, both honest rather than silenced: `overview.spec` expected Places to
  say "Coming soon" — it now says "Mock data", and its fixture gained `place.update`, because a role
  that grants `place.create` also grants `place.update` in `06-seeds.sql`. Deviations from the
  artboard, all because the backend does not exist: no photo upload (the card shows a token-coloured
  gradient and names the cover caption), no delete action (a destructive control that cannot work is
  worse than an absent one), and reassignment rides on `place.delete` until T7 adds `place.assign`.
  Incident: the delegated writer failed with `provider_unavailable` after applying the route/nav/badge
  wiring, so the remaining unit was finished inline on the same spec.
- **L9** (human review, user): the independent verifier stayed unavailable
  (`gentle-ai-verify` failed twice with `provider_unavailable`), so the item-3 risk was closed by a
  bounded human review of the diff instead, and the human accepted both open points with "si esta
  bien": (1) the owner boundary lives in the UI until T2 gives the API the same check — the in-memory
  store does not validate ownership, and that is the accepted, documented gap; (2) an `EDITOR`
  session holds `place.update` without `place.delete`, so it opens Places in owner mode with no
  venues assigned to it. The seeds make that
  representable: no seeded role grants `place.create` without `place.update` (`06-seeds.sql:58,71`), so
  moving the module key changed nobody's real visibility.
  Known nit, accepted as is: for a session with zero venues the empty state still reads "No venue
  matches this search", which names a search that did not happen. One conditional line in
  `places.html` fixes it if it ever bothers anyone.

## Resume here

Paused 2026-11-02. Nothing is pushed and no pull request exists.

- **Done:** the design system board (`design/system.md`, `design/system.html`) and the Places screen
  on the chosen artboard (`src/app/panel/places/`), wired into the route and the navigation. T9 is
  done; suite, `tsc` and `ng build` were green when the pause happened.
- **Unblocked next step, this repo:** T10 (the invite dialog asks role and, for `OWNER`, the place) —
  it depends on T4-T5 in `melia`, so it is blocked until the invitation carries state.
- **Unblocked next step, `melia`:** T1 (`Viewer`, `PlaceStore`, `GET /v1/admin/places`). It needs
  write authorization for that repository, which this session never had — only read.
- **Accepted gaps, by human decision (L9):** the owner boundary is UI-level until T2; an `EDITOR`
  opens Places in owner mode with no venues; the zero-venue empty state still names a search.
- **Outstanding proof:** no independent verification of the item-3 risk (the verifier was
  unavailable twice). A human review closed it. If the work resumes before any commit is reviewed,
  re-run `gentle-ai-verify` over the branch.
- **L10** (delivery, API session): the whole backoffice of places landed at `5c8e8f63` on
  `feat/api-place-ownership`, pushed, so T1-T7 are done on the API side: `GET/POST/PATCH/DELETE
  /v1/admin/places` plus `GET /v1/admin/places/{coPlace}`, scoped by a `place.manage_all` permission
  (migration 24) rather than by `admin.access` — an `EDITOR` holds `admin.access` and must not see the
  whole catalogue. The snapshot is pinned there and the types are regenerated.
  Four semantics the SPA must honour, all recorded here because each one changes the screen:
  (a) scope is `place.manage_all`; (b) a row that is not yours answers **404**, deliberately, so the
  catalogue cannot be enumerated by status code; (c) `coOwnerUser` is only honoured for
  `place.manage_all`, and a caller without it is silently ignored rather than refused, so the UI must
  not send it; (d) `status=DELETED` is a listing filter for logically retired rows, not a state of the
  enum: it is the only way to see them, and a retired place leaves discovery, reviews and check-ins.
- **L11** (finding, parent): `contract/openapi.yaml` describes `AdminPlaceWrite.coOwnerUser` with "Only a
  caller with `admin.access` may set or change it", while `contract/API.md` §14 and the delivery note say
  `place.manage_all`. The two disagree inside the same contract. The SPA follows `API.md`
  (`place.manage_all`), and the provider should fix the schema description.
- **L12** (delivered, parent): the SPA half landed. `places.store.ts` is gone; the screen reads
  `GET /v1/admin/places` and writes through `POST`/`PATCH`/`DELETE`, with `AdminPlace`/`AdminPlaceWrite`
  hand-written types and a `wire-contract` guard. Scope is the server's: `place.manage_all` decides
  whether the listing is the whole catalogue, whether the create button exists, and whether the owner
  field is shown **and sent** — an owner session edits without ever sending `coOwnerUser`. Retirement is
  behind its own confirmation, and a `404` reads "does not exist or is not yours" with no permission
  prompt. `status=DELETED` is offered only as a listing filter.
- **L13** (evidence): verified with the spec rewritten against `AdminApi` — RED first (8 failures on the
  old placeholder), then GREEN — plus `tsc` app/spec exit 0, `ng test admin` **128 tests / 26 files**,
  `ng build` green with `places` at 23.2 kB. Three of the four spec failures along the way were my own
  fixture mistakes, not the code: category ids that were not uuids (validation was right to reject them)
  and a rejection mocked as a plain object when `apiErrorCode` reads `HttpErrorResponse`.
