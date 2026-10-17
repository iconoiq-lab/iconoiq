# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats, so a new chat never needs the old one. The working rules (workflows, ultracode, effort, new chat or continue) live in `~/.claude/CLAUDE.md`, not here.

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-10-17 (copy made from the template, commit `2ba27f9`)

## State

- **Branch and last commit:** main, local only. The template is the `template` git remote.
- **Done:** fresh copy of the template. Demo Store name, neutral look and demo data (from the Dream Team demo Firebase project) until Phases 1 to 6 replace them.
- **Unfinished or uncommitted work:** none.
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`; if it is busy, see Gotchas); `node scripts/check.mjs` runs tests, build and screenshots (light and dark, 390 px and 1440 px).

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 1 | Phase 0: read `client-brief/`, fill in `REQUIREMENTS.md`, list the gaps (`[NEED: ...]`), plan and estimate in `PROGRESS.md`; stop at the owner gate | No | High |
| 2 | Close Phase 0 (write the owner's answers into `REQUIREMENTS.md`), then Phase 1 in the same chat | No | High |

**Message for the next chat:** `Proceed` (step 1). When step 1 stops at the owner gate, change it to `Proceed. Owner's answers: <paste>` (step 2).

## Waiting on the client or the user

- [NEED: the client's documents in `client-brief/`]

## Decisions (and why)

- 2026-10-17: Started from the template as is. Why: Phase 0 decides what changes.

## Gotchas

- `node scripts/check.mjs` takes about 2 minutes. The home page logs one 404 for `/catalog/products.json` until a catalogue snapshot is published: expected, not a failure.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline).
- `npm run lint` reports 48 old errors from the template's source store.
- Never sign in as admin on the preview before Phase 5: it reads the demo Firebase project, and opening a category page or the product form as admin calls `seedDefaultCategories()`, which writes `DEFAULT_CATEGORIES` to that project.
- Dev server port: if 5182 is busy, use another (`npx vite --port 5184 --strictPort --host 127.0.0.1`); `check.mjs` uses 5183 for its preview.
- Dev pages never reach network idle (Firebase listeners keep running): in Playwright scripts wait for `load` plus a short fixed wait, never `networkidle`.
