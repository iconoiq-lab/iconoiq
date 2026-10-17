# Estimates: sizes, chats and usage

Phase 0 uses this file to give the client a range: chats, working days and a rough share of the weekly usage allowance. Exact usage can't be known in advance. After each client, the owner reads `/usage` and the real numbers go in "Actual results" below, so the next estimate is better.

## Sizes

| Size | Means | Chats | Usage per chat (first guess) |
|---|---|---|---|
| S | Settings, copy or a switch; no new code paths | up to 1 | 1-2% of a week |
| M | One screen or flow changed, or an account to connect and test | 1-2 | 2-4% of a week |
| L | New code across several files, or a look applied to every page | 2-3 | 4-8% of a week |

The chats column matches the phases table below and the trial run (2026-10-15, "Actual results"). The usage column is still a guess: the trial measured tokens, not the share of the week. Read `/usage` before and after the first real client's chats and replace it.

Tokens per chat in the trial (Sonnet chats, including cached reads): S about 125-230k, M about 290k, L about 250-310k per chat. A chat that reads big files (`src/index.css`, `docs/ui-system.md`, the home blocks) reaches 150k context quickly: that is the point to stop, update the handoff and start a new chat.

## Phases

| Phase | Size | Chats | Notes |
|---|---|---|---|
| 0 Brief | S | 1 | Plus the client's time to answer the gaps |
| 1 Setup | S | 1 | |
| 2 Look | M | 1-2 | Pick section versions, then one mockup and one round of changes |
| 3 Apply look | L | 2-3 | Every page at 390 px and 1440 px, light and dark |
| 4 New features | per feature | sum | Each new feature: S, M or L from the table above |
| 5 Accounts | M | 1-2 | Waits on the client's logins |
| 6 Content | M | 1-2 | L for more than about 100 products or many policies |
| 7 Launch | M | 1-2 | Includes the security audit |

**A store with no new features:** about 8 to 13 chats. At 2 to 4 chats a working day, that is 2 to 7 working days of chats (8 ÷ 4 to 13 ÷ 2, rounded up), plus the time spent waiting on the client.

## How Phase 0 adds it up

1. Start from the phases table (8 to 13 chats).
2. Add each new feature's chats (S ½-1, M 1-2, L 2-3).
3. Add ½ chat for each template feature the client keeps whose size in `FEATURES.md` is M or L and needs setting up (for example WhatsApp inbox, video calls, rewards).
4. Usage: add up each phase's size (phases table) and each feature's size (`FEATURES.md`, or the new feature's own), each at its per-chat guess from the sizes table. Give it as a range ("about 25-40% of one week").
5. Write the result in the "Plan and estimate" section of `PROGRESS.md`.

## Actual results

| Client | Date | New features | Chats | Working days | Weekly usage used | Notes |
|---|---|---|---|---|---|---|
| TEST Trial Store (made-up client, a trial) | 2026-10-15 | none (1 small one found: damage-only returns, Phase 4, not built) | 5 for Phases 0-3 (0: 1, 1: 1, 2: 1, 3: 2) | about 1.8 hours of chat time, plus the owner's answers | not measured (about 1.2M tokens over 5 Sonnet chats) | Each phase ran from the runbook with no blocker. Every friction point was fixed in the template the same day (sign-up without WhatsApp, delivery defaults, template-update script, category names in one place, home blocks, logo from text, contrast check, mockup starter). Phases 4-7 not run. |
