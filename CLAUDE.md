# WealthOS Hub — Agent Operating System

> This file is the operating contract between the human and the AI agent working in this repository.
> It defines mission, permissions, memory, context budget, and self-correction rules.
> Read this file in full at the start of every session before touching any code.

---

## 1. Mission & Constraints

### Primary Objective

Accelerate development of **WealthOS Hub** — an AI-powered personal hedge fund dashboard — by writing correct, secure, minimal-scope TypeScript/React code that ships features and fixes without introducing regressions or security vulnerabilities.

### Autonomous Actions (no human approval needed)

- Read any file in the repository
- Edit or create source files under `src/`, `supabase/functions/`, `supabase/migrations/`
- Run `npm`/`bun` scripts: `dev`, `build`, `lint`, `test`, `test:watch`, `preview`
- Run `supabase` CLI commands that are read-only or local-only (`status`, `db diff`, `gen types`, `functions serve`)
- Install or update **dev dependencies** that are already within the project's dependency ecosystem
- Add shadcn/ui components via `npx shadcn@latest add <component>`
- Write or update test files under `src/test/` or alongside components
- Update `MEMORY.md` and memory files under `.claude/projects/`
- Refactor code within a clearly scoped request (one file or one feature area at a time)

### Requires Human Approval Before Proceeding

- Any `git push`, `git push --force`, or branch operations that affect remote
- Creating or merging pull requests
- Running `supabase db push` or `supabase migration up` against a **production** Supabase project
- Deploying edge functions to production (`supabase functions deploy`)
- Changing `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, or any `.env` secrets
- Installing **production dependencies** not already in the project's ecosystem
- Deleting any file outside of a stale test artifact or build artifact
- Any operation that touches the Supabase project `exdocqfinannitrapqdz` remotely
- Schema changes that DROP tables, DROP columns, or remove RLS policies
- Any action that would modify shared infrastructure, CI/CD pipelines, or external APIs

### Absolute Prohibitions

- Never commit `.env` files or expose secret keys in code
- Never generate SQL that bypasses Row-Level Security policies
- Never introduce `eval()`, raw SQL string interpolation, or `dangerouslySetInnerHTML` without explicit sanitization
- Never remove TypeScript types in favor of `any` without a documented reason
- Never add speculative features, extra abstractions, or "while I'm here" cleanup beyond the stated task
- Never push to `main` directly — always confirm with human first

---

## 2. Tool Permissions

All tool use is governed by the principle: **if it's not listed here as approved, ask first.**

### Read (unrestricted)
- **Approved:** Any file in the repo for context gathering; always read before editing
- **Limits:** None; prefer reading only what is needed to avoid context bloat

### Edit / Write
- **Approved:** `src/**`, `supabase/functions/**`, `supabase/migrations/**`, `*.config.ts`, `*.config.js`, `tailwind.config.ts`, `CLAUDE.md`, `.claude/**`
- **Limits:** One logical change per tool call; prefer Edit over Write for existing files
- **Requires approval:** Files in project root that affect build identity (`package.json` name/version, `index.html` meta)

### Bash
- **Approved scripts:** `npm run dev|build|lint|test|test:watch|preview`, `bun run <script>`, `npx shadcn@latest add`, `supabase gen types typescript`, `supabase db diff`, `supabase functions serve`, `git status`, `git diff`, `git log`
- **Approved installs:** Dev-only packages (`bun add -D <pkg>`) within existing ecosystem; confirm before adding production deps
- **Requires approval:** Any `git commit`, `git push`, `supabase db push`, `supabase functions deploy`, `rm -rf`, package manager operations that modify `package.json` prod dependencies
- **Rate limit:** Do not chain more than 5 sequential Bash calls without reporting status to user

### Glob / Grep
- **Approved:** Unrestricted; preferred over Bash `find`/`grep` for all file searches

### Agent (subagents)
- **Approved:** Explore agent for codebase research; Plan agent for architecture decisions
- **Limits:** Do not spawn subagents for tasks completable with 1–2 direct tool calls; avoid duplicating searches the subagent is already doing

### Supabase MCP (`mcp__supabase__*`)
- **Approved (read-only):** `list_tables`, `list_migrations`, `get_project`, `get_project_url`, `generate_typescript_types`, `search_docs`, `get_advisors`, `list_branches`, `get_logs`
- **Approved (local/safe):** `execute_sql` against a local dev branch only
- **Requires approval:** `apply_migration`, `deploy_edge_function`, `create_project`, `create_branch` (production), `execute_sql` against production project ID `magpawmyuqyzgczewxsl`

### GitHub MCP (`mcp__github__*`)
- **Approved:** `get_file_contents`, `list_commits`, `search_code`, `get_issue`, `get_pull_request`
- **Requires approval:** `create_pull_request`, `push_files`, `merge_pull_request`, `create_issue`, `add_issue_comment`

### WebSearch / WebFetch
- **Approved:** Documentation lookups, library changelogs, MDN, Supabase docs
- **Limits:** Do not fetch URLs that are not clearly documentation or reference material; never upload project code to external tools

### All other MCP tools (Canva, Notion, Indeed, ElevenLabs, Pexels, etc.)
- **Status:** Not relevant to this project; do not invoke without explicit human instruction

---

## 3. Memory Architecture

### Session-Start Protocol (read in this order before touching any code)

1. `CLAUDE.md` (this file) — operating contract
2. `MEMORY.md` — index of persisted facts; check for stale entries
3. `package.json` — current dependencies and scripts
4. `src/integrations/supabase/types.ts` — current DB schema types
5. Any memory file flagged as "active" in MEMORY.md for the current task area
6. Relevant source files for the stated task (read, don't assume)

### What to Persist in MEMORY.md

**Persist (write a memory file):**
- User preferences and collaboration style corrections
- Architectural decisions that aren't obvious from reading the code (e.g., "we intentionally use mock data on the Compound page because the Supabase table isn't seeded yet")
- Recurring project constraints (e.g., "strict mode is OFF intentionally — Lovable scaffold")
- Approved deviations from standard patterns (e.g., "we use `any` in edge function responses until schema stabilizes")
- External API keys or environment variable names that gate features (names only, never values)
- Active project goals, deadlines, or context that inform prioritization

**Summarize (keep brief in memory, not verbatim):**
- Bug fixes — capture the root cause pattern, not the diff
- Feature completions — capture what was shipped and any known follow-up
- Test coverage status per feature area

**Discard after session (do not persist):**
- In-progress task lists for the current session
- Intermediate debugging steps and dead ends
- File contents — the files themselves are authoritative
- Build output, lint output, test results (unless a pattern is noteworthy)

### Memory File Hygiene

- Before writing a new memory, check if an existing file should be updated instead
- Remove memories that are contradicted by the current code state
- Tag project memories with absolute dates (not relative like "last week")
- Memory files live at `/Users/jayburgess/.claude/projects/-Users-jayburgess-CODING-revsys-wealthos-hub/memory/`

---

## 4. Context Budget Rules

### Always in Context (system prompt / session start)

- This `CLAUDE.md` file (full)
- Active `MEMORY.md` index (full)
- Current task statement from the user

### Load on Demand (read only when relevant to the task)

- `src/integrations/supabase/types.ts` — when working with DB queries, RLS, or type generation
- `src/lib/compoundEngine.ts` — when working on Compound page or financial math
- `src/data/strategyTiers.ts` + `src/data/mockData.ts` — when working on Signals, Dashboard, or Compound features
- `supabase/migrations/*.sql` — when adding or altering schema
- `supabase/functions/*/index.ts` — when working on Edge Functions
- Individual page files (`src/pages/*.tsx`) — only the page(s) relevant to the task
- Individual component files — only those referenced by the task

### Context Budget Limits

- **Tool result cap:** Truncate or summarize any single tool result exceeding ~300 lines before using it. For large files (>300 lines), read only the relevant section using `offset` and `limit`.
- **Supabase types file:** Read fully only when generating types or writing new queries; otherwise read the relevant interface only
- **node_modules:** Never read. Use `package.json` and documentation instead.
- **Compression trigger:** If the active context feels saturated (many files open, long conversation), pause and summarize the key facts needed before continuing — do not rely on the model to silently compress without acknowledgment.

### File Size Reference (know before reading)

- `src/integrations/supabase/types.ts` — large (auto-generated); read targeted sections only
- `src/components/ui/` — 49 files; never read all at once; glob for the specific component needed
- `node_modules/` — off-limits entirely

---

## 5. Self-Correction Contract

After every major action (significant edit, new feature, schema change, dependency install), run the following structured review before responding to the user.

### Review Checklist

**1. Intent Match**
- Does the output do exactly what was asked — no more, no less?
- Were any features added that were not requested?
- Were any existing behaviors silently changed?

**2. Security Check**
- Does any new code accept user input without validation?
- Does any new SQL bypass RLS or use dynamic string interpolation?
- Are any secrets, keys, or tokens visible in the changed files?
- Does any new component use `dangerouslySetInnerHTML`?

**3. Type Safety**
- Were any `any` types introduced? If so, is there a documented reason?
- Do all new function signatures have explicit return types?
- Does the change break any existing TypeScript inference that was load-bearing?

**4. Guardrail Proximity**
- Did any action approach the "requires approval" boundary (production deploy, schema drop, secret exposure)?
- If yes: stop, surface this explicitly to the user before proceeding.

**5. Test Coverage**
- Does the changed code have a corresponding unit or integration test?
- If not, is the absence justified? (trivial UI, untestable in isolation, etc.)
- Were any existing tests broken by the change?

**6. Self-Hardening**
- Did anything happen in this session that should be added to this CLAUDE.md?
- Was a constraint violated, approached, or newly discovered?
- Should a memory file be created or updated?

### Output Format for Self-Correction

At the end of any session involving a major change, produce a brief summary:

```
REVIEW SUMMARY
- Intent matched: yes / no (explain if no)
- Security: clean / issue found (describe)
- Types: clean / any introduced (justify)
- Guardrails approached: none / describe
- Tests: covered / gap (describe)
- CLAUDE.md hardening needed: none / describe
```

This summary is for the human's benefit. Keep it to 6 lines. Do not pad it.

---

## Project Quick Reference

| Concern | Location |
|---|---|
| Entry point | `src/main.tsx` |
| Routes | `src/App.tsx` |
| Pages | `src/pages/*.tsx` |
| Layout | `src/components/layout/` |
| UI primitives | `src/components/ui/` |
| Financial logic | `src/lib/compoundEngine.ts` |
| Strategy tiers | `src/data/strategyTiers.ts` |
| Mock data | `src/data/mockData.ts` |
| Supabase client | `src/integrations/supabase/client.ts` |
| DB types | `src/integrations/supabase/types.ts` |
| Edge functions | `supabase/functions/` |
| Schema migrations | `supabase/migrations/` |
| Supabase project ID | `magpawmyuqyzgczewxsl` (confirm before any remote op) |
| Dev server | `http://localhost:8080` |
| Test runner | `npm run test` (Vitest) |
| E2E tests | Playwright (`playwright.config.ts`) |
| Env vars | `.env` (never commit) |

## Stack Constraints to Know

- **TypeScript strict mode is OFF** (`noImplicitAny: false`, `strictNullChecks: false`) — this is intentional from the Lovable scaffold. Do not enable strict mode without explicit request, as it will surface hundreds of errors.
- **Edge functions run Deno**, not Node. Import from `npm:` specifiers or `jsr:` — not bare CommonJS.
- **Supabase types** are auto-generated. Never hand-edit `src/integrations/supabase/types.ts`. Run `supabase gen types typescript` to regenerate after schema changes.
- **Shadcn/ui** components live in `src/components/ui/`. Add new ones via `npx shadcn@latest add <name>` — never copy-paste from docs.
- **Path alias** `@/` maps to `src/`. Always use this alias for imports within `src/`.
- **Framer Motion** is installed and in use. Prefer it for animations over CSS keyframes for component-level transitions.
- **React Query** (`@tanstack/react-query`) is the data-fetching layer. Do not add `useEffect` + `useState` for async data fetching; use `useQuery`/`useMutation`.
