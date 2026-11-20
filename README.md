# One Answer Across Agents (governed context layer)

Help institutions give consistent answers when several AI agents touch the same data. Capture business context once, in governed semantic views and an approved procedure index, then reuse it in every agent.

This is a Snowflake example on **synthetic data** for a fictional firm, Northwind Financial. It's a Next.js app with a no-account mode and a live mode built on semantic views (with synonyms and a verified query), Cortex Search, three Cortex Agents, AI_EXTRACT, AI_COMPLETE, Horizon Catalog tags, and a Snowflake task.

**[Try the hosted example](https://sfc-gh-ooral.github.io/sfguide-governed-context-layer/try/)** · **[Guide](https://sfc-gh-ooral.github.io/sfguide-governed-context-layer/)**

> Synthetic data and illustrative logic only. This is not production, regulatory, or compliance advice.

## The problem

Each team ships an agent fast. Under the hood, each agent is often one LLM call with its own prompt and its own definitions. When a second agent arrives, the two answer the same question differently, for example "How many active accounts do we have?" or "How do I change a client's address?". The business context sits in people's heads, wikis, and BI models, not in metadata.

## What it does

| Screen | What you see | Snowflake capability (live mode) |
| --- | --- | --- |
| Side by side | One question asked of Agent A and Agent B with their own prompts, and of the governed agents A and B. An AI judge says whether each pair agrees | `AI_COMPLETE` (own-prompt agents and judge), two Cortex Agents sharing `ACCOUNTS_SV` and `PROCEDURES_SEARCH` |
| Context inventory | Glossary terms and metrics with owner, source (wiki, BI, inferred), and status (draft, conflict, missing, approved), with drill-down. Also the file-based BI import compared with the semantic view, and the definitions mined from 30 wiki pages | `AI_EXTRACT`, semantic views, `CONTEXT_STATUS` and `CONTEXT_OWNER` tags |
| Conflict resolver | Conflicting definitions side by side with an AI explanation. The owner picks one, adds a note, and approves | `AI_COMPLETE`; `APPROVE_DEFINITION` rebuilds `ACCOUNTS_SV` from the glossary, marks the losing page superseded, refreshes Cortex Search, and updates the tag |
| Domain composer | One orchestrator agent over Accounts, Service, and Advisors semantic views, showing which view answered. Nothing is merged into one model | Cortex Agent with three Cortex Analyst tools |
| Consistency monitor | Agreement rate by night for governed and ungoverned pairs, and the latest run by question. You can also run the eval now | `RUN_CONSISTENCY_EVAL` calls every agent (`DATA_AGENT_RUN`) and an `AI_COMPLETE` judge; task `NIGHTLY_CONSISTENCY_EVAL` |
| Sample / Live switch | The header shows which mode is on. Live with no connection shows the setup steps. Sample mode has a **Reset story** button | `/api/mode`. Live calls report measured latency and never fall back to sample data |

### Story on this synthetic data set

1. **Disagreement.** Asked "How many active accounts do we have?", the account opening agent says 120,402 (funded) and the maintenance agent says 98,115 (logged in within 90 days). The governed agents both answer 120,402 from the same metric.
2. **A conflict is surfaced.** The inventory flags *active account* and *address change* as conflicts, and *net new accounts (30 days)* as defined in BI but missing from the semantic view.
3. **The owner approves a definition.** In the resolver, the owner picks one definition and the semantic view is rebuilt.
4. **Both agents agree.** The old address page leaves the search index, and the BI metric joins the view.
5. **The monitor shows agreement climbing.** In our live runs, after the three approvals the governed pair agreed on 6 of 6 questions and the ungoverned pair on 2–3 of 6.

See [data/README.md](data/README.md) for how the stories are planted.

## Prerequisites

| | |
| --- | --- |
| No-account mode | Node.js **20.19+ or 22.12+** and npm. Nothing else. |
| Live mode: edition | **Enterprise Edition or higher** for object tags (`CONTEXT_STATUS`, `CONTEXT_OWNER`). On Standard Edition, delete the tag statements in `sql/setup.sql` and the tag lines in `APPROVE_DEFINITION`; the rest works. |
| Live mode: features | Cortex AI functions (`AI_EXTRACT`, `AI_COMPLETE`), Cortex Search, Cortex Analyst, and Cortex Agents. The default model is `claude-sonnet-4-5`. If it isn't in your region, enable [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference) or change the model in `sql/setup.sql` and `SNOWFLAKE_COMPLETE_MODEL`. |
| Live mode: role | `ACCOUNTADMIN` only for the short account-level block in `sql/setup.sql` (role, warehouse, and grants of `CREATE DATABASE`, `EXECUTE TASK`, and `SNOWFLAKE.CORTEX_USER`). Everything else runs as the least-privilege `GCL_DEMO_ROLE`, and so does the app. |
| Preview features | None are used. Semantic view generation from query history (autopilot) is a natural next step, but this example doesn't use it; the views are compiled from the glossary by a stored procedure. |
| Tested | Next.js 16.3, Node 22.23, and snowflake-sdk 3.4, on an AWS US East account, November 2026 |

## Quick start: no account

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-governed-context-layer.git
cd sfguide-governed-context-layer
npm install
npm run dev
```

Open http://localhost:3000. With no `.env.local`, the app runs in your browser on the bundled synthetic data. Every AI output is labeled **Sample AI response**. Those texts were captured from a live run of this example. Approvals are kept in your browser; **Reset story** clears them.

To regenerate the wiki pages and BI export (same output every time): `npm run generate-data`. This also rewrites the inlined block in `sql/setup.sql`.

## Live mode: deploy to your account

1. **Run the setup.** Open a Snowsight SQL worksheet, paste [`sql/setup.sql`](sql/setup.sql), and run all. It took about 1 minute on XSMALL in our test. No uploads or find-and-replace are needed; the wiki pages are inlined. The last statement prints `funded_accounts = 120402` and `logged_in_90d = 98115`.
2. **Create a key pair** for the user that ran setup. Setup grants `GCL_DEMO_ROLE` to that user. Keep the key outside the repository:

   ```bash
   mkdir -p ~/.snowflake/keys
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out ~/.snowflake/keys/gcl_rsa_key.p8 -nocrypt
   openssl rsa -in ~/.snowflake/keys/gcl_rsa_key.p8 -pubout
   ```

   ```sql
   -- Uses the second key slot so an existing key is not replaced.
   ALTER USER <YOUR_USER> SET RSA_PUBLIC_KEY_2 = '<public key body without header lines>';
   ```

3. **Configure the app.** Copy `.env.example` to `.env.local` and fill in your account identifier (`<org>-<account>`), user, and key path.
4. **Run it.** Run `npm run dev`. The header switch shows **Live**, and each screen shows a **Live · <ms>** badge.

The app connects as `GCL_DEMO_ROLE` and uses bind variables for every statement.

To run the eval every night, resume the task: `ALTER TASK GOVERNED_CONTEXT_DEMO.AGENTS.NIGHTLY_CONSISTENCY_EVAL RESUME;`. It's created suspended so the example costs nothing overnight.

To replay the story in live mode, run `sql/setup.sql` again. It replaces the example's objects and restores the conflicts.

### Objects created

| Object | Name | Notes |
| --- | --- | --- |
| Role | `GCL_DEMO_ROLE` | Owns everything below; least privilege |
| Warehouse | `GCL_WH` | XSMALL, `AUTO_SUSPEND = 60`, starts suspended |
| Database | `GOVERNED_CONTEXT_DEMO` | Schemas `CORE`, `CONTEXT`, `AGENTS` |
| Tables (CORE) | `ADVISORS`, `CLIENTS`, `ACCOUNTS`, `ACCOUNT_EVENTS`, `SERVICE_REQUESTS` | About 410,000 synthetic rows; views `ACCOUNTS_V`, `SERVICE_REQUESTS_V`, `SERVICE_V` |
| Tables (CONTEXT) | `WIKI_PAGES`, `BI_MODEL_EXPORT`, `CANDIDATE_DEFINITIONS`, `CONTEXT_TERMS`, `CONFLICTS`, `DECISIONS` | Context sources, the glossary, and the owner's decisions |
| Tags | `CONTEXT_STATUS`, `CONTEXT_OWNER` | On each semantic view |
| Semantic views | `ACCOUNTS_SV`, `SERVICE_SV`, `ADVISORS_SV` | Synonyms, comments, and a verified query for active accounts |
| Cortex Search | `PROCEDURES_SEARCH` | Wiki pages that are not superseded |
| Cortex Agents | `ACCOUNT_OPENING_AGENT`, `ACCOUNT_MAINTENANCE_AGENT`, `ORCHESTRATOR_AGENT` | Two governed team agents and one orchestrator |
| Procedures | `BUILD_ACCOUNTS_SV`, `ASK_UNGOVERNED`, `APPROVE_DEFINITION`, `JUDGE_PAIR`, `RUN_CONSISTENCY_EVAL` | |
| Eval tables | `QUESTION_BANK`, `EVAL_RESULTS` | `EVAL_RESULTS` starts with 14 nights of seeded history |
| Task | `NIGHTLY_CONSISTENCY_EVAL` | 02:00 America/New_York, created suspended |

**Cleanup:** run [`sql/cleanup.sql`](sql/cleanup.sql). It drops the database, the warehouse, and the role. If you registered a key for this example, also run `ALTER USER <YOUR_USER> UNSET RSA_PUBLIC_KEY_2;`.

### Expected cost and time

- **Setup:** about 1 minute on XSMALL (47–65 s in our runs), including AI_EXTRACT over 30 pages and three AI_COMPLETE explanations.
- **Warehouse credits:** in our test, 3 full setups, 4 full evals, and a walkthrough of every screen used **0.59 credits** on XSMALL in total.
- **AI credits:** Cortex AI functions, Cortex Agents, Cortex Analyst, and Cortex Search are billed separately. A full eval makes 12 agent calls and 24 AI_COMPLETE calls. Check your usage in `SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY` and `CORTEX_AGENT_USAGE_HISTORY` (they can lag by a few hours). See the [Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf) for rates.
- **Measured latency** in our test, from the app server:
  - Screens load in 0.3–2 s.
  - Re-extract one page with AI_EXTRACT: about 2 s.
  - AI explanation: about 5 s.
  - Approve: 5–15 s.
  - Ask all four agents: 10–15 s.
  - Orchestrator: about 18 s.
  - Full eval: about 3.5–3.7 minutes.

  Yours will differ.

## Known limitations

- **The ungoverned agents are a baseline.** `ASK_UNGOVERNED` stands in for a team agent with its own prompt: `AI_COMPLETE` plus the team's own definition, its own count, and its bookmarked page.
- **Only `ACCOUNTS_SV` is rebuilt from the glossary.** `SERVICE_SV` and `ADVISORS_SV` are static DDL. Approving replaces the view with `CREATE OR REPLACE ... COPY GRANTS`.
- **Agreement is judged by an LLM.** The judge compares core facts and ignores wording. Borderline answers can flip between runs, and live agent wording differs from the captured sample text.
- **Seeded history.** The earlier points on the monitor are seeded (`seeded = TRUE`); only runs you start, or the task, are real. This example uses its own eval table rather than AI Observability evaluations.
- **Third-party catalogs.** Data catalogs and BI tools can be sources of business context. This example only imports a BI export file; it has no catalog integration.
- **Mining is one term per page.** AI_EXTRACT pulls one term and definition per page at setup. The conflicts are grouped by a fixed mapping, not detected automatically across all pages.

## Customize with Cortex Code

- "Read my wiki export and draft a glossary of candidate terms with source citations. Don't create any objects yet."
- "Generate semantic views for my account and service domains from query history, then list the overlaps between them."
- "Build an eval question bank for my agents and run it against every agent nightly. Show the cost per run before you resume the task."

## Project layout

```text
app/                  Next.js App Router pages and the /api/data and /api/mode routes
components/           Shell, mode switch, reasoning steps, UI pieces
lib/context-data.ts   Data interface used by every screen
lib/mock-data.ts      No-account implementation (runs in the browser)
lib/live-data.ts      Snowflake implementation (server only)
lib/snowflake.ts      Connection as GCL_DEMO_ROLE, bind variables
scripts/              generate-data.mjs, build-hosted-example.mjs, capture-screenshots.mjs, run-sql.mjs
sql/                  setup.sql, cleanup.sql
data/                 Wiki pages, BI export, captured sample outputs, data README
docs/                 GitHub Pages guide, screenshots, and the /try/ static example
```

`npm run build:example` builds the static, no-account example into `docs/try/`, and `npm run capture` refreshes the screenshots from it.

## License and disclaimer

[Apache 2.0](LICENSE). This is an illustrative example provided as is. It is not an official Snowflake product and is not supported by Snowflake Support. It contains no customer data. Review and test before any production use.

Owner: Oz Oral · Last reviewed: November 2026
