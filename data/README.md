# Planted stories in the synthetic data

Everything here is synthetic and generated deterministically: the wiki pages and BI export by
`scripts/generate-data.mjs`, and the large tables by seeded `HASH()` logic in `sql/setup.sql`.
Every run produces the same rows: each column hashes the row number with its own fixed salt (`HASH(n, 1)` … `HASH(n, 35)`), so the salts are the seed. The firm, Northwind Financial, and every person named are fictional.

| Data | Rows | Notes |
| --- | --- | --- |
| `CORE.ADVISORS` | 40 | 10 per region (Northeast, Southeast, Central, West) |
| `CORE.CLIENTS` | 90,000 | |
| `CORE.ACCOUNTS` | 140,000 | 131,000 OPEN, 9,000 CLOSED; as-of date 2026-11-15 |
| `CORE.ACCOUNT_EVENTS` | about 160,000 | OPEN, CLOSE, ADDRESS_CHANGE, BENEFICIARY_CHANGE |
| `CORE.SERVICE_REQUESTS` | 24,000 | Last 12 months, 7 request types, 3 channels |
| `CONTEXT.WIKI_PAGES` | 30 | `data/wiki/*.md`; also inlined in `sql/setup.sql` |
| `CONTEXT.BI_MODEL_EXPORT` | 6 metrics | `data/bi-model-export.json` |

## Story 1: two agents, two "active account" counts

- `WIKI-03` (account opening handbook): active = OPEN with a balance above zero (funded).
- `WIKI-11` (service metrics guide): active = OPEN with a login in the last 90 days.
- The data is built so exactly **120,402** accounts are funded and exactly **98,115** logged in within 90 days.
- The ungoverned account opening agent answers 120,402; the ungoverned maintenance agent answers 98,115.
- The governed agents both read `active_accounts` from `ACCOUNTS_SV` (with a verified query), so they agree.

## Story 2: two address-change procedures

- `WIKI-07` (2026): verify with two-factor authentication, submit ADDRESS_CHANGE, 1 business day.
- `WIKI-19` (2019): signed letter by mail, medallion signature check, 5 business days.
- The ungoverned agents each bookmarked a different page. Until the owner approves `WIKI-07`, Cortex Search
  can return both pages to the governed agents. Approval marks `WIKI-19` superseded and removes it from the index.

## Story 3: a BI metric missing from the semantic view

- `net_new_accounts_30d` is defined in the BI export but not in `ACCOUNTS_SV`, so the governed agents can't
  answer "net new accounts in the last 30 days" consistently. Approving it in the conflict resolver adds the
  metric (370 on this data set).

## Consistency monitor history

`AGENTS.EVAL_RESULTS` starts with 14 nights of **seeded** history (`seeded = TRUE`) so the trend has a past.
Runs started from the app or the nightly task are real: every agent is called and an `AI_COMPLETE` judge
decides agreement. In our live test on this data set, the governed pair agreed on 6 of 6 questions after the
three approvals, and the ungoverned pair on 2 to 3 of 6, depending on the run.

## Sample-mode data

`data/sample/overview-stats.json` holds the overview's charts (both "active" definitions by account type, service requests by type, row counts), captured from a live run on 2026-11-20. On this data set the account types sum to exactly 120,402 funded and 98,115 logged-in accounts.

## Sample-mode AI text

`data/sample/*.json` holds outputs captured from a live run of this example: AI_EXTRACT candidates,
AI_COMPLETE conflict explanations, agent answers, judge notes, and orchestrator answers. The app labels
them **Sample AI response**.
