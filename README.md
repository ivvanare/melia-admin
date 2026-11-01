# melZone admin (SPA)

Angular 22 admin SPA for melZone: the public landing, the registration and sign-in screens,
password recovery, and the backoffice panel. See `AGENTS.md` for the repository rules and the
sibling `crud-maker` checkout this workspace links. The API and the database live in the
sibling repository `melia`.

## Routes

| Route | Screen | Access |
|-------|--------|--------|
| `/` | Public landing | anonymous |
| `/registro` | Two-step registration: details, then the six-digit code | anonymous |
| `/login` | Sign in | anonymous |
| `/recuperar` | Password recovery: email, then code + new password | anonymous |
| `/no-access` | Signed in but without `admin.access` | session |
| `/panel` | Overview: live totals, recent audit events, module status | `admin.access` |
| `/panel/users` | Users, capability scope, edit, roles, invite, reset | `admin.access` |
| `/panel/roles` | Roles and the permission catalogue | `admin.access` |
| `/panel/audit` | Audit log, filters by event, user, email hash and date range | `admin.access` |
| `/panel/account` | Profile, sign out, change email | `admin.access` |
| `/panel/faqs` | `crud-maker` demo over a memory transport | `admin.access` |
| `/panel/places`, `/panel/menus`, `/panel/reviews`, `/panel/routes` | "Coming soon" structure: no API yet | `admin.access` |
| `/account`, `/faqs` | Redirect to the panel routes above | — |

Navigation is data-driven from `src/app/panel/panel-nav.ts`: a module is listed only
when the session holds its `permission`, so the sidebar can never offer a screen the
API would answer with `403 permission_denied`.

## Session

The panel uses the browser transport (`../../api/API.md` §2): the refresh token lives
in an httpOnly cookie, the CSRF value in `sessionStorage`, and the access token in
memory only. `AuthService` rotates the session through one shared in-flight request,
because the API revokes the whole family when a rotated token is replayed.

## Design

Visual directions for this panel live in `design/admin-dashboard/` (static artboards,
`design.json` manifest). `design/system.md` does not exist yet; the implementation
tokens are the CSS variables at the top of `src/styles.css`.

## Development server

```bash
npx ng serve          # http://localhost:4200
npx ng test admin --watch=false
npx ng build
```

The dev build points at `http://localhost:9000/v1` through the `API_URL` injection token.
The services behind it (API, PostgreSQL, Redis, RabbitMQ, Mailpit) run from the `melia`
repository: `docker compose up -d` there. Mailpit's UI is on `:8025` and is where the
registration, recovery and invitation codes land in development.
