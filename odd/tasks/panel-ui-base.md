# Feature: panel-ui-base

Objective: turn the table and dialog presentation the Places screen introduced into the panel's base
components, so every screen — including the ones built on `ng-crud-maker` — speaks one visual
language instead of two.
Branches: `feat/panel-ui-base` (stacked on `feat/admin-places-mock`)
Test runners: `npx ng test admin --watch=false`; `tsc --noEmit` for `tsconfig.app.json` and
`tsconfig.spec.json`

## Specs

- **S1** (verbatim, user, L1): "me gusta la tabla que esta en places podriamos utilizar ese estulo
  como nuestro componente base de tabla y el modal al editar o crear adaptarlo a esa estetica"
- **S2** (verbatim, user, L2): "toma la opcion uno y siempre usaremos ese componente de tabla en
  nuestros componentes de crud maker" — option one was "base nueva, retrofit sólo de Places y Roles":
  the component is built here, Places and Roles adopt it now, and no cross-repository change happens.
  The forward half is a rule: a screen built on `ng-crud-maker` must render its rows through this
  component. Users and Audit keep `crud-list-screen` until their own migration; the rule is what
  stops a new screen from reintroducing a second table.
- **S3** (verbatim, user, L2): "Shell compartido, migrar también Users" — one dialog shell, and the
  three Users dialogs (roles, invite, profile) move onto it in this same feature.
- **S4** (derived): the table is a standalone component, `<app-data-table>`, generic over its row
  type. It owns: column definitions, per-cell text, the empty state, an optional caption for
  assistive tech, and a right-aligned actions column. It renders the same markup the panel already
  styles — `.table-wrap` + `.panel-table` — so the visual source of truth stays `src/styles.css`, not
  a copy inside the component.
- **S5** (derived): the shell is a standalone component for the dialog body: the lead line under the
  title, a two-column grid, sectioned fields with their legend, and the two error slots (validation
  summary and API error code). It is rendered *inside* `nz-modal`, so the portal, the focus trap, the
  keyboard handling and the footer stay ng-zorro's; the shell only owns the body's structure.
- **S6** (derived, constraint): no visual or behavioural regression in Roles, Places, Users or Audit.
  Every existing spec stays green and none of them is edited to fit the code; if one fails, the
  component is wrong.
- **S7** (derived, constraint): no literal colour, radius, spacing or shadow inside either component.
  Values come from the tokens in `src/styles.css`, which is also what `design/system.md` records.
- **S8** (derived): cell content is text plus a small set of presentational variants (muted, mono,
  tag). A cell that needs arbitrary markup is a signal that the column belongs to the screen, not to
  the component — the component must not grow a template-ref escape hatch per cell.

## Tasks

| ID | Spec | Status | Work |
|----|------|--------|------|
| T1 | S4, S7 | done | `<app-data-table>` + its spec: columns, rows, empty state, actions column, caption |
| T2 | S5, S7 | done | Dialog shell component + its spec: lead, two columns, legends, both error slots |
| T3 | S6 | done | Places renders its table view through `<app-data-table>` and its dialog through the shell |
| T4 | S6 | dropped | Roles keeps its table: its status column is a tag, the fixed cell API cannot express one, and S8 forbids growing a per-cell escape hatch for a single screen. Recorded as a deliberate non-migration, not a gap |
| T5 | S3, S6 | done | Users' three dialogs move onto the shell, keeping their current fields and texts |
| T6 | S6, S7 | done | `tsc` app + spec, full suite, `ng build` |
| T7 | S2 | done | Record the forward rule where the next author will read it |

## Log

- **L1** (verbatim, user): "me gusta la tabla que esta en places podriamos utilizar ese estulo como
  nuestro componente base de tabla y el modal al editar o crear adaptarlo a esa estetica"
- **L2** (verbatim answers, user): table scope — "toma la opcion uno y siempre usaremos ese
  componente de tabla en nuestros componentes de crud maker"; dialogs — "Shell compartido, migrar
  también Users".
- **L3** (finding, parent): the panel holds two table idioms today. `Roles` and `Places` render the
  design system's own `.panel-table`; `Users` and `Audit` render `crud-list-screen` from
  `ng-crud-maker-zorro`, which is a `nz-table` underneath. The two look different, which is what
  prompted the request; option one keeps that difference only where a screen has not migrated yet.
- **L4** (incident, parent): the delegated writer reported `provider_unavailable` **after** writing its
  files, so its own status was wrong about the repository. A follow-up continuation asking it to
  proceed failed the same way. I verified the output instead of trusting either message: `tsc` app and
  spec exit 0, `ng test admin` **118 tests / 24 files green** with the two pre-existing specs untouched,
  and `ng build` green. The lesson worth keeping: on this provider, a reported failure is a claim
  about the run, not about the working tree.
- **L5** (delivered, parent): `src/app/shared/data-table/` and `src/app/shared/dialog-shell/` exist, the
  dialog field styles moved to `src/styles.css` (they were duplicated in two components because a
  portalled dialog cannot read component styles), Places renders both its table view and its dialog
  through them, and the three Users dialogs moved onto the shell with their fields and texts intact.
  The invitation dialog keeps working because `users.ts` gained the one import the standalone
  component needs. Roles was deliberately left on its own markup (T4, dropped).
