# Help guide and tooltips

Route: Feature Build. UI only. No schema, auth, tenancy, secret or integration change.

## Objective
Show users how the app works and what each area is for: a full Help page plus in-place tooltips.

## In scope
- `/help` page (protected route): start here, the five areas, page-by-page guide, glossary, FAQ, search.
- Contextual "How this page works" popover in the top bar, resolved from the current path.
- `InfoTip` component (small info icon + tooltip) driven by glossary keys.
- Tooltips on the top-bar area pills, Simple/Pro switch, and the Money coach card titles.
- Single content file `src/lib/help/content.ts` so copy lives in one place.

## Out of scope (parked)
- Guided product tour / onboarding walkthrough overlay.
- Tooltips on every control of every Invest page (covered by the page-level popover instead).
- Per-user "dismissed" state in the database.

## Acceptance
- `/help` renders all sections and search filters glossary, FAQ and page guides.
- Every route prefix in the guide table resolves to a guide; unknown paths fall back to a generic one.
- Every `InfoTip` key exists in the glossary (test enforced).
- Copy states: paper-only Desk, "not financial advice", no promised returns.
- Plain sentences, no em dashes, one accent colour (theme tokens only).

## Non-negotiables
No new data access. No change to auth, roles or RLS. Theme tokens only.
