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
| T4 | S6 | dropped | Roles keeps its table: its status column is a tag, the fixed cell API cannot express one, and S8 forbids growing a per-cell escape hatch for a single screen. Recorded as a deliberate non-migration. Note: the tag variant added in T8 removed the colour blocker; what still stops Roles is its module group headers, not the pill |
| T5 | S3, S6 | done | Users' three dialogs move onto the shell, keeping their current fields and texts |
| T6 | S6, S7 | done | `tsc` app + spec, full suite, `ng build` |
| T7 | S2 | done | Record the forward rule where the next author will read it |
| T8 | S2, S6 | done | Users renders its rows through `<app-data-table>`, with its own query state (search, status, scope, paging, row actions) instead of `crud-list-screen` |
| T10 | S7 | done | ng-zorro follows the panel's radius and surface tokens through a documented bridge layer, and the `--surface-2` dark gap is closed |
| T11 | S7 | done | Accent replaced with Melia's coral `#FF5A36`, `--warn` moved to a colder yellow, and every accent-as-text usage now reads `--accent-ink` |
| T9 | S2, S6 | done | Audit renders its rows through `<app-data-table>`, keeping the exact-event filter, the user and email-hash filters and the two `datetime-local` range inputs |

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
- **L6** (scope, user): after the API session announced the discovery endpoints, the human chose to keep
  closing panel debt rather than start the reviews screen. T4 stays dropped; T8 and T9 finish the
  migration so the second table language disappears from the panel.
- **L7** (finding, parent): the audit spec pins engine details, not just rendering —
  `filters['event_eq']` on the transport, no `input[type="search"]`, and exactly two
  `input[type="datetime-local"]`. The migration must therefore reproduce the transport's filter keys
  (`field_kind`) exactly, keep both date inputs, and must not add a search box. `AdminTransport.list`
  stays the seam, so the engine can leave without the API contract moving.
- **L8** (decision, parent): migrating Users would have degraded the status column from a pill to plain
  text, and Roles was blocked for the same reason. Degrading a screen to fit a component is the wrong
  trade, so `app-data-table` gained a **declarative** `tag?: (row) => { label, variant }` column: still
  one of the design system's own components (`.tag`), not a per-cell template escape hatch. S8 holds.
- **L9** (delivered, parent): T8 and T9 landed inline after the delegated writer failed three times with
  `provider_unavailable` (the third attempt wrote nothing). Audit and Users now render through
  `<app-data-table>` with their own query state; `AdminTransport.list` stayed the seam, so no API
  contract moved. The engine-specific bindings the audit spec pins are preserved exactly
  (`filters['event_eq']`, no `input[type="search"]`, two `input[type="datetime-local"]`), and Users
  keeps its `Edit`/`Roles`/`Send reset` row actions and `Invite user` header action. Verified: `tsc`
  app and spec exit 0, `ng test admin` **119 tests / 24 files green** with both specs unedited,
  `ng build` green. `crud-list-screen` no longer renders any panel screen; `ng-crud-maker` stays as a
  dependency for `ListQuery`, the demo screen and the transport contract.
- **L10** (decision, user + parent): the human asked for ng-zorro to follow the rounded-corner convention
  "quizás haciendo un theme", plus a correct dark balance between the modal background and its inputs.
  Investigated before building: ng-zorro 22 ships `ng-zorro-antd.variable.css`, but it defines only 40
  custom properties — the primary colour family — with no radius, no surface and **no dark variant**.
  A declarative theme is therefore not available, so the honest route is one bridge layer in
  `src/styles.css`: vendor selectors, panel tokens, each prefixed with `body` because `PanelLayout`
  appends the vendor sheet to `<head>` after ours and an equal-specificity rule would lose.
  Radius is 9px for controls and 12px for surfaces from `--radius-sm`/`--radius`; the modal, its header
  and footer, the fields, the dropdown, the primary and default buttons and the checkbox now read the
  panel's tokens instead of Ant's palette.
- **L11** (bug, parent): `--surface-2` had a light value only. Dark mode inherited `#f8fafc`, so every
  soft surface turned near-white: the Places card footer, the access-denied panel and three auth screens.
  Closed with a dark value in the same commit as the bridge.
- **L12** (decision, user): the indigo accent reads badly against the dark surfaces, so the panel moves to the
  orange the landing page already uses, and `--warn` moves from amber to yellow to keep warning distinct
  from brand. Two conditions were fixed by the human: the exact token set is taken from the landing
  session rather than invented (asked for: base, hover, soft, focus ring and the text-on-colour rule),
  and the warning hue moves with it. Blocked on that answer; nothing was changed in the theme yet.
- **L13** (finding, parent): the swap is token-shaped — 41 uses of `var(--accent)`, 12 of `--accent-soft`,
  6 of `--accent-hover`, 3 of `--accent-ring` across 15 files — but three literals would survive it and
  must be fixed in the same commit: `--accent-ring: #8b87f8`, the info-tag inks `#3730a3` / `#c7c4ff`
  and a `#eef0fe` border in `src/styles.css`, `#8b87f8` in `src/app/landing/panel-preview.css`, and
  `#4338ca` in `src/app/demo/faqs-demo.css`. The dark theme needs `--on-accent` re-checked too: white on
  an orange is not automatically AA.
- **L14** (measured, landing session): the coral is `#FF5A36`, hover `#E64825` or lighter `#FF6B4A`, soft
  `#FFF1EE` with `#B52603` on it, focus ring `#B52603` (light) / `#FFB9A3` (dark). The decisive number:
  **white on the coral is 3.10:1 and fails AA**, so the panel's primary buttons now carry dark text
  (`--on-accent: #111111`, 6.09:1) instead of white. I re-measured every pair rather than trusting the
  table: `#B52603` as text is 6.47 on white and 5.88 on the soft, the coral itself is 5.52 on the dark
  surface (so dark keeps it) and `#FFB39C` is 9.93 there.
- **L15** (delivered, parent): applied across 13 files. A new `--accent-ink` token exists because the
  accent had been used as both fill and text, and only one of those is AA-safe; every `color:
  var(--accent)` became `--accent-ink`. Hover is the lighter `#FF6B4A` (6.70:1 with dark text) rather
  than the darker `#E64825` (4.78:1, tight margin). `--warn` is `#A16207` on light and `#FACC15` on
  dark, with the warn pills at `#FEF9C3`/`#854D0E` and `rgba(234,179,8,.18)`/`#FDE047`. The literals
  that would have survived the swap are gone: `#8b87f8` in the landing preview, `#4338ca` and
  `#3730a3` in the demo, and the violet soft-chip border. Incident worth keeping: the first pass
  rewrote `border-color` too, because `color: var(--accent)` matches inside `border-color`; caught by
  grepping for `-color: var(--accent-ink)` and reverted, so borders and checkbox accents use the fill
  while only text uses the ink.
- **L16** (bug, cross-session): the landing session flagged that the panel's active sidebar row was still
  violet, and it was: `rgba(139, 135, 248, …)` for the row, the same in rgba for its inset ring, and
  `#a5a1ff` for the icon. The earlier "no stale palette" check grepped a list of hex literals and could
  not see an `rgb()` triple, so a whole component survived the swap. Fixed with
  `color-mix(in srgb, var(--accent) 18%, transparent)` and `var(--accent)` for the icon.
  Second trap found in the same edit: `var(--ink)` is wrong for that row, because the sidebar is dark in
  both themes and `--ink` flips to near-black on light; the label keeps a literal white with a comment
  saying why. Lesson recorded: after a palette change, grep for the old colour in **every** notation
  (hex, rgb, rgba, oklch), not in the list you happen to remember.
