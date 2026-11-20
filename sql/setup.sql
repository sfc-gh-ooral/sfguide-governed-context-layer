-- =============================================================================
-- One Answer Across Agents (governed context layer): Snowflake setup
-- Synthetic data only. Illustrative logic; not production, regulatory, or compliance advice.
--
-- Run top to bottom in a Snowsight SQL worksheet (about 6 minutes on an XSMALL warehouse).
-- Requirements (see README): Enterprise Edition or higher (object tags), Cortex AI functions (AI_EXTRACT, AI_COMPLETE), Cortex Search,
-- Cortex Analyst, and Cortex Agents in your region or with cross-region inference enabled,
-- and a role that can create roles, warehouses, and databases.
--
-- Creates (and sql/cleanup.sql drops):
--   role       GCL_DEMO_ROLE (least-privilege owner of everything below)
--   warehouse  GCL_WH (XSMALL, AUTO_SUSPEND = 60)
--   database   GOVERNED_CONTEXT_DEMO (schemas CORE, CONTEXT, AGENTS)
--     tables, 3 semantic views, 1 Cortex Search service, 3 Cortex Agents, 2 tags,
--     stored procedures, and 1 task (created SUSPENDED)
-- It changes nothing that already exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1. Account-level objects (ACCOUNTADMIN, or SECURITYADMIN + SYSADMIN)
-- -----------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS GCL_DEMO_ROLE COMMENT = 'Governed context layer example: object owner';
GRANT ROLE GCL_DEMO_ROLE TO ROLE SYSADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE GCL_DEMO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS GCL_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Governed context layer example';
GRANT USAGE, OPERATE ON WAREHOUSE GCL_WH TO ROLE GCL_DEMO_ROLE;

-- The only account-level privileges the example needs.
GRANT CREATE DATABASE ON ACCOUNT TO ROLE GCL_DEMO_ROLE;
GRANT EXECUTE TASK ON ACCOUNT TO ROLE GCL_DEMO_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE GCL_DEMO_ROLE;

-- -----------------------------------------------------------------------------
-- Part 2. Everything else runs as the least-privilege role
-- -----------------------------------------------------------------------------
USE ROLE GCL_DEMO_ROLE;
USE WAREHOUSE GCL_WH;
CREATE DATABASE IF NOT EXISTS GOVERNED_CONTEXT_DEMO COMMENT = 'Governed context layer example (synthetic data)';
USE DATABASE GOVERNED_CONTEXT_DEMO;
CREATE SCHEMA IF NOT EXISTS CORE    COMMENT = 'Synthetic brokerage and banking data';
CREATE SCHEMA IF NOT EXISTS CONTEXT COMMENT = 'Business context: wiki pages, BI export, glossary, conflicts';
CREATE SCHEMA IF NOT EXISTS AGENTS  COMMENT = 'Semantic views, search, agents, and the consistency eval';

-- 2a. Synthetic data (seeded HASH logic: identical on every run) -------------------
USE SCHEMA CORE;
SET as_of = '2026-11-15'::DATE;

CREATE OR REPLACE TABLE ADVISORS AS
SELECT 'ADV' || LPAD(n, 3, '0') AS advisor_id,
       ARRAY_CONSTRUCT('Avery','Blake','Casey','Devon','Emerson','Finley','Gray','Harper','Indigo','Jules')[MOD(n, 10)]::STRING || ' ' ||
       ARRAY_CONSTRUCT('Calder','Brightwater','Ashford','Fenwick','Holloway','Marsh','Quill','Rowan','Sterling','Thorne')[MOD(FLOOR(n / 10), 10)]::STRING AS advisor_name,
       ARRAY_CONSTRUCT('Northeast','Southeast','Central','West')[MOD(n, 4)]::STRING AS region
FROM (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS n FROM TABLE(GENERATOR(ROWCOUNT => 40)));

CREATE OR REPLACE TABLE CLIENTS AS
SELECT 'C' || LPAD(n, 6, '0') AS client_id,
       ARRAY_CONSTRUCT('Maya','Noah','Lena','Omar','Iris','Theo','Zara','Elias','Nina','Rafael','Sana','Owen')[MOD(ABS(HASH(n, 11)), 12)]::STRING || ' ' ||
       ARRAY_CONSTRUCT('Abara','Bellweather','Castellan','Draycott','Everly','Fairbairn','Galloway','Hartigan','Iverson','Jessup','Kettering','Lockwood')[MOD(ABS(HASH(n, 12)), 12)]::STRING AS client_name,
       DATEADD(day, -MOD(ABS(HASH(n, 13)), 7300), $as_of) AS client_since,
       ARRAY_CONSTRUCT('NY','NJ','MA','FL','GA','IL','OH','TX','CO','CA','WA','AZ')[MOD(ABS(HASH(n, 14)), 12)]::STRING AS state
FROM (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS n FROM TABLE(GENERATOR(ROWCOUNT => 90000)));

-- Planted story 1: exactly 120,402 OPEN accounts with a balance above zero (funded) and
-- exactly 98,115 OPEN accounts whose owner logged in within 90 days of the as-of date.
CREATE OR REPLACE TABLE ACCOUNTS AS
WITH base AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS n FROM TABLE(GENERATOR(ROWCOUNT => 140000))),
r1 AS (SELECT n, ROW_NUMBER() OVER (ORDER BY HASH(n, 1)) <= 131000 AS is_open FROM base),
r2 AS (SELECT n, is_open,
              ROW_NUMBER() OVER (PARTITION BY is_open ORDER BY HASH(n, 2)) AS rf,
              ROW_NUMBER() OVER (PARTITION BY is_open ORDER BY HASH(n, 3)) AS rl FROM r1)
SELECT 'A' || LPAD(n, 7, '0') AS account_id,
       'C' || LPAD(1 + MOD(ABS(HASH(n, 4)), 90000), 6, '0') AS client_id,
       'ADV' || LPAD(1 + MOD(ABS(HASH(n, 5)), 40), 3, '0') AS advisor_id,
       ARRAY_CONSTRUCT('Individual Brokerage','Joint Brokerage','Traditional IRA','Roth IRA','Cash Management')[MOD(ABS(HASH(n, 6)), 5)]::STRING AS account_type,
       IFF(is_open, 'OPEN', 'CLOSED') AS status,
       DATEADD(day, -MOD(ABS(HASH(n, 7)), 3650), $as_of) AS opened_date,
       IFF(is_open, NULL, DATEADD(day, -MOD(ABS(HASH(n, 8)), 365), $as_of)) AS closed_date,
       IFF(is_open AND rf <= 120402, ROUND(250 + MOD(ABS(HASH(n, 9)), 480000) + MOD(ABS(HASH(n, 10)), 100) / 100, 2), 0) AS balance,
       IFF(is_open AND rl <= 98115, DATEADD(day, -MOD(ABS(HASH(n, 15)), 90), $as_of),
           IFF(MOD(ABS(HASH(n, 16)), 5) = 0, NULL, DATEADD(day, -(91 + MOD(ABS(HASH(n, 17)), 700)), $as_of))) AS last_login_date
FROM r2;
-- Opening dates must precede closing dates.
UPDATE ACCOUNTS SET opened_date = DATEADD(day, -30 - MOD(ABS(HASH(account_id)), 2000), closed_date)
WHERE closed_date IS NOT NULL AND opened_date >= closed_date;

CREATE OR REPLACE TABLE ACCOUNT_EVENTS AS
SELECT account_id || '-O' AS event_id, account_id, 'OPEN' AS event_type, opened_date AS event_date FROM ACCOUNTS
UNION ALL SELECT account_id || '-X', account_id, 'CLOSE', closed_date FROM ACCOUNTS WHERE closed_date IS NOT NULL
UNION ALL SELECT account_id || '-A', account_id, 'ADDRESS_CHANGE', DATEADD(day, -MOD(ABS(HASH(account_id, 20)), 700), $as_of)
  FROM ACCOUNTS WHERE MOD(ABS(HASH(account_id, 21)), 20) = 0
UNION ALL SELECT account_id || '-B', account_id, 'BENEFICIARY_CHANGE', DATEADD(day, -MOD(ABS(HASH(account_id, 22)), 700), $as_of)
  FROM ACCOUNTS WHERE account_type IN ('Traditional IRA','Roth IRA') AND MOD(ABS(HASH(account_id, 23)), 15) = 0;

CREATE OR REPLACE TABLE SERVICE_REQUESTS AS
WITH b AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS n FROM TABLE(GENERATOR(ROWCOUNT => 24000)))
SELECT 'SR' || LPAD(n, 6, '0') AS request_id,
       'A' || LPAD(1 + MOD(ABS(HASH(n, 30)), 140000), 7, '0') AS account_id,
       ARRAY_CONSTRUCT('ADDRESS_CHANGE','ADDRESS_CHANGE','BENEFICIARY_CHANGE','TRANSFER','STATEMENT_COPY','PASSWORD_RESET','ACCOUNT_CLOSE')[MOD(ABS(HASH(n, 31)), 7)]::STRING AS request_type,
       ARRAY_CONSTRUCT('Phone','Portal','Branch')[MOD(ABS(HASH(n, 32)), 3)]::STRING AS channel,
       DATEADD(day, -MOD(ABS(HASH(n, 33)), 365), $as_of) AS opened_date,
       IFF(MOD(ABS(HASH(n, 34)), 12) = 0, IFF(MOD(n, 2) = 0, 'OPEN', 'IN_PROGRESS'), 'CLOSED') AS status,
       1 + MOD(ABS(HASH(n, 35)), 6) AS days_to_close
FROM b;
CREATE OR REPLACE VIEW SERVICE_REQUESTS_V AS
SELECT request_id, account_id, request_type, channel, opened_date, status,
       IFF(status = 'CLOSED', DATEADD(day, days_to_close, opened_date), NULL) AS closed_date,
       IFF(status = 'CLOSED', days_to_close, NULL) AS resolution_days
FROM SERVICE_REQUESTS;

-- Flags used by the semantic view metrics (one row per account).
CREATE OR REPLACE VIEW ACCOUNTS_V AS
SELECT a.*, c.client_name, c.state,
       IFF(a.status = 'OPEN' AND a.balance > 0, 1, 0) AS funded_flag,
       IFF(a.status = 'OPEN' AND a.last_login_date > DATEADD(day, -90, '2026-11-15'::DATE), 1, 0) AS recent_login_flag,
       IFF(a.opened_date > DATEADD(day, -30, '2026-11-15'::DATE), 1, 0) AS opened_30d_flag,
       IFF(a.closed_date > DATEADD(day, -30, '2026-11-15'::DATE), 1, 0) AS closed_30d_flag
FROM ACCOUNTS a JOIN CLIENTS c ON c.client_id = a.client_id;

-- 2b. Unstructured context and the BI export ------------------------------------
USE SCHEMA CONTEXT;
CREATE OR REPLACE TABLE WIKI_PAGES (
  doc_id VARCHAR, title VARCHAR, doc_type VARCHAR, owner VARCHAR, updated DATE,
  status VARCHAR,          -- approved, draft, superseded
  body VARCHAR
);
CREATE OR REPLACE TABLE BI_MODEL_EXPORT (export VARIANT);

-- BEGIN GENERATED CONTENT (scripts/generate-data.mjs)
INSERT INTO WIKI_PAGES (doc_id, title, doc_type, owner, updated, status, body) VALUES
  ('WIKI-01', 'Glossary: account', 'definition', 'Account Operations (Priya Natarajan)', '2025-03-04', 'approved', 'An **account** is a single registration held at Northwind Financial, such as an individual brokerage, joint, IRA, Roth IRA, or cash management account. A client can hold several accounts.'),
  ('WIKI-02', 'Glossary: client', 'definition', 'Client Service (Tomas Lindqvist)', '2025-03-04', 'approved', 'A **client** is a person or entity that owns at least one account. Joint owners count as one client record each.'),
  ('WIKI-03', 'Account opening handbook: what counts as active', 'definition', 'Account Operations (Priya Natarajan)', '2024-11-18', 'approved', 'For account opening and growth reporting, an **active account** is an account with status OPEN and a cash or securities balance greater than zero (a **funded** account). Login activity is not part of this definition.'),
  ('WIKI-04', 'Glossary: funded account', 'definition', 'Account Operations (Priya Natarajan)', '2025-01-09', 'approved', 'A **funded account** is an OPEN account with a balance greater than zero on the as-of date.'),
  ('WIKI-05', 'Glossary: dormant account', 'definition', 'Operational Risk (Samira Haddad)', '2025-02-21', 'approved', 'A **dormant account** is an OPEN account with no client-initiated activity (trade, transfer, or login) for 12 months or more.'),
  ('WIKI-06', 'Glossary: household', 'definition', 'Advisor Platform (Jordan Reyes)', '2025-04-02', 'approved', 'A **household** groups clients who share an address and an advisor relationship.'),
  ('WIKI-07', 'Procedure: change a client address (current)', 'procedure', 'Client Service (Tomas Lindqvist)', '2026-06-12', 'approved', 'To change a client address: 1. Verify identity with two-factor authentication in the service console. 2. Submit service request type ADDRESS_CHANGE with the new address. 3. The change takes effect within **1 business day**. 4. A confirmation letter is mailed to both the old and the new address.'),
  ('WIKI-08', 'Procedure: beneficiary change', 'procedure', 'Client Service (Tomas Lindqvist)', '2026-02-03', 'approved', 'To change a beneficiary on an IRA or transfer-on-death account: verify identity, collect the signed beneficiary form, submit service request type BENEFICIARY_CHANGE. Turnaround is 3 business days.'),
  ('WIKI-09', 'Procedure: close an account', 'procedure', 'Account Operations (Priya Natarajan)', '2025-09-30', 'approved', 'To close an account: confirm a zero balance or a completed transfer out, submit service request type ACCOUNT_CLOSE, and record the closure reason code.'),
  ('WIKI-10', 'Glossary: primary advisor', 'definition', 'Advisor Platform (Jordan Reyes)', '2025-04-02', 'approved', 'The **primary advisor** is the advisor of record on the account. Each account has exactly one.'),
  ('WIKI-11', 'Service metrics guide: active accounts', 'definition', 'Client Service (Tomas Lindqvist)', '2025-08-27', 'approved', 'For service and engagement dashboards, an **active account** is an OPEN account whose owner has **logged in within the last 90 days**. Balance is not considered.'),
  ('WIKI-12', 'Glossary: engaged account', 'definition', 'Client Service (Tomas Lindqvist)', '2025-08-27', 'draft', 'Draft. An **engaged account** may be an OPEN account with a client login in the last 90 days. Needs an owner decision.'),
  ('WIKI-13', 'Glossary: service request', 'definition', 'Client Service (Tomas Lindqvist)', '2025-05-15', 'approved', 'A **service request** is a client or advisor request handled by Client Service, such as an address change, beneficiary change, transfer, statement copy, or account closure.'),
  ('WIKI-14', 'Service level targets', 'policy', 'Client Service (Tomas Lindqvist)', '2026-01-10', 'approved', 'Service level targets: address change 1 business day, beneficiary change 3 business days, transfer 5 business days, statement copy 2 business days.'),
  ('WIKI-15', 'Glossary: net new accounts', 'definition', 'Data Office (Helen Okafor)', '2026-04-01', 'approved', '**Net new accounts** for a period = accounts opened in the period minus accounts closed in the period.'),
  ('WIKI-16', 'Glossary: average resolution time', 'definition', 'Client Service (Tomas Lindqvist)', '2025-05-15', 'approved', '**Resolution time** is the number of calendar days from when a service request is opened to when it is closed. Open requests are excluded.'),
  ('WIKI-17', 'Glossary: open service request', 'definition', 'Client Service (Tomas Lindqvist)', '2025-05-15', 'approved', 'An **open service request** has status OPEN or IN_PROGRESS.'),
  ('WIKI-18', 'Glossary: advisor region', 'definition', 'Advisor Platform (Jordan Reyes)', '2025-04-02', 'approved', 'Advisors belong to one of four regions: Northeast, Southeast, Central, or West.'),
  ('WIKI-19', 'Procedure: change a client address (2019 version)', 'procedure', 'Client Service (Tomas Lindqvist)', '2019-05-20', 'approved', 'To change a client address the client must send a **signed letter by mail**. Operations keys the change after a medallion signature check. Allow **5 business days**.'),
  ('WIKI-20', 'Glossary: account type', 'definition', 'Account Operations (Priya Natarajan)', '2025-03-04', 'approved', 'Account types: Individual Brokerage, Joint Brokerage, Traditional IRA, Roth IRA, Cash Management.'),
  ('WIKI-21', 'Glossary: as-of date', 'definition', 'Data Office (Helen Okafor)', '2026-01-05', 'approved', 'Unless stated otherwise, reported counts use the data as of **2026-11-15**.'),
  ('WIKI-22', 'Procedure: reopen a closed account', 'procedure', 'Account Operations (Priya Natarajan)', '2025-10-11', 'approved', 'A closed account can be reopened within 90 days of closure with a service request of type ACCOUNT_REOPEN.'),
  ('WIKI-23', 'Glossary: client tenure', 'definition', 'Client Service (Tomas Lindqvist)', '2025-05-15', 'approved', '**Client tenure** is the years since the client opened their first account.'),
  ('WIKI-24', 'Glossary: average balance', 'definition', 'Data Office (Helen Okafor)', '2026-04-01', 'approved', '**Average balance** is the mean balance across funded accounts. Unfunded accounts are excluded.'),
  ('WIKI-25', 'Procedure: statement copy', 'procedure', 'Client Service (Tomas Lindqvist)', '2025-07-07', 'approved', 'Statement copies for the last 7 years are available in the client portal. Older statements need a service request of type STATEMENT_COPY.'),
  ('WIKI-26', 'Procedure: transfer between accounts', 'procedure', 'Account Operations (Priya Natarajan)', '2025-07-07', 'approved', 'Transfers between accounts with the same owner can be submitted in the portal and settle the next business day.'),
  ('WIKI-27', 'Glossary: channel', 'definition', 'Client Service (Tomas Lindqvist)', '2025-05-15', 'approved', 'Service requests arrive through one of three channels: Phone, Portal, or Branch.'),
  ('WIKI-28', 'Glossary: advisor book', 'definition', 'Advisor Platform (Jordan Reyes)', '2025-04-02', 'approved', 'An **advisor book** is the set of accounts where the advisor is the primary advisor.'),
  ('WIKI-29', 'Data office FAQ: which definition wins?', 'policy', 'Data Office (Helen Okafor)', '2026-05-18', 'approved', 'When two pages define the same term differently, the data product owner decides. The approved definition is published in the semantic view, and the other page is marked superseded.'),
  ('WIKI-30', 'Procedure: login troubleshooting', 'procedure', 'Client Service (Tomas Lindqvist)', '2025-12-01', 'approved', 'Clients reset portal passwords themselves. Locked accounts need a service request of type PASSWORD_RESET.');
INSERT INTO BI_MODEL_EXPORT (export) SELECT PARSE_JSON('{"model":"Account Operations Dashboard (fictional BI tool export)","exported_at":"2026-11-10","metrics":[{"name":"total_accounts","label":"Total accounts","expression":"COUNT(account_id)","owner":"Data Office (Helen Okafor)"},{"name":"active_accounts","label":"Active accounts","expression":"COUNT_IF(status = ''OPEN'' AND balance > 0)","owner":"Account Operations (Priya Natarajan)"},{"name":"average_balance","label":"Average balance","expression":"AVG(balance) over funded accounts","owner":"Data Office (Helen Okafor)"},{"name":"net_new_accounts_30d","label":"Net new accounts (30 days)","expression":"opened in last 30 days minus closed in last 30 days","owner":"Data Office (Helen Okafor)"},{"name":"open_service_requests","label":"Open service requests","expression":"COUNT_IF(status IN (''OPEN'',''IN_PROGRESS''))","owner":"Client Service (Tomas Lindqvist)"},{"name":"avg_resolution_days","label":"Average resolution days","expression":"AVG(DATEDIFF(day, opened_at, closed_at))","owner":"Client Service (Tomas Lindqvist)"}]}');
-- END GENERATED CONTENT

-- 2c. Horizon Catalog tags: the context store's status and owner -------------------
CREATE OR REPLACE TAG CONTEXT_STATUS ALLOWED_VALUES 'draft', 'conflict', 'approved' COMMENT = 'Governance status of business context';
CREATE OR REPLACE TAG CONTEXT_OWNER COMMENT = 'Data product owner accountable for a definition';

-- 2d. Candidate definitions mined from the wiki with AI_EXTRACT -------------------
CREATE OR REPLACE TABLE CANDIDATE_DEFINITIONS AS
SELECT doc_id, title, owner, updated, status AS page_status,
       LOWER(x:response:term::STRING) AS term, x:response:definition::STRING AS definition
FROM (
  SELECT *, AI_EXTRACT(text => body, responseFormat => {
           'term': 'Which single business term does this page define or describe? Answer in lowercase.',
           'definition': 'Give the definition or procedure in one sentence, keeping any numbers.'}) AS x
  FROM WIKI_PAGES
);

-- 2e. The governed glossary (the context inventory) ---------------------------------
-- source: wiki, bi, or inferred. status: draft -> conflict -> approved.
-- sv_expression: what the term compiles to in a semantic view (metrics only).
CREATE OR REPLACE TABLE CONTEXT_TERMS (
  term_id VARCHAR, term VARCHAR, domain VARCHAR, kind VARCHAR, definition VARCHAR,
  owner VARCHAR, source VARCHAR, source_ref VARCHAR, status VARCHAR,
  sv_name VARCHAR, sv_expression VARCHAR, synonyms ARRAY,
  approved_by VARCHAR, approved_at TIMESTAMP_TZ, note VARCHAR
);
INSERT INTO CONTEXT_TERMS
SELECT column1, column2, column3, column4, column5, column6, column7, column8, column9, column10, column11, PARSE_JSON(column12), NULL, NULL, NULL
FROM VALUES
 ('T01','active account','accounts','metric','Pending owner decision: two approved pages disagree (funded vs. logged in within 90 days).','Account Operations (Priya Natarajan)','wiki','WIKI-03, WIKI-11','conflict','active_accounts','SUM(ac.funded_flag)','["active accounts","live accounts"]'),
 ('T02','funded account','accounts','metric','An OPEN account with a balance greater than zero on the as-of date.','Account Operations (Priya Natarajan)','wiki','WIKI-04','approved','funded_accounts','SUM(ac.funded_flag)','["funded accounts"]'),
 ('T03','total accounts','accounts','metric','Every account record, open or closed.','Data Office (Helen Okafor)','bi','total_accounts','approved','total_accounts','COUNT(ac.account_id)','["number of accounts","account count"]'),
 ('T04','average balance','accounts','metric','Mean balance across funded accounts.','Data Office (Helen Okafor)','wiki','WIKI-24','approved','average_balance','AVG(NULLIF(ac.balance, 0))','["avg balance","mean balance"]'),
 ('T05','net new accounts (30 days)','accounts','metric','Accounts opened in the last 30 days minus accounts closed in the last 30 days.','Data Office (Helen Okafor)','bi','net_new_accounts_30d','missing','net_new_accounts_30d','SUM(ac.opened_30d_flag) - SUM(ac.closed_30d_flag)','["net new accounts","net account growth"]'),
 ('T06','engaged account','accounts','metric','Draft: an OPEN account with a client login in the last 90 days.','Client Service (Tomas Lindqvist)','wiki','WIKI-12','draft','engaged_accounts','SUM(ac.recent_login_flag)','["engaged accounts"]'),
 ('T07','address change','service','procedure','Pending owner decision: the current page (1 business day, 2FA) and a 2019 page (mailed letter, 5 days) disagree.','Client Service (Tomas Lindqvist)','wiki','WIKI-07, WIKI-19','conflict',NULL,NULL,'["change of address","update address"]'),
 ('T08','open service request','service','metric','A service request with status OPEN or IN_PROGRESS.','Client Service (Tomas Lindqvist)','wiki','WIKI-17','approved','open_requests','SUM(sr.open_flag)','["open tickets","pending requests"]'),
 ('T09','resolution time','service','metric','Calendar days from open to close; open requests excluded.','Client Service (Tomas Lindqvist)','wiki','WIKI-16','approved','avg_resolution_days','AVG(sr.resolution_days)','["turnaround","days to resolve"]'),
 ('T10','beneficiary change','service','procedure','Verify identity, collect the signed form, submit BENEFICIARY_CHANGE; 3 business days.','Client Service (Tomas Lindqvist)','wiki','WIKI-08','approved',NULL,NULL,'["change beneficiary"]'),
 ('T11','advisor book','advisors','dimension','Accounts where the advisor is the primary advisor.','Advisor Platform (Jordan Reyes)','wiki','WIKI-28','approved',NULL,NULL,'["book of business"]'),
 ('T12','region','advisors','dimension','Northeast, Southeast, Central, or West.','Advisor Platform (Jordan Reyes)','wiki','WIKI-18','approved',NULL,NULL,'["territory"]'),
 ('T13','dormant account','accounts','definition','No client-initiated activity for 12 months or more.','Operational Risk (Samira Haddad)','wiki','WIKI-05','approved',NULL,NULL,'["inactive account"]'),
 ('T14','client tenure','accounts','definition','Years since the client opened their first account.','Client Service (Tomas Lindqvist)','inferred','CANDIDATE_DEFINITIONS','draft',NULL,NULL,'["tenure"]');

-- Candidate definitions per side of each planted conflict (for the conflict resolver).
CREATE OR REPLACE TABLE CONFLICTS (
  conflict_id VARCHAR, term_id VARCHAR, option_doc_id VARCHAR, option_label VARCHAR,
  option_definition VARCHAR, option_sv_expression VARCHAR, ai_explanation VARCHAR,
  resolved BOOLEAN DEFAULT FALSE, chosen BOOLEAN DEFAULT FALSE
);
INSERT INTO CONFLICTS (conflict_id, term_id, option_doc_id, option_label, option_definition, option_sv_expression)
SELECT 'K1', 'T01', doc_id, 'Funded (open with a balance)', definition, 'SUM(ac.funded_flag)' FROM CANDIDATE_DEFINITIONS WHERE doc_id = 'WIKI-03'
UNION ALL SELECT 'K1', 'T01', doc_id, 'Logged in within 90 days', definition, 'SUM(ac.recent_login_flag)' FROM CANDIDATE_DEFINITIONS WHERE doc_id = 'WIKI-11'
UNION ALL SELECT 'K2', 'T07', doc_id, 'Current procedure (2026)', definition, NULL FROM CANDIDATE_DEFINITIONS WHERE doc_id = 'WIKI-07'
UNION ALL SELECT 'K2', 'T07', doc_id, '2019 procedure', definition, NULL FROM CANDIDATE_DEFINITIONS WHERE doc_id = 'WIKI-19'
UNION ALL SELECT 'K3', 'T05', 'BI:net_new_accounts_30d', 'Add the BI metric to the semantic view',
  'Accounts opened in the last 30 days minus accounts closed in the last 30 days (defined in the BI export, missing from ACCOUNTS_SV).',
  'SUM(ac.opened_30d_flag) - SUM(ac.closed_30d_flag)';

-- AI_COMPLETE explains each conflict once at setup; the app can re-run it live.
CREATE OR REPLACE TEMPORARY TABLE CONFLICT_EXPLANATIONS AS
  SELECT conflict_id, AI_COMPLETE('claude-sonnet-4-5',
    'Two or more business definitions were found for the same term at a fictional financial firm. ' ||
    'In 3 short bullets: what differs, which teams or reports each would affect, and what a data owner should check before choosing. No preamble.\n\n' ||
    LISTAGG(option_doc_id || ': ' || option_definition, '\n') WITHIN GROUP (ORDER BY option_doc_id)) AS txt
  FROM CONFLICTS GROUP BY conflict_id;
UPDATE CONFLICTS c SET ai_explanation = e.txt FROM CONFLICT_EXPLANATIONS e WHERE c.conflict_id = e.conflict_id;

CREATE OR REPLACE TABLE DECISIONS (
  decided_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(), decided_by VARCHAR DEFAULT CURRENT_USER(),
  conflict_id VARCHAR, term_id VARCHAR, chosen_doc_id VARCHAR, note VARCHAR
);

-- 2f. Semantic views, built from the approved glossary ----------------------------
USE SCHEMA AGENTS;

-- Rebuilds ACCOUNTS_SV from CONTEXT_TERMS: every metric that is approved, or in conflict with a
-- provisional definition, is compiled into the view. "missing" and "draft" terms are left out.
CREATE OR REPLACE PROCEDURE BUILD_ACCOUNTS_SV()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
  metrics VARCHAR;
  ddl VARCHAR;
BEGIN
  SELECT LISTAGG('ac.' || sv_name || ' AS ' || sv_expression ||
                 ' WITH SYNONYMS = (' || ARRAY_TO_STRING(TRANSFORM(synonyms, s VARCHAR -> '''' || REPLACE(s, '''', '''''') || ''''), ', ') || ')' ||
                 ' COMMENT = ''' || REPLACE(definition || ' [' || status || '; owner: ' || owner || '; source: ' || source_ref || ']', '''', '''''') || '''', ',\n    ')
           WITHIN GROUP (ORDER BY term_id)
    INTO :metrics
    FROM GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_TERMS
   WHERE domain = 'accounts' AND kind = 'metric' AND status IN ('approved', 'conflict') AND sv_expression IS NOT NULL;
  ddl := 'CREATE OR REPLACE SEMANTIC VIEW GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV
  TABLES (
    ac AS GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS_V PRIMARY KEY (account_id)
      WITH SYNONYMS = (''accounts'', ''registrations'') COMMENT = ''One row per account. As-of date 2026-11-15.'',
    ev AS GOVERNED_CONTEXT_DEMO.CORE.ACCOUNT_EVENTS PRIMARY KEY (event_id) COMMENT = ''Account lifecycle events: OPEN, CLOSE, ADDRESS_CHANGE, BENEFICIARY_CHANGE''
  )
  RELATIONSHIPS (ev_to_ac AS ev (account_id) REFERENCES ac)
  FACTS (ac.balance_fact AS balance, ac.funded_flag AS funded_flag, ac.recent_login_flag AS recent_login_flag,
         ac.opened_30d_flag AS opened_30d_flag, ac.closed_30d_flag AS closed_30d_flag)
  DIMENSIONS (
    ac.account_id AS account_id, ac.account_type AS account_type
      COMMENT = ''Individual Brokerage, Joint Brokerage, Traditional IRA, Roth IRA, or Cash Management'',
    ac.status AS status COMMENT = ''OPEN or CLOSED'', ac.state AS state, ac.advisor_id AS advisor_id,
    ac.opened_date AS opened_date, ac.closed_date AS closed_date, ac.last_login_date AS last_login_date,
    ev.event_type AS event_type WITH SYNONYMS = (''account event'', ''change type''), ev.event_date AS event_date
  )
  METRICS (
    ' || metrics || ',
    ev.event_count AS COUNT(ev.event_id) COMMENT = ''Number of account events''
  )
  COMMENT = ''Accounts domain. Metrics are compiled from the governed glossary (CONTEXT.CONTEXT_TERMS); answer "active accounts" with active_accounts.''
  AI_VERIFIED_QUERIES (
    vq_active_accounts AS (
      QUESTION ''How many active accounts do we have?''
      VERIFIED_BY ''(owner = Account Operations)''
      SQL ''SELECT * FROM SEMANTIC_VIEW(GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV METRICS ac.active_accounts)''
    )
  )
  WITH TAG (GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_OWNER = ''Account Operations (Priya Natarajan)'')
  COPY GRANTS';
  EXECUTE IMMEDIATE :ddl;
  RETURN 'ACCOUNTS_SV rebuilt';
END;
$$;
CALL BUILD_ACCOUNTS_SV();

CREATE OR REPLACE VIEW GOVERNED_CONTEXT_DEMO.CORE.SERVICE_V AS
SELECT *, IFF(status IN ('OPEN','IN_PROGRESS'), 1, 0) AS open_flag FROM GOVERNED_CONTEXT_DEMO.CORE.SERVICE_REQUESTS_V;

CREATE OR REPLACE SEMANTIC VIEW SERVICE_SV
  TABLES (sr AS GOVERNED_CONTEXT_DEMO.CORE.SERVICE_V PRIMARY KEY (request_id)
    WITH SYNONYMS = ('tickets', 'service cases') COMMENT = 'Client service requests, last 12 months')
  FACTS (sr.open_flag AS open_flag, sr.resolution_days AS resolution_days)
  DIMENSIONS (
    sr.request_type AS request_type WITH SYNONYMS = ('request kind')
      COMMENT = 'ADDRESS_CHANGE, BENEFICIARY_CHANGE, TRANSFER, STATEMENT_COPY, PASSWORD_RESET, or ACCOUNT_CLOSE',
    sr.channel AS channel COMMENT = 'Phone, Portal, or Branch', sr.status AS status, sr.opened_date AS opened_date
  )
  METRICS (
    sr.request_count AS COUNT(sr.request_id) WITH SYNONYMS = ('number of requests'),
    sr.open_requests AS SUM(sr.open_flag) WITH SYNONYMS = ('open tickets', 'pending requests') COMMENT = 'Status OPEN or IN_PROGRESS [approved; WIKI-17]',
    sr.avg_resolution_days AS AVG(sr.resolution_days) WITH SYNONYMS = ('turnaround', 'days to resolve') COMMENT = 'Open requests excluded [approved; WIKI-16]'
  )
  COMMENT = 'Service domain (governed glossary terms T08, T09)'
  WITH TAG (GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_OWNER = 'Client Service (Tomas Lindqvist)');

CREATE OR REPLACE SEMANTIC VIEW ADVISORS_SV
  TABLES (
    ad AS GOVERNED_CONTEXT_DEMO.CORE.ADVISORS PRIMARY KEY (advisor_id) WITH SYNONYMS = ('financial advisors', 'reps'),
    bk AS GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS_V PRIMARY KEY (account_id) COMMENT = 'Accounts in each advisor book'
  )
  RELATIONSHIPS (bk_to_ad AS bk (advisor_id) REFERENCES ad)
  FACTS (bk.balance_fact AS balance)
  DIMENSIONS (
    ad.advisor_id AS advisor_id, ad.advisor_name AS advisor_name,
    ad.region AS region WITH SYNONYMS = ('territory') COMMENT = 'Northeast, Southeast, Central, or West',
    bk.account_status AS status
  )
  METRICS (
    ad.advisor_count AS COUNT(ad.advisor_id),
    bk.book_accounts AS COUNT(bk.account_id) WITH SYNONYMS = ('book size', 'accounts per advisor') COMMENT = 'Accounts where the advisor is primary [approved; WIKI-28]',
    bk.book_assets AS SUM(bk.balance_fact) WITH SYNONYMS = ('assets in book')
  )
  COMMENT = 'Advisors domain (governed glossary terms T11, T12)'
  WITH TAG (GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_OWNER = 'Advisor Platform (Jordan Reyes)');

ALTER SEMANTIC VIEW ACCOUNTS_SV SET TAG GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_STATUS = 'conflict';
ALTER SEMANTIC VIEW SERVICE_SV  SET TAG GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_STATUS = 'approved';
ALTER SEMANTIC VIEW ADVISORS_SV SET TAG GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_STATUS = 'approved';

-- 2g. Cortex Search over the procedure pages (superseded pages are excluded) -------
CREATE OR REPLACE CORTEX SEARCH SERVICE PROCEDURES_SEARCH
  ON body
  ATTRIBUTES title, status
  WAREHOUSE = GCL_WH
  TARGET_LAG = '1 hour'
  COMMENT = 'Wiki and procedure pages that are not superseded'
  AS SELECT doc_id, title, status, owner, body FROM GOVERNED_CONTEXT_DEMO.CONTEXT.WIKI_PAGES WHERE status <> 'superseded';

-- 2h. Cortex Agents: two governed team agents and one orchestrator ------------------
-- Both team agents point at the same semantic view and search service, so they share one
-- definition of every term. Only their tone differs.
CREATE OR REPLACE AGENT ACCOUNT_OPENING_AGENT
  COMMENT = 'Governed agent A: account opening team (synthetic data)'
  PROFILE = '{"display_name": "Account opening agent (governed)"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget: { seconds: 60, tokens: 12000 }
  instructions:
    system: >
      You help the account opening team at a fictional firm, Northwind Financial. The data is synthetic; the as-of date is 2026-11-15.
      Never define business terms yourself. Use the metric and procedure definitions returned by your tools.
    orchestration: >
      Use Accounts for counts and balances (for "active accounts" use the active_accounts metric). Use Procedures for how-to questions.
      Answer with one tool call when possible.
    response: >
      Answer in two or three sentences. State the number first. Name the definition you used (the metric comment or the page id).
  tools:
    - tool_spec: { type: "cortex_analyst_text_to_sql", name: "Accounts", description: "Governed accounts metrics: active, funded, and total accounts, average balance, account events." }
    - tool_spec: { type: "cortex_search", name: "Procedures", description: "Approved wiki and procedure pages, such as address change and beneficiary change." }
  tool_resources:
    Accounts: { semantic_view: "GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV", execution_environment: { type: "warehouse", warehouse: "GCL_WH" } }
    Procedures: { search_service: "GOVERNED_CONTEXT_DEMO.AGENTS.PROCEDURES_SEARCH", max_results: 3, title_column: "TITLE", id_column: "DOC_ID" }
  $$;

CREATE OR REPLACE AGENT ACCOUNT_MAINTENANCE_AGENT
  COMMENT = 'Governed agent B: account maintenance team (synthetic data)'
  PROFILE = '{"display_name": "Account maintenance agent (governed)"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget: { seconds: 60, tokens: 12000 }
  instructions:
    system: >
      You help the account maintenance and service team at a fictional firm, Northwind Financial. The data is synthetic; the as-of date is 2026-11-15.
      Never define business terms yourself. Use the metric and procedure definitions returned by your tools.
    orchestration: >
      Use Accounts for counts and balances (for "active accounts" use the active_accounts metric). Use Procedures for how-to questions.
      Answer with one tool call when possible.
    response: >
      Be friendly and brief: two or three sentences. State the number or steps first. Name the definition you used (the metric comment or the page id).
  tools:
    - tool_spec: { type: "cortex_analyst_text_to_sql", name: "Accounts", description: "Governed accounts metrics: active, funded, and total accounts, average balance, account events." }
    - tool_spec: { type: "cortex_search", name: "Procedures", description: "Approved wiki and procedure pages, such as address change and beneficiary change." }
  tool_resources:
    Accounts: { semantic_view: "GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV", execution_environment: { type: "warehouse", warehouse: "GCL_WH" } }
    Procedures: { search_service: "GOVERNED_CONTEXT_DEMO.AGENTS.PROCEDURES_SEARCH", max_results: 3, title_column: "TITLE", id_column: "DOC_ID" }
  $$;

-- One orchestrator over three domain semantic views; nothing is merged into one model.
CREATE OR REPLACE AGENT ORCHESTRATOR_AGENT
  COMMENT = 'Orchestrator over the Accounts, Service, and Advisors domains (synthetic data)'
  PROFILE = '{"display_name": "Operations orchestrator"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget: { seconds: 90, tokens: 16000 }
  instructions:
    system: >
      You answer operations questions at a fictional firm, Northwind Financial. The data is synthetic; the as-of date is 2026-11-15.
      Each domain has its own governed semantic view. Never define business terms yourself.
    orchestration: >
      Route each part of the question to the domain that owns it: Accounts (account counts, balances, events),
      Service (service requests, open requests, resolution time), Advisors (advisors, regions, book size).
      Use Procedures only for how-to questions. Combine results in your answer; do not join domains yourself.
    response: >
      Be concise. Lead with the answer, then one line per domain used, naming the domain.
  tools:
    - tool_spec: { type: "cortex_analyst_text_to_sql", name: "Accounts", description: "Accounts domain: active, funded, and total accounts, balances, account events." }
    - tool_spec: { type: "cortex_analyst_text_to_sql", name: "Service", description: "Service domain: service requests by type and channel, open requests, average resolution days." }
    - tool_spec: { type: "cortex_analyst_text_to_sql", name: "Advisors", description: "Advisors domain: advisors, regions, accounts and assets in each advisor book." }
    - tool_spec: { type: "cortex_search", name: "Procedures", description: "Approved wiki and procedure pages." }
  tool_resources:
    Accounts: { semantic_view: "GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV", execution_environment: { type: "warehouse", warehouse: "GCL_WH" } }
    Service: { semantic_view: "GOVERNED_CONTEXT_DEMO.AGENTS.SERVICE_SV", execution_environment: { type: "warehouse", warehouse: "GCL_WH" } }
    Advisors: { semantic_view: "GOVERNED_CONTEXT_DEMO.AGENTS.ADVISORS_SV", execution_environment: { type: "warehouse", warehouse: "GCL_WH" } }
    Procedures: { search_service: "GOVERNED_CONTEXT_DEMO.AGENTS.PROCEDURES_SEARCH", max_results: 3, title_column: "TITLE", id_column: "DOC_ID" }
  $$;

-- 2i. The ungoverned baseline: each team's own prompt and own definition ------------
-- This is how agents often start: an LLM call with a team prompt, the team's bookmarked page,
-- and the team's own number. AI_COMPLETE answers; nothing is shared between teams.
CREATE OR REPLACE PROCEDURE ASK_UNGOVERNED(team VARCHAR, question VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
  page VARCHAR;
  metric NUMBER;
  prompt VARCHAR;
  answer VARCHAR;
BEGIN
  IF (team = 'A') THEN
    SELECT body INTO :page FROM GOVERNED_CONTEXT_DEMO.CONTEXT.WIKI_PAGES WHERE doc_id = 'WIKI-19';
    SELECT COUNT_IF(status = 'OPEN' AND balance > 0) INTO :metric FROM GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS;
    prompt := 'You are the account opening team assistant. Our team counts an account as active when it is funded. ' ||
              'Our team query says active accounts = ' || metric || '. Our bookmarked procedure: ' || page;
  ELSE
    SELECT body INTO :page FROM GOVERNED_CONTEXT_DEMO.CONTEXT.WIKI_PAGES WHERE doc_id = 'WIKI-07';
    SELECT COUNT_IF(status = 'OPEN' AND last_login_date > DATEADD(day, -90, '2026-11-15'::DATE)) INTO :metric FROM GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS;
    prompt := 'You are the account maintenance team assistant. Our team counts an account as active when the client logged in within 90 days. ' ||
              'Our team query says active accounts = ' || metric || '. Our bookmarked procedure: ' || page;
  END IF;
  SELECT AI_COMPLETE('claude-sonnet-4-5', :prompt || '\n\nAnswer in two sentences, number or steps first. Question: ' || :question) INTO :answer;
  RETURN answer;
END;
$$;

-- 2j. Owner approval: write the chosen definition back to the semantic view ----------
CREATE OR REPLACE PROCEDURE APPROVE_DEFINITION(conflict VARCHAR, chosen_doc VARCHAR, note VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
  t VARCHAR;
  expr VARCHAR;
  defn VARCHAR;
BEGIN
  SELECT term_id, option_sv_expression, option_definition INTO :t, :expr, :defn
    FROM GOVERNED_CONTEXT_DEMO.CONTEXT.CONFLICTS WHERE conflict_id = :conflict AND option_doc_id = :chosen_doc;
  UPDATE GOVERNED_CONTEXT_DEMO.CONTEXT.CONFLICTS SET resolved = TRUE, chosen = (option_doc_id = :chosen_doc) WHERE conflict_id = :conflict;
  UPDATE GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_TERMS
     SET status = 'approved', definition = :defn, sv_expression = COALESCE(:expr, sv_expression),
         source_ref = :chosen_doc, approved_by = CURRENT_USER(), approved_at = CURRENT_TIMESTAMP(), note = :note
   WHERE term_id = :t;
  -- The losing wiki page is marked superseded so Cortex Search stops returning it.
  UPDATE GOVERNED_CONTEXT_DEMO.CONTEXT.WIKI_PAGES SET status = 'superseded'
   WHERE doc_id IN (SELECT option_doc_id FROM GOVERNED_CONTEXT_DEMO.CONTEXT.CONFLICTS WHERE conflict_id = :conflict AND NOT chosen)
     AND doc_id LIKE 'WIKI-%';
  INSERT INTO GOVERNED_CONTEXT_DEMO.CONTEXT.DECISIONS (conflict_id, term_id, chosen_doc_id, note) SELECT :conflict, :t, :chosen_doc, :note;
  CALL GOVERNED_CONTEXT_DEMO.AGENTS.BUILD_ACCOUNTS_SV();
  ALTER CORTEX SEARCH SERVICE GOVERNED_CONTEXT_DEMO.AGENTS.PROCEDURES_SEARCH REFRESH;
  IF (NOT EXISTS (SELECT 1 FROM GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_TERMS WHERE domain = 'accounts' AND status = 'conflict')) THEN
    ALTER SEMANTIC VIEW GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV SET TAG GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_STATUS = 'approved';
  ELSE
    ALTER SEMANTIC VIEW GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNTS_SV SET TAG GOVERNED_CONTEXT_DEMO.CONTEXT.CONTEXT_STATUS = 'conflict';
  END IF;
  RETURN 'Approved ' || :chosen_doc || ' for ' || :t;
END;
$$;

-- 2k. Consistency monitor: a question bank asked of every agent, judged by AI_COMPLETE --
CREATE OR REPLACE TABLE QUESTION_BANK (question_id VARCHAR, question VARCHAR, topic VARCHAR);
INSERT INTO QUESTION_BANK VALUES
  ('Q1', 'How many active accounts do we have?', 'active account'),
  ('Q2', 'How do I change a client''s address?', 'address change'),
  ('Q3', 'How many funded accounts do we have?', 'funded account'),
  ('Q4', 'What is the average balance of funded accounts?', 'average balance'),
  ('Q5', 'What were net new accounts in the last 30 days?', 'net new accounts'),
  ('Q6', 'How do I change a beneficiary on an IRA?', 'beneficiary change');

CREATE OR REPLACE TABLE EVAL_RESULTS (
  run_id VARCHAR, run_at TIMESTAMP_TZ, pair VARCHAR, question_id VARCHAR,
  answer_a VARCHAR, answer_b VARCHAR, agree BOOLEAN, judge_note VARCHAR, seeded BOOLEAN DEFAULT FALSE
);
-- Seeded history (labeled seeded = TRUE): 14 earlier nightly runs on this synthetic data set.
INSERT INTO EVAL_RESULTS (run_id, run_at, pair, question_id, agree, judge_note, seeded)
SELECT 'SEED-' || d.n, DATEADD(day, d.n - 15, '2026-11-15 02:00:00 -05:00'::TIMESTAMP_TZ), p.pair, q.question_id,
       CASE
         WHEN p.pair = 'ungoverned' THEN q.question_id NOT IN ('Q1', 'Q2', 'Q4') AND NOT (q.question_id = 'Q6' AND MOD(d.n, 4) = 0)
         WHEN q.question_id = 'Q5' THEN FALSE                      -- BI metric missing from the semantic view
         WHEN q.question_id = 'Q1' THEN d.n > 9                    -- shared view, but no approved definition yet
         WHEN q.question_id = 'Q2' THEN d.n > 11                   -- old procedure page still searchable
         ELSE NOT (q.question_id = 'Q4' AND d.n = 3)
       END, 'Seeded history', TRUE
FROM (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS n FROM TABLE(GENERATOR(ROWCOUNT => 14))) d
CROSS JOIN (SELECT column1 AS pair FROM VALUES ('ungoverned'), ('governed')) p
CROSS JOIN QUESTION_BANK q;

-- AI_COMPLETE as the judge: do two answers give the same facts?
CREATE OR REPLACE PROCEDURE JUDGE_PAIR(rid VARCHAR, pair VARCHAR, qid VARCHAR, a VARCHAR, b VARCHAR)
RETURNS BOOLEAN
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
  j VARIANT;
BEGIN
  SELECT PARSE_JSON(AI_COMPLETE(
           model => 'claude-sonnet-4-5',
           prompt => 'Do these two answers give the same facts (same numbers, same steps and timing)? Compare only the core facts that answer the question. Ignore wording, tone, citations, and extra details that do not contradict the other answer. If either answer says it cannot answer, they do not agree.\nAnswer 1: ' || :a || '\nAnswer 2: ' || :b,
           response_format => {'type': 'json', 'schema': {'type': 'object', 'properties': {'agree': {'type': 'boolean'}, 'reason': {'type': 'string'}}, 'required': ['agree', 'reason']}}))
    INTO :j;
  INSERT INTO GOVERNED_CONTEXT_DEMO.AGENTS.EVAL_RESULTS (run_id, run_at, pair, question_id, answer_a, answer_b, agree, judge_note)
  SELECT :rid, CURRENT_TIMESTAMP(), :pair, :qid, :a, :b, :j:agree::BOOLEAN, :j:reason::STRING;
  RETURN :j:agree::BOOLEAN;
END;
$$;

CREATE OR REPLACE PROCEDURE RUN_CONSISTENCY_EVAL()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
  rid VARCHAR DEFAULT 'RUN-' || TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYYMMDD-HH24MISS');
  c CURSOR FOR SELECT question_id, question FROM GOVERNED_CONTEXT_DEMO.AGENTS.QUESTION_BANK ORDER BY question_id;
  qid VARCHAR; q VARCHAR; body VARCHAR;
  ga VARCHAR; gb VARCHAR; ua VARCHAR; ub VARCHAR;
BEGIN
  FOR r IN c DO
    qid := r.question_id; q := r.question;
    body := TO_JSON(OBJECT_CONSTRUCT('messages', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('role', 'user',
              'content', ARRAY_CONSTRUCT(OBJECT_CONSTRUCT('type', 'text', 'text', q))))));
    SELECT ARRAY_TO_STRING(ARRAY_AGG(f.value:text::STRING), ' ') INTO :ga
      FROM TABLE(FLATTEN(PARSE_JSON(SNOWFLAKE.CORTEX.DATA_AGENT_RUN('GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNT_OPENING_AGENT', :body)):content)) f
     WHERE f.value:type = 'text';
    SELECT ARRAY_TO_STRING(ARRAY_AGG(f.value:text::STRING), ' ') INTO :gb
      FROM TABLE(FLATTEN(PARSE_JSON(SNOWFLAKE.CORTEX.DATA_AGENT_RUN('GOVERNED_CONTEXT_DEMO.AGENTS.ACCOUNT_MAINTENANCE_AGENT', :body)):content)) f
     WHERE f.value:type = 'text';
    CALL GOVERNED_CONTEXT_DEMO.AGENTS.ASK_UNGOVERNED('A', :q) INTO :ua;
    CALL GOVERNED_CONTEXT_DEMO.AGENTS.ASK_UNGOVERNED('B', :q) INTO :ub;
    CALL GOVERNED_CONTEXT_DEMO.AGENTS.JUDGE_PAIR(:rid, 'governed', :qid, :ga, :gb);
    CALL GOVERNED_CONTEXT_DEMO.AGENTS.JUDGE_PAIR(:rid, 'ungoverned', :qid, :ua, :ub);
  END FOR;
  RETURN rid;
END;
$$;

-- Nightly at 02:00 New York time. Created SUSPENDED so the example costs nothing overnight;
-- resume it with: ALTER TASK GOVERNED_CONTEXT_DEMO.AGENTS.NIGHTLY_CONSISTENCY_EVAL RESUME;
CREATE OR REPLACE TASK NIGHTLY_CONSISTENCY_EVAL
  WAREHOUSE = GCL_WH
  SCHEDULE = 'USING CRON 0 2 * * * America/New_York'
  COMMENT = 'Asks every agent the question bank and records agreement'
  AS CALL GOVERNED_CONTEXT_DEMO.AGENTS.RUN_CONSISTENCY_EVAL();

SELECT 'Setup complete' AS status,
       (SELECT COUNT_IF(status = 'OPEN' AND balance > 0) FROM GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS) AS funded_accounts,
       (SELECT COUNT_IF(status = 'OPEN' AND last_login_date > DATEADD(day, -90, '2026-11-15'::DATE)) FROM GOVERNED_CONTEXT_DEMO.CORE.ACCOUNTS) AS logged_in_90d;
