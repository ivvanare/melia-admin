# Resume here

Paused after the places backoffice was completed. Local `dev` and `origin/dev` both at `e288697`;
working tree clean; no branches other than `dev`, `quality`, `prod`; no pull requests open.

## Where the panel stands

Every screen reads the real API — the last mock store was deleted with the places backoffice.

| Screen | Scope |
|---|---|
| Overview, Users, Roles, Audit | platform administration |
| Places | identity, location, opening hours, attributes, menu and photos; `place.manage_all` decides the whole catalogue, create and owner reassignment |
| Reviews | moderation, one status control per row |
| Plans, Invitations | moderation only: suspend a plan, revoke a pending invitation |
| My account | profile, email change |

Base components: `app-data-table` and `app-dialog-shell` in `src/app/shared/`. No panel screen draws its
own table. Contract pinned at `0aa2e7c3` and verified by the `contract` CI job.

## How to work on it

`AGENTS.md` is the operating manual: the prototype-stage git rule (commit on `dev`, no PR ceremony until
the first version), the pin-against-the-tip rule for the contract, the administrative-only boundary, the
id-field rule for forms, and the per-domain traps that already cost a bug.

## Open, and what each one waits on

1. **`PUT /v1/admin/places/{coPlace}/photos`** — reordering the gallery without re-uploading. Requested
   from the API; the cover has a working alternative, ordering does not.
2. **Photo storage for production** — the human's decision. A Docker volume for dev; S3 or equivalent
   before any release, because a volume is a development answer.
3. **Plan itinerary, read-only** — agreed shape (`PlanPlace`, `plan.moderate`, no writes), deliberately not
   built because this version does not need it.
4. **Menus and Routes modules** — no endpoints exist; both stay `soon` in the navigation.
5. **Independent verification of the theme commits** (`8ac7519`, `4acaf09`, `9346e6a`, `cfa9485`) — the
   human deferred it. The debt is declared in the description of PR #6. CI covers compilation, types and
   behaviour; it cannot see appearance.

## Verification state at the pause

- `tsc --noEmit` for `tsconfig.app.json` and `tsconfig.spec.json`: clean
- `ng test admin`: 147 tests / 28 files
- `ng build`: green

Nothing is half-done: every committed change has its tests and its documentation where they belong.
