# Feature: reviews-moderation

Objective: give the panel the one screen the API has been missing for review moderation — a paginated
admin listing plus a per-row status control — so `review.moderate` stops being a permission with no
surface.
Branches: `feat/reviews-moderation` (stacked on `feat/panel-ui-base`)
Contract: `contract/UPSTREAM` at `5977b96`; `GET /v1/admin/reviews` and `PATCH /v1/admin/reviews/{coReview}`
Test runners: `npx ng test admin --watch=false`; `tsc --noEmit` for `tsconfig.app.json` and `tsconfig.spec.json`

## Specs

- **S1** (verbatim, user, L1): "Sí, pero en una rama nueva y aparte" — this screen ships on its own branch
  so its review stays small.
- **S2** (verbatim, API session, L2): "GET /v1/admin/reviews?status=ACTIVE|INACTIVE|MODERATED&placeId=<uuid>&authorId=<uuid>&page=1&limit=20"
  — requires `review.moderate`, every filter optional, newest first, paginated with the shared page shape.
- **S3** (verbatim, API session, L2): "Este listado NO aplica el predicado de visibilidad del público.
  Devuelve también las reseñas moderadas y las borradas lógicamente." — so the screen shows the state per
  row and never filters client-side by what the public listing would hide.
- **S4** (verbatim, API session, earlier): "MODERAR y RETIRAR son UNA sola acción … Un solo control:
  cambiar estado (ACTIVE / INACTIVE / MODERATED)" and "el estado va como etiqueta, no como acción
  destructiva aparte". Moderating does not delete and is not a block: a `MODERATED` row stays listed and
  its author may publish again.
- **S5** (verbatim, API session, L2): "status con un valor fuera del enum devuelve 422 validation_failed
  con field status, no 500. Y si el usuario logueado no tiene review.moderate, 403 permission_denied".
- **S6** (derived): the screen lives at `/panel/reviews`, renders through `app-data-table`, page size 20,
  and the `reviews` module leaves `soon`.
- **S7** (derived): `AdminApi` gains the two calls and `wire-contract.ts` gains the `Review` guard, so a
  contract move that the hand-written type does not follow stops `tsc`.
- **S8** (derived, constraint): a failed status change keeps the row visible with the API code, the same
  way every other panel screen reports a rejection. No optimistic update: the row shows what the server
  confirmed.

## Tasks

| ID | Spec | Status | Work |
|----|------|--------|------|
| T1 | S7 | done | `AdminApi.listAdminReviews` and `AdminApi.setReviewStatus`, plus the wire guard |
| T2 | S2, S3, S6 | done | The screen: table, status filter, place/author filters, pagination, empty and error states |
| T3 | S4, S5 | done | Per-row status control against the PATCH, showing the confirmed value and the API code on failure |
| T4 | S6 | done | Route and navigation: `reviews` stops being `soon` |
| T5 | all | done | Spec first, then the suite, both `tsc` targets and `ng build` |

## Log

- **L1** (verbatim, user): "Sí, pero en una rama nueva y aparte" — chosen over doing it on the existing
  branch, so this feature is reviewed on its own.
- **L2** (API session): `GET /v1/admin/reviews` landed at `5977b966641f` with `status|placeId|authorId`,
  and carried the three facts this document turns into S2-S5. The sibling also confirmed the admin listing
  returns two rows where the public one returns one, the difference being a logically deleted review.
- **L3** (finding, parent): `viaFollowedAuthor` is required on `Review` and viewer-relative. It carries no
  meaning for moderation, so the screen does not show it and must not cache it.
- **L4** (delivered, parent): the delegated writer failed with `provider_unavailable` and wrote nothing, so
  the unit was built inline on this branch, test-first: the spec was written first and the RED run failed
  on `Cannot find module './reviews'`, then the screen turned it green.
- **L5** (bug, caught by the spec): the first version left the row's status select showing the value the
  user had picked after the server refused the change — a bound `[value]` that did not move is invisible
  to change detection, so nothing reset it. The handler now receives the element and restores the row's
  real status on failure, because a control must not keep claiming a write that did not happen.
- **L6** (delivered): `AdminApi.listAdminReviews` / `setReviewStatus`, the `AdminReview` hand-written type
  with its `wire-contract` guard, the screen on `app-data-table` with a per-row status select, and the
  module out of `soon`. `viaFollowedAuthor` is kept in the hand-written type only because the generated
  schema requires it; nothing in the screen reads it. Verified: `tsc` app and spec exit 0,
  `ng test admin` **125 tests / 25 files green**, `ng build` green with `reviews` as its own 6.7 kB chunk.
  One spec expectation was corrected, not weakened: it asserted no `<tr>` at all, while the base table
  renders an empty row; the intent is "no data row", now asserted as zero row controls plus `0 reviews`.
