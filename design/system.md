# melZone design system

Source of truth: `src/styles.css` (the only design source in this repository). Everything below is
a value read from that file; nothing is invented. Note the file's own comment: the palette came from
`design/admin-dashboard/02-landing-product.html`, and **components read variables, never literal hex
values**.

## Color

### Surfaces

| Token | Light | Dark (`[data-theme='dark']`) | Usage |
|---|---|---|---|
| `--canvas` | `#f5f7fa` | `#0b1220` | page background (`body`) |
| `--surface` | `#ffffff` | `#121c2b` | cards, tables, inputs |
| `--surface-muted` | `#fcfdfe` | `#16202f` | table header row |
| `--surface-2` | `#f8fafc` | — | soft surface |
| `--ink` | `#0b1220` | `#e6edf6` | primary text |
| `--ink-2` | `#111c31` | `#0f1826` | secondary ink |
| `--nav` | `#0f1a2b` | `#0a1220` | sidebar |
| `--nav-2` | `#16233a` | `#142030` | sidebar raised |

### Text

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--slate` | `#475569` | `#b3c2d4` | secondary text, icons |
| `--muted` | `#64748b` | `#93a4b8` | hints, subtitles, table captions |

Table header labels use the literal `#8592a6` in `.panel-table th`; it is the one color that is not
a token, so treat it as a pending token (`--table-head-ink`).

### Lines and accent

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--line` | `#e3e8ef` | `#22304a` | hairline borders |
| `--line-soft` | `#f0f3f8` | `rgba(255,255,255,.07)` | table row separators |
| `--accent` | `#4338ca` | `#5a52e0` | the only accent: primary buttons, focus, active nav |
| `--accent-hover` | `#372fb0` | `#6b63f5` | primary hover |
| `--accent-soft` | `#eef0fe` | `rgba(124,116,255,.18)` | info pill background |
| `--accent-ring` | `#8b87f8` | `#8b87f8` | `:focus-visible` outline (3px, offset 2px) |
| `--on-accent` | `#ffffff` | `#ffffff` | text on accent |

Indigo is the **only** accent. Teal, emerald and warn are reserved for state, never decoration.

### State

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--teal` | `#0e7490` | `#22a5bd` | informational emphasis |
| `--ok` | `#047857` | `#34d399` | success |
| `--warn` | `#b45309` | `#f0b429` | warning |
| `--danger` | `#b91c1c` | `#f87171` | destructive |
| `--tag-ok-bg` / `--tag-ok-ink` | `#e9f5ee` / `#046c4e` | `rgba(52,211,153,.16)` / `#6ee7b7` | `.tag.ok` |
| `--tag-warn-bg` / `--tag-warn-ink` | `#fdf3e3` / `#8a5008` | `rgba(240,180,41,.18)` / `#fcd34d` | `.tag.warn` |
| `--tag-info-bg` / `--tag-info-ink` | `var(--accent-soft)` / `#3730a3` | `rgba(124,116,255,.2)` / `#c7c4ff` | `.tag.info` |
| `--tag-neutral-bg` / `--tag-neutral-ink` | `#eef1f6` / `#5a6779` | `rgba(255,255,255,.08)` / `#b3c2d4` | `.tag.neutral` |
| `--tag-danger-bg` / `--tag-danger-ink` | `#fdecec` / `#991b1b` | `rgba(248,113,113,.18)` / `#fca5a5` | `.tag.danger` |
| `--alert-bg` / `--alert-line` / `--alert-ink` | `#fdf3f3` / `#f3d2d2` / `#8f1d1d` | `rgba(248,113,113,.12)` / `rgba(248,113,113,.35)` / `#fca5a5` | `.alert` |
| `--alert-code-bg` | `#f7e3e3` | `rgba(248,113,113,.2)` | `<code>` inside `.alert` |

## Typography

| Token / rule | Value | Usage |
|---|---|---|
| `--font-sans` | `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | everything |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | `.mono`, ids, error codes, `.alert code` |
| body | `14px` / `1.55`, `-webkit-font-smoothing: antialiased` | base |
| `h1, h2, h3` | `letter-spacing: -0.02em`, `margin: 0` | headings |
| `.pagehead h1` | `22px` / `700` | screen title |
| `.pagehead p` | `13px`, `--muted` | screen subtitle |
| `.panel-table th` | `10.5px`, `700`, `letter-spacing: .09em`, `uppercase` | column labels |
| `.panel-table td` | `12.5px` | cell text |
| `.panel-table .mono` | `11.5px` | ids |
| `.tag` | `11px` / `650` | pills |
| `.btn` | `13px` / `650` | buttons |
| `.toolbar .field` | `12px`, `--muted` | filter labels |

Weights in use: `650` (buttons, pills), `700` (headings, table headers). No other weight appears.

## Spacing

There is no formal spacing scale in the source; these are the values the file actually uses. Reuse
them rather than inventing new ones.

| Value | Where it appears |
|---|---|
| `2px`, `4px` | pill padding, `.sr-only` |
| `5px` | toolbar label gap, `.tag` icon gap |
| `8px`, `9px` | `.btn` vertical padding, `.panel-table` cell vertical padding |
| `11px` | input padding |
| `12px` | `.alert` padding, `.toolbar` gap |
| `14px` | `.btn` horizontal padding, `.alert` margin-bottom, `.pager` margin-top |
| `16px` | `.pagehead` margin-bottom, table cell horizontal padding |
| `20px` | `.pagehead` gap |

## Shape, depth, motion

| Token | Value | Usage |
|---|---|---|
| `--radius` | `12px` | cards, tables, alerts |
| `--radius-sm` | `9px` | buttons, inputs, theme toggle |
| `--radius-pill` | `999px` | tags |
| `--shadow-sm` | `0 1px 2px rgba(11,18,32,.06)` | resting elevation |
| `--shadow-lg` | `0 34px 60px -46px rgba(11,18,32,.6)` | overlays |
| transition | `0.16s ease` on background, border-color, color | buttons, theme toggle |
| focus | `3px solid var(--accent-ring)`, `offset 2px`, `border-radius: 6px` | `:focus-visible`, global |
| reduced motion | `transition: none !important; animation: none !important` | `@media (prefers-reduced-motion: reduce)` |

## Component rules

- **`.btn`** — `inline-flex`, `gap: 8px`, `--radius-sm`, `1px solid transparent`. Variants:
  `.primary` (accent background, `--on-accent` text, hover `--accent-hover`) and `.secondary`
  (surface background, `--line` border, `--ink` text, hover border `#cbd5e1`). Disabled: `opacity: .6`,
  `cursor: not-allowed`. Screens add layout, never colour.
- **`.tag`** — pill, `11px`/`650`, variants `.ok .warn .info .neutral .danger`. Used for statuses
  and permission codes across screens.
- **`.card`** — surface, `1px solid var(--line)`, `--radius`.
- **`.pagehead`** — flex, `align-items: flex-end`, `space-between`, `gap: 20px`, `margin-bottom: 16px`;
  `h1` + optional `p` subtitle.
- **`.toolbar`** — flex, `gap: 12px`, wrap; `.field` is a grid with a `5px` gap, `min-width: 220px`,
  `max-width: 340px`, `.narrow` `180px`. Inputs/selects: `--surface`, `--line` border, `--radius-sm`,
  `8px 11px` padding, focus border `--accent`.
- **`.table-wrap` + `.panel-table`** — the table lives inside the wrapper, which owns the border and
  radius. Header row on `--surface-muted`, row separators `--line-soft`, last row without a border.
  `.actions` is right-aligned and nowrap; `.empty` centres a muted message.
- **`.pager`** — flex, `gap: 14px`, `12.5px`, `--muted`.
- **`.alert`** — flex space-between, alert tokens, `--radius`, holds a `<code>` with the API error code.
- **`.theme-toggle`** — `32×32`, `--radius-sm`, `--line` border; hover border becomes `--accent`.
- **Dark theme** — only tokens change under `[data-theme='dark']`, plus `color-scheme: dark`. A
  component that reads a variable gets the dark value for free: never branch on the theme in a
  component.
- **Accessibility** — `.sr-only` exists for off-screen table captions and headers; focus is always
  visible; contrast is checked against `--canvas`/`--surface`.
