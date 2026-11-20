// Live mode: every screen reads and writes the objects created by sql/setup.sql. Server only.
// All statements use bind variables; nothing the user types is concatenated into SQL.
// Latency shown in the UI is measured here.
import type { ContextData } from './context-data';
import { query } from './snowflake';
import type { AgentAnswer, BiMetric, Conflict, EvalPoint, EvalRow, Monitor, Question, Term } from './types';

type Row = Record<string, unknown>;
const DB = process.env.SNOWFLAKE_DATABASE ?? 'GOVERNED_CONTEXT_DEMO';
const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
const AGENT_A = `${DB}.AGENTS.ACCOUNT_OPENING_AGENT`;
const AGENT_B = `${DB}.AGENTS.ACCOUNT_MAINTENANCE_AGENT`;
const ORCH = `${DB}.AGENTS.ORCHESTRATOR_AGENT`;
const DOMAIN_TOOLS = new Set(['Accounts', 'Service', 'Advisors', 'Procedures']);

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const r = await fn();
  return [r, Date.now() - t0];
}
const parse = (x: unknown) => (typeof x === 'string' ? JSON.parse(x) : x);

async function questions(): Promise<Question[]> {
  const rows = await query<Row>('SELECT question_id, question, topic FROM AGENTS.QUESTION_BANK ORDER BY question_id');
  return rows.map((r) => ({ id: String(r.QUESTION_ID), question: String(r.QUESTION), topic: String(r.TOPIC) }));
}

async function runAgent(agent: string, label: string, question: string): Promise<AgentAnswer> {
  const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: question }] }] });
  const rows = await query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?)::VARCHAR AS R', [agent, body]);
  const content: Row[] = JSON.parse(rows[0].R).content ?? [];
  const text = content.filter((c) => c.type === 'text').map((c) => String(c.text)).join('\n').trim();
  const tools = [...new Set(content.filter((c) => c.type === 'tool_use').map((c) => String((c.tool_use as Row).name)).filter((n) => DOMAIN_TOOLS.has(n)))];
  return { agent: label, text: text || '(No text in agent response.)', tools };
}

async function ungoverned(team: 'A' | 'B', label: string, question: string): Promise<AgentAnswer> {
  const rows = await query<Row>('CALL AGENTS.ASK_UNGOVERNED(?, ?)', [team, question]);
  return { agent: label, text: String(Object.values(rows[0])[0]) };
}

const JUDGE = 'Do these two answers give the same facts (same numbers, same steps and timing)? Compare only the core facts that answer the question. ' +
  'Ignore wording, tone, citations, and extra details that do not contradict the other answer. If either answer says it cannot answer, they do not agree.';
async function judge(a: string, b: string): Promise<{ agree: boolean; reason: string }> {
  const rows = await query<{ R: string }>(
    `SELECT AI_COMPLETE(model => ?, prompt => ?, response_format => {'type': 'json', 'schema': {'type': 'object',
       'properties': {'agree': {'type': 'boolean'}, 'reason': {'type': 'string'}}, 'required': ['agree', 'reason']}})::VARCHAR AS R`,
    [MODEL, `${JUDGE}\nAnswer 1: ${a}\nAnswer 2: ${b}`]);
  return parse(parse(rows[0].R));
}

async function terms(): Promise<Term[]> {
  const rows = await query<Row>(`SELECT term_id, term, domain, kind, definition, owner, source, source_ref, status, sv_name, sv_expression,
    synonyms, approved_by, TO_VARCHAR(approved_at, 'YYYY-MM-DD HH24:MI') AS approved_at, note FROM CONTEXT.CONTEXT_TERMS ORDER BY term_id`);
  return rows.map((r) => ({
    id: String(r.TERM_ID), term: String(r.TERM), domain: String(r.DOMAIN), kind: String(r.KIND), definition: String(r.DEFINITION),
    owner: String(r.OWNER), source: r.SOURCE as Term['source'], sourceRef: String(r.SOURCE_REF), status: r.STATUS as Term['status'],
    svName: (r.SV_NAME as string) ?? null, svExpression: (r.SV_EXPRESSION as string) ?? null, synonyms: parse(r.SYNONYMS) ?? [],
    approvedBy: (r.APPROVED_BY as string) ?? null, approvedAt: (r.APPROVED_AT as string) ?? null, note: (r.NOTE as string) ?? null,
  }));
}

async function svStatus(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const sv of ['ACCOUNTS_SV', 'SERVICE_SV', 'ADVISORS_SV']) {
    const rows = await query<{ S: string }>(`SELECT SYSTEM$GET_TAG(?, ?, 'SEMANTIC VIEW') AS S`, [`${DB}.CONTEXT.CONTEXT_STATUS`, `${DB}.AGENTS.${sv}`]);
    out[sv] = rows[0]?.S ?? 'unknown';
  }
  return out;
}

async function evalHistory(): Promise<EvalPoint[]> {
  const rows = await query<Row>(`SELECT TO_VARCHAR(run_at::DATE) AS day, seeded, pair, ROUND(100 * AVG(IFF(agree, 1, 0)))::INT AS pct
    FROM AGENTS.EVAL_RESULTS GROUP BY 1, 2, 3 ORDER BY 1`);
  const m = new Map<string, EvalPoint>();
  for (const r of rows) {
    const key = `${r.DAY}-${r.SEEDED}`;
    const p = m.get(key) ?? { day: String(r.DAY), governed: null, ungoverned: null, seeded: !!r.SEEDED };
    if (r.PAIR === 'governed') p.governed = Number(r.PCT); else p.ungoverned = Number(r.PCT);
    m.set(key, p);
  }
  return [...m.values()];
}

export const liveData: ContextData = {
  async overview() {
    const [[qs, t, h, types, reqs, sv, counts], latencyMs] = await timed(() => Promise.all([questions(), terms(), evalHistory(),
      query<Row>(`SELECT account_type, SUM(funded_flag) AS funded, SUM(recent_login_flag) AS logged_in FROM CORE.ACCOUNTS_V GROUP BY 1 ORDER BY 1`),
      query<Row>(`SELECT request_type, COUNT_IF(status IN ('OPEN','IN_PROGRESS')) AS open_n, COUNT_IF(status = 'CLOSED') AS closed_n
                  FROM CORE.SERVICE_REQUESTS_V GROUP BY 1 ORDER BY 2 DESC`),
      svStatus(),
      query<Row>(`SELECT (SELECT COUNT(*) FROM CORE.ACCOUNTS) AS a, (SELECT COUNT(*) FROM CORE.SERVICE_REQUESTS) AS s, (SELECT COUNT(*) FROM CORE.ADVISORS) AS v`),
    ]));
    const last = h.at(-1);
    const c = counts[0];
    const dom = (view: string, label: string, domain: string, rows: number) => ({ view, label, status: sv[view] ?? 'unknown', rows,
      terms: t.filter((x) => x.domain === domain).length });
    return { source: 'snowflake', latencyMs, questions: qs,
      openConflicts: t.filter((x) => x.status === 'conflict' || x.status === 'missing').length,
      approvedTerms: t.filter((x) => x.status === 'approved').length, totalTerms: t.length,
      governedAgreement: last?.governed ?? null, ungovernedAgreement: last?.ungoverned ?? null, history: h,
      byType: types.map((r) => ({ type: String(r.ACCOUNT_TYPE), funded: Number(r.FUNDED), loggedIn: Number(r.LOGGED_IN) })),
      requests: reqs.map((r) => ({ type: String(r.REQUEST_TYPE), open: Number(r.OPEN_N), closed: Number(r.CLOSED_N) })),
      domains: [dom('ACCOUNTS_SV', 'Accounts', 'accounts', Number(c.A)), dom('SERVICE_SV', 'Service', 'service', Number(c.S)),
        dom('ADVISORS_SV', 'Advisors', 'advisors', Number(c.V))] };
  },

  async ask(qid) {
    const [result, latencyMs] = await timed(async () => {
      const qs = await questions();
      const q = qs.find((x) => x.id === qid);
      if (!q) throw new Error('Unknown question');
      const [ua, ub, ga, gb] = await Promise.all([
        ungoverned('A', 'Agent A: account opening (own prompt)', q.question),
        ungoverned('B', 'Agent B: account maintenance (own prompt)', q.question),
        runAgent(AGENT_A, 'Agent A: account opening (governed)', q.question),
        runAgent(AGENT_B, 'Agent B: account maintenance (governed)', q.question),
      ]);
      const [ju, jg] = await Promise.all([judge(ua.text, ub.text), judge(ga.text, gb.text)]);
      return { questionId: qid, ungovernedA: ua, ungovernedB: ub, governedA: ga, governedB: gb,
        ungovernedAgree: ju.agree, governedAgree: jg.agree, judgeNote: jg.reason };
    });
    return { ...result, source: 'snowflake', latencyMs };
  },

  async inventory() {
    const [[t, cand, biRows, metrics, sv], latencyMs] = await timed(() => Promise.all([
      terms(),
      query<Row>(`SELECT doc_id, c.title, c.owner, TO_VARCHAR(c.updated) AS updated, w.status AS page_status, term, definition
                  FROM CONTEXT.CANDIDATE_DEFINITIONS c JOIN CONTEXT.WIKI_PAGES w USING (doc_id) ORDER BY doc_id`),
      query<Row>(`SELECT m.value:name::STRING AS name, m.value:label::STRING AS label, m.value:expression::STRING AS expression, m.value:owner::STRING AS owner
                  FROM CONTEXT.BI_MODEL_EXPORT, LATERAL FLATTEN(export:metrics) m`),
      query<Row>(`SHOW SEMANTIC METRICS IN ${DB}.AGENTS.ACCOUNTS_SV`).catch(() => [] as Row[]),
      svStatus(),
    ]));
    const svMetrics = new Set(metrics.map((m) => String(m.name ?? m.NAME ?? '').toLowerCase()));
    const bi: BiMetric[] = biRows.map((r) => ({ name: String(r.NAME), label: String(r.LABEL), expression: String(r.EXPRESSION), owner: String(r.OWNER),
      inSemanticView: svMetrics.has(String(r.NAME).toLowerCase()) }));
    return { source: 'snowflake', latencyMs, terms: t, bi, svStatus: sv,
      candidates: cand.map((c) => ({ docId: String(c.DOC_ID), title: String(c.TITLE), owner: String(c.OWNER), updated: String(c.UPDATED),
        pageStatus: String(c.PAGE_STATUS), term: String(c.TERM), definition: String(c.DEFINITION) })) };
  },

  async mine(docId) {
    const [rows, latencyMs] = await timed(() => query<{ X: string }>(
      `SELECT AI_EXTRACT(text => body, responseFormat => {
         'term': 'Which single business term does this page define or describe? Answer in lowercase.',
         'definition': 'Give the definition or procedure in one sentence, keeping any numbers.'})::VARCHAR AS X
       FROM CONTEXT.WIKI_PAGES WHERE doc_id = ?`, [docId]));
    const x = JSON.parse(rows[0].X).response;
    return { term: String(x.term), definition: String(x.definition), source: 'snowflake', latencyMs };
  },

  async conflicts() {
    const rows = await query<Row>(`SELECT k.conflict_id, k.term_id, t.term, t.owner, t.kind, k.option_doc_id, k.option_label, k.option_definition,
        k.option_sv_expression, k.ai_explanation, k.resolved, k.chosen
      FROM CONTEXT.CONFLICTS k JOIN CONTEXT.CONTEXT_TERMS t USING (term_id) ORDER BY k.conflict_id, k.option_doc_id`);
    const groups = new Map<string, Conflict>();
    for (const r of rows) {
      const id = String(r.CONFLICT_ID);
      const g = groups.get(id) ?? { id, termId: String(r.TERM_ID), term: String(r.TERM), owner: String(r.OWNER), kind: String(r.KIND), options: [],
        explanation: String(r.AI_EXPLANATION ?? ''), resolved: !!r.RESOLVED };
      g.options.push({ docId: String(r.OPTION_DOC_ID), label: String(r.OPTION_LABEL), definition: String(r.OPTION_DEFINITION),
        svExpression: (r.OPTION_SV_EXPRESSION as string) ?? null, chosen: !!r.CHOSEN });
      groups.set(id, g);
    }
    return [...groups.values()];
  },

  async explain(id) {
    const [rows, latencyMs] = await timed(() => query<{ T: string }>(
      `SELECT AI_COMPLETE(?, 'Two or more business definitions were found for the same term at a fictional financial firm. ' ||
         'In 3 short bullets: what differs, which teams or reports each would affect, and what a data owner should check before choosing. No preamble.\n\n' ||
         LISTAGG(option_doc_id || ': ' || option_definition, '\n') WITHIN GROUP (ORDER BY option_doc_id)) AS T
       FROM CONTEXT.CONFLICTS WHERE conflict_id = ?`, [MODEL, id]));
    await query('UPDATE CONTEXT.CONFLICTS SET ai_explanation = ? WHERE conflict_id = ?', [rows[0].T, id]);
    return { text: rows[0].T, source: 'snowflake', latencyMs };
  },

  async approve(id, docId, note) {
    const [rows, latencyMs] = await timed(() => query<Row>('CALL AGENTS.APPROVE_DEFINITION(?, ?, ?)', [id, docId, note]));
    return { ok: true, message: `${String(Object.values(rows[0])[0])}. ACCOUNTS_SV rebuilt; superseded pages left out of Cortex Search.`, source: 'snowflake', latencyMs };
  },

  async compose(question) {
    const [a, latencyMs] = await timed(() => runAgent(ORCH, 'Operations orchestrator', question));
    return { source: 'snowflake', latencyMs, question, tools: a.tools ?? [], text: a.text };
  },

  async monitor(): Promise<Monitor> {
    const [[h, latestRows, task, qs], latencyMs] = await timed(() => Promise.all([
      evalHistory(),
      query<Row>(`SELECT e.question_id, q.question, e.pair, e.agree, e.judge_note, TO_VARCHAR(e.run_at) AS run_at FROM AGENTS.EVAL_RESULTS e
                  JOIN AGENTS.QUESTION_BANK q USING (question_id)
                  WHERE e.run_id = (SELECT MAX(run_id) FROM AGENTS.EVAL_RESULTS WHERE NOT seeded) ORDER BY e.question_id, e.pair`),
      query<Row>(`SHOW TASKS LIKE 'NIGHTLY_CONSISTENCY_EVAL' IN SCHEMA ${DB}.AGENTS`),
      questions(),
    ]));
    const latest: EvalRow[] = latestRows.map((r) => ({ questionId: String(r.QUESTION_ID), question: String(r.QUESTION), pair: r.PAIR as EvalRow['pair'],
      agree: !!r.AGREE, note: String(r.JUDGE_NOTE ?? '') }));
    return { source: 'snowflake', latencyMs, history: h, latest, latestRunAt: (latestRows[0]?.RUN_AT as string) ?? null,
      taskState: String(task[0]?.state ?? 'unknown'), questions: qs };
  },

  async runEval() {
    const [rows, latencyMs] = await timed(() => query<Row>('CALL AGENTS.RUN_CONSISTENCY_EVAL()'));
    return { runId: String(Object.values(rows[0])[0]), source: 'snowflake', latencyMs };
  },
};
