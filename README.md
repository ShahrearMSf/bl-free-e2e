# bl-free-e2e

**Environment-independent end-to-end test suite for the BetterLinks (Free) WordPress plugin.**

## Why "environment-independent"

Every test in this suite is designed to run against **any** WordPress install where BetterLinks (Free) is active — whether that's:

- a throwaway CI runner with a fresh WP install (used by `e2e-free.yml` in the BetterLinks repo),
- a local Docker / Local / MAMP dev site,
- a staging site with a mix of pre-existing content,
- a review app with only a default theme + plugin.

Specifically, the suite makes **no assumptions** about the state of the target site. To hold that property, every test follows these rules:

| Rule | How it's enforced |
|---|---|
| **No assumption of pre-existing data.** | Tests that need a link / category / post create it themselves in `beforeAll` via REST, and delete it in `afterAll`. |
| **No assumption of specific existing links, categories, or settings.** | Listings are checked for test-created slugs only. No test asserts "there are exactly N links" or "the 3rd category is X". |
| **No mutation of pre-existing user data.** | Cleanup is scoped strictly by slug / name prefix (`e2ef-*` for links, `E2EF-*` for terms). Anything the user created is untouched. |
| **Self-contained authentication.** | `auth.setup.js` logs in with env-provided creds; subsequent tests reuse the stored `storageState`. No hardcoded sessions. |
| **Pro-independent.** | Tests only exercise free-plugin surfaces. One negative test (`01-navigation`) actively asserts Pro-only slugs return 403 — so if the test site somehow has Pro installed, the run flags it. |
| **Tolerant of drift.** | Multiple known surfaces (role-based + class-based locators, REST route fallbacks) are checked where BL's admin UI has shifted across versions. |
| **Tolerant of WP_DEBUG noise.** | The REST-nonce helper strips PHP warning HTML that some debug-enabled sites prepend to admin-ajax responses. |
| **No dependence on outbound network.** | All tests use `https://example.com/` or `example.net` as target URLs — they are never actually followed by the test runner. |

In short: **drop this suite against any fresh BL-Free site with an admin user and it should run green, independent of anything else on the site.**

---

## Running locally

```bash
cp .env.example .env     # set BASE_URL, ADMIN_USER, ADMIN_PASS
npm ci
npx playwright install --with-deps chromium
npm test                 # runs auth-setup + free
```

Env vars (`.env`):

```
BASE_URL=http://localhost:8080
ADMIN_USER=admin
ADMIN_PASS=admin
TEST_SLUG_PREFIX=e2ef         # optional — scope of cleanup
```

## Running in CI

The `e2e-free.yml` workflow in the BetterLinks repo:

1. Builds a plugin zip from source via the 10up action.
2. Stands up WP + MySQL on an Ubuntu runner.
3. Clones **this** repo into `e2e-suite/`.
4. Runs `npx playwright test --project=auth-setup --project=free`.
5. Uploads HTML report + video + debug log on failure.

No coordination is required between this repo and the plugin repo beyond the workflow pointing at the correct `repository` + `ref`.

## Specs

| File | What it covers |
|---|---|
| `auth.setup.js` | One-time admin login; saves auth state to `playwright/.auth/admin.json` |
| `01-navigation.spec.js` | Each free admin page mounts; Plugins row shows active; Pro-only slugs return 403 |
| `02-settings.spec.js` | Settings page renders; tab switching; Save Settings posts to REST |
| `03-link-crud-api.spec.js` | REST CRUD; redirect type 301/302/307 persistence; Uncategorized default |
| `04-link-crud-ui.spec.js` | UI create via modal; empty-target validation; seeded-list rendering |
| `05-instant-redirect.spec.js` | 301 / 302 / 307 redirects; query-string preservation; unknown = 404 |
| `06-categories-tags.spec.js` | REST CRUD for categories + tags; Uncategorized exists; page renders |
| `07-pro-upsell.spec.js` | Upgrade link; `is_pro_enabled=false`; Pro features advertised in modal + Advanced |
| `09-analytics-smoke.spec.js` | Analytics page mounts; date-range control; analytics REST endpoint alive |
| `10-link-scanner-smoke.spec.js` | Scanner tabs; Start New Scan / Clear Logs buttons; tab switching |
| `11-manage-links-ui.spec.js` | Manage Links toolbar; seeded link renders in DOM source |
| `12-link-options-api.spec.js` | nofollow / sponsored / param_forwarding / track_me persistence |
| `13-slug-validation.spec.js` | Empty slug rejected; extreme lengths; special chars sanitised |
| `14-dashboard-notice.spec.js` | Promo notice renders; dismissible |
| `15-frontend-headers.spec.js` | nofollow redirects; param_forwarding=1 forwards query, =0 strips it |
| `16-rest-contract.spec.js` | REST namespace discovery; expected routes; no-auth rejection |
| `17-activation-health.spec.js` | Plugin class loaded; BL namespace registered; no PHP fatal |

## Prerequisites on the target WordPress site

- Pretty permalinks enabled (`/%postname%/` or equivalent) — required for short-URL redirects.
- BetterLinks plugin installed and activated.
- Admin user with `manage_options`.
- Reachable `BASE_URL` for the Playwright runner.

## Artifacts

| Path | Purpose |
|---|---|
| `playwright-report/` | HTML report from the last run |
| `test-results/` | Per-test screenshots, traces, videos on failure |
| `playwright/.auth/admin.json` | Stored admin session (gitignored) |

## Cleanup behavior

- **Pre-run** (`globalSetup`): sweeps anything from a previous/interrupted run.
- **Post-run** (`globalTeardown`): same sweep, always runs.
- **Prefix-scoped**: only deletes links whose `short_url` starts with `e2ef-` and terms whose `term_name` starts with `E2EF-`. Safe to run against any site.
- **Emergency manual sweep**: `node -e "require('./helpers/cleanup').sweep({verbose:true}).then(console.log)"`
