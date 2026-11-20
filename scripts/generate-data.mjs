// Writes the synthetic unstructured context for the example: 30 wiki/procedure pages and a small
// BI-model export. Deterministic: the same files every run. Large tables (accounts, events, service
// requests) are generated inside Snowflake by sql/setup.sql with HASH-based, seeded logic.
//
// It also rewrites the "GENERATED CONTENT" block in sql/setup.sql so the worksheet stays runnable
// top to bottom with no file uploads or find-and-replace.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OWNERS = {
  ops: 'Account Operations (Priya Natarajan)',
  svc: 'Client Service (Tomas Lindqvist)',
  data: 'Data Office (Helen Okafor)',
  adv: 'Advisor Platform (Jordan Reyes)',
  risk: 'Operational Risk (Samira Haddad)',
};

// Planted conflicts: WIKI-03 vs WIKI-11 (active account), WIKI-07 vs WIKI-19 (address change).
const PAGES = [
  ['WIKI-01', 'Glossary: account', 'definition', 'ops', '2025-03-04', 'approved', 'account',
    'An **account** is a single registration held at Northwind Financial, such as an individual brokerage, joint, IRA, Roth IRA, or cash management account. A client can hold several accounts.'],
  ['WIKI-02', 'Glossary: client', 'definition', 'svc', '2025-03-04', 'approved', 'client',
    'A **client** is a person or entity that owns at least one account. Joint owners count as one client record each.'],
  ['WIKI-03', 'Account opening handbook: what counts as active', 'definition', 'ops', '2024-11-18', 'approved', 'active account',
    'For account opening and growth reporting, an **active account** is an account with status OPEN and a cash or securities balance greater than zero (a **funded** account). Login activity is not part of this definition.'],
  ['WIKI-04', 'Glossary: funded account', 'definition', 'ops', '2025-01-09', 'approved', 'funded account',
    'A **funded account** is an OPEN account with a balance greater than zero on the as-of date.'],
  ['WIKI-05', 'Glossary: dormant account', 'definition', 'risk', '2025-02-21', 'approved', 'dormant account',
    'A **dormant account** is an OPEN account with no client-initiated activity (trade, transfer, or login) for 12 months or more.'],
  ['WIKI-06', 'Glossary: household', 'definition', 'adv', '2025-04-02', 'approved', 'household',
    'A **household** groups clients who share an address and an advisor relationship.'],
  ['WIKI-07', 'Procedure: change a client address (current)', 'procedure', 'svc', '2026-06-12', 'approved', 'address change',
    'To change a client address: 1. Verify identity with two-factor authentication in the service console. 2. Submit service request type ADDRESS_CHANGE with the new address. 3. The change takes effect within **1 business day**. 4. A confirmation letter is mailed to both the old and the new address.'],
  ['WIKI-08', 'Procedure: beneficiary change', 'procedure', 'svc', '2026-02-03', 'approved', 'beneficiary change',
    'To change a beneficiary on an IRA or transfer-on-death account: verify identity, collect the signed beneficiary form, submit service request type BENEFICIARY_CHANGE. Turnaround is 3 business days.'],
  ['WIKI-09', 'Procedure: close an account', 'procedure', 'ops', '2025-09-30', 'approved', 'account closure',
    'To close an account: confirm a zero balance or a completed transfer out, submit service request type ACCOUNT_CLOSE, and record the closure reason code.'],
  ['WIKI-10', 'Glossary: primary advisor', 'definition', 'adv', '2025-04-02', 'approved', 'primary advisor',
    'The **primary advisor** is the advisor of record on the account. Each account has exactly one.'],
  ['WIKI-11', 'Service metrics guide: active accounts', 'definition', 'svc', '2025-08-27', 'approved', 'active account',
    'For service and engagement dashboards, an **active account** is an OPEN account whose owner has **logged in within the last 90 days**. Balance is not considered.'],
  ['WIKI-12', 'Glossary: engaged account', 'definition', 'svc', '2025-08-27', 'draft', 'engaged account',
    'Draft. An **engaged account** may be an OPEN account with a client login in the last 90 days. Needs an owner decision.'],
  ['WIKI-13', 'Glossary: service request', 'definition', 'svc', '2025-05-15', 'approved', 'service request',
    'A **service request** is a client or advisor request handled by Client Service, such as an address change, beneficiary change, transfer, statement copy, or account closure.'],
  ['WIKI-14', 'Service level targets', 'policy', 'svc', '2026-01-10', 'approved', 'service level',
    'Service level targets: address change 1 business day, beneficiary change 3 business days, transfer 5 business days, statement copy 2 business days.'],
  ['WIKI-15', 'Glossary: net new accounts', 'definition', 'data', '2026-04-01', 'approved', 'net new accounts',
    '**Net new accounts** for a period = accounts opened in the period minus accounts closed in the period.'],
  ['WIKI-16', 'Glossary: average resolution time', 'definition', 'svc', '2025-05-15', 'approved', 'resolution time',
    '**Resolution time** is the number of calendar days from when a service request is opened to when it is closed. Open requests are excluded.'],
  ['WIKI-17', 'Glossary: open service request', 'definition', 'svc', '2025-05-15', 'approved', 'open service request',
    'An **open service request** has status OPEN or IN_PROGRESS.'],
  ['WIKI-18', 'Glossary: advisor region', 'definition', 'adv', '2025-04-02', 'approved', 'region',
    'Advisors belong to one of four regions: Northeast, Southeast, Central, or West.'],
  ['WIKI-19', 'Procedure: change a client address (2019 version)', 'procedure', 'svc', '2019-05-20', 'approved', 'address change',
    'To change a client address the client must send a **signed letter by mail**. Operations keys the change after a medallion signature check. Allow **5 business days**.'],
  ['WIKI-20', 'Glossary: account type', 'definition', 'ops', '2025-03-04', 'approved', 'account type',
    'Account types: Individual Brokerage, Joint Brokerage, Traditional IRA, Roth IRA, Cash Management.'],
  ['WIKI-21', 'Glossary: as-of date', 'definition', 'data', '2026-01-05', 'approved', 'as-of date',
    'Unless stated otherwise, reported counts use the data as of **2026-11-15**.'],
  ['WIKI-22', 'Procedure: reopen a closed account', 'procedure', 'ops', '2025-10-11', 'approved', 'account reopen',
    'A closed account can be reopened within 90 days of closure with a service request of type ACCOUNT_REOPEN.'],
  ['WIKI-23', 'Glossary: client tenure', 'definition', 'svc', '2025-05-15', 'approved', 'client tenure',
    '**Client tenure** is the years since the client opened their first account.'],
  ['WIKI-24', 'Glossary: average balance', 'definition', 'data', '2026-04-01', 'approved', 'average balance',
    '**Average balance** is the mean balance across funded accounts. Unfunded accounts are excluded.'],
  ['WIKI-25', 'Procedure: statement copy', 'procedure', 'svc', '2025-07-07', 'approved', 'statement copy',
    'Statement copies for the last 7 years are available in the client portal. Older statements need a service request of type STATEMENT_COPY.'],
  ['WIKI-26', 'Procedure: transfer between accounts', 'procedure', 'ops', '2025-07-07', 'approved', 'internal transfer',
    'Transfers between accounts with the same owner can be submitted in the portal and settle the next business day.'],
  ['WIKI-27', 'Glossary: channel', 'definition', 'svc', '2025-05-15', 'approved', 'channel',
    'Service requests arrive through one of three channels: Phone, Portal, or Branch.'],
  ['WIKI-28', 'Glossary: advisor book', 'definition', 'adv', '2025-04-02', 'approved', 'advisor book',
    'An **advisor book** is the set of accounts where the advisor is the primary advisor.'],
  ['WIKI-29', 'Data office FAQ: which definition wins?', 'policy', 'data', '2026-05-18', 'approved', 'definition precedence',
    'When two pages define the same term differently, the data product owner decides. The approved definition is published in the semantic view, and the other page is marked superseded.'],
  ['WIKI-30', 'Procedure: login troubleshooting', 'procedure', 'svc', '2025-12-01', 'approved', 'login reset',
    'Clients reset portal passwords themselves. Locked accounts need a service request of type PASSWORD_RESET.'],
];

// BI model export (planted gap: net_new_accounts_30d exists here but not in the semantic view).
const BI = {
  model: 'Account Operations Dashboard (fictional BI tool export)',
  exported_at: '2026-11-10',
  metrics: [
    { name: 'total_accounts', label: 'Total accounts', expression: 'COUNT(account_id)', owner: OWNERS.data },
    { name: 'active_accounts', label: 'Active accounts', expression: "COUNT_IF(status = 'OPEN' AND balance > 0)", owner: OWNERS.ops },
    { name: 'average_balance', label: 'Average balance', expression: 'AVG(balance) over funded accounts', owner: OWNERS.data },
    { name: 'net_new_accounts_30d', label: 'Net new accounts (30 days)', expression: 'opened in last 30 days minus closed in last 30 days', owner: OWNERS.data },
    { name: 'open_service_requests', label: 'Open service requests', expression: "COUNT_IF(status IN ('OPEN','IN_PROGRESS'))", owner: OWNERS.svc },
    { name: 'avg_resolution_days', label: 'Average resolution days', expression: 'AVG(DATEDIFF(day, opened_at, closed_at))', owner: OWNERS.svc },
  ],
};

rmSync('data/wiki', { recursive: true, force: true });
mkdirSync('data/wiki', { recursive: true });
const docs = PAGES.map(([id, title, type, owner, updated, status, term, body]) => ({
  doc_id: id, title, doc_type: type, owner: OWNERS[owner], updated, status, term, body,
}));
for (const d of docs) {
  writeFileSync(`data/wiki/${d.doc_id}.md`,
    `---\nid: ${d.doc_id}\ntitle: ${d.title}\ntype: ${d.doc_type}\nowner: ${d.owner}\nupdated: ${d.updated}\nstatus: ${d.status}\n---\n\n# ${d.title}\n\n${d.body}\n`);
}
writeFileSync('data/wiki-pages.json', JSON.stringify(docs, null, 2) + '\n');
writeFileSync('data/bi-model-export.json', JSON.stringify(BI, null, 2) + '\n');

// Rewrite the generated block in sql/setup.sql.
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = docs.map((d) => `  (${[d.doc_id, d.title, d.doc_type, d.owner, d.updated, d.status, d.body].map(q).join(', ')})`).join(',\n');
const block = `-- BEGIN GENERATED CONTENT (scripts/generate-data.mjs)
INSERT INTO WIKI_PAGES (doc_id, title, doc_type, owner, updated, status, body) VALUES
${rows};
INSERT INTO BI_MODEL_EXPORT (export) SELECT PARSE_JSON(${q(JSON.stringify(BI))});
-- END GENERATED CONTENT`;
const sql = readFileSync('sql/setup.sql', 'utf8');
const next = sql.replace(/-- BEGIN GENERATED CONTENT[\s\S]*?-- END GENERATED CONTENT/, block);
if (next === sql && !sql.includes(block)) throw new Error('Generated block markers not found in sql/setup.sql');
writeFileSync('sql/setup.sql', next);
console.log(`Wrote ${docs.length} wiki pages, the BI export, and the setup.sql content block.`);
