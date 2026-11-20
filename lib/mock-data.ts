// Sample (no-account) mode. Runs in the browser on bundled synthetic data. Every AI text here was
// captured from a live run of this example in Snowflake and is labeled "Sample AI response" in the UI.
// The owner's approvals are kept in localStorage so the story (conflict -> approval -> agreement) plays out.
import type { ContextData } from './context-data';
import type { AgentAnswer, AskResult, Conflict, EvalPoint, EvalRow, Inventory, Monitor, Question, Term } from './types';
import candidatesRaw from '@/data/sample/candidates.json';
import conflictsRaw from '@/data/sample/conflicts.json';
import answersRaw from '@/data/sample/eval-answers.json';
import historyRaw from '@/data/sample/eval-history.json';
import orchestrator from '@/data/sample/orchestrator.json';
import termsRaw from '@/data/sample/terms.json';
import bi from '@/data/bi-model-export.json';
import { SAMPLE_DELAY_MS } from './sample-timing';

type Row = Record<string, unknown>;
const KEY = 'gcl-approvals';
const RAN = 'gcl-sample-eval';

export const QUESTIONS: Question[] = [
  { id: 'Q1', question: 'How many active accounts do we have?', topic: 'active account' },
  { id: 'Q2', question: 'How do I change a client\u2019s address?', topic: 'address change' },
  { id: 'Q3', question: 'How many funded accounts do we have?', topic: 'funded account' },
  { id: 'Q4', question: 'What is the average balance of funded accounts?', topic: 'average balance' },
  { id: 'Q5', question: 'What were net new accounts in the last 30 days?', topic: 'net new accounts' },
  { id: 'Q6', question: 'How do I change a beneficiary on an IRA?', topic: 'beneficiary change' },
];
// Which conflict must be resolved before the governed agents agree on a question.
const NEEDS: Record<string, string> = { Q2: 'K2', Q5: 'K3' };

function approvals(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.round(Math.random() * 600)));

const answers = answersRaw as Row[];
function captured(phase: 'before' | 'after', pair: string, qid: string): Row {
  return answers.find((r) => r.PHASE === phase && r.PAIR === pair && r.QUESTION_ID === qid)!;
}

function terms(): Term[] {
  const ap = approvals();
  const conflicts = conflictsRaw as Row[];
  return (termsRaw as Term[]).map((t) => {
    const k = conflicts.find((c) => c.TERM_ID === t.id);
    if (!k || !ap[String(k.CONFLICT_ID)]) return t;
    const opt = conflicts.find((c) => c.CONFLICT_ID === k.CONFLICT_ID && c.OPTION_DOC_ID === ap[String(k.CONFLICT_ID)])!;
    return { ...t, status: 'approved' as const, definition: String(opt.OPTION_DEFINITION), sourceRef: String(opt.OPTION_DOC_ID),
      svExpression: (opt.OPTION_SV_EXPRESSION as string | null) ?? t.svExpression, approvedBy: 'You (sample)', approvedAt: '2026-11-15' };
  });
}

function governedAgrees(qid: string): boolean {
  const k = NEEDS[qid];
  return !k || !!approvals()[k];
}

function evalRows(): EvalRow[] {
  return QUESTIONS.flatMap((q) => {
    const gp = governedAgrees(q.id) ? 'after' : 'before';
    const g = captured(gp, 'governed', q.id);
    const u = captured('after', 'ungoverned', q.id);
    return [
      { questionId: q.id, question: q.question, pair: 'governed' as const, agree: governedAgrees(q.id), note: String(g.JUDGE_NOTE) },
      { questionId: q.id, question: q.question, pair: 'ungoverned' as const, agree: !!u.AGREE, note: String(u.JUDGE_NOTE) },
    ];
  });
}

function history(): EvalPoint[] {
  const byDay = new Map<string, EvalPoint>();
  for (const r of historyRaw as Row[]) {
    const p = byDay.get(String(r.DAY)) ?? { day: String(r.DAY), governed: null, ungoverned: null, seeded: true };
    if (r.PAIR === 'governed') p.governed = Number(r.PCT); else p.ungoverned = Number(r.PCT);
    byDay.set(p.day, p);
  }
  const pts = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (typeof window !== 'undefined' && window.localStorage.getItem(RAN)) {
    const rows = evalRows();
    const pct = (pair: string) => Math.round((100 * rows.filter((r) => r.pair === pair && r.agree).length) / QUESTIONS.length);
    pts.push({ day: '2026-11-15', governed: pct('governed'), ungoverned: pct('ungoverned'), seeded: false });
  }
  return pts;
}

function withChoice(qid: string, a: AgentAnswer): AgentAnswer {
  const ap = approvals();
  if (qid === 'Q1' && ap.K1 === 'WIKI-11') return { ...a, text: a.text.replace(/120,402/g, '98,115').replace(/balance[^.]*\./i, 'login within 90 days.') };
  if (qid === 'Q2' && ap.K2 === 'WIKI-19') return { ...a, text: String(captured('after', 'ungoverned', 'Q2').ANSWER_A) };
  return a;
}

export const mockData: ContextData = {
  async overview() {
    const t = terms();
    const last = history().at(-1)!;
    return { source: 'mock', questions: QUESTIONS, openConflicts: t.filter((x) => x.status === 'conflict' || x.status === 'missing').length,
      approvedTerms: t.filter((x) => x.status === 'approved').length, totalTerms: t.length,
      governedAgreement: last.governed, ungovernedAgreement: last.ungoverned };
  },

  async ask(qid) {
    await wait(SAMPLE_DELAY_MS.ask);
    const gp = governedAgrees(qid) ? 'after' : 'before';
    const g = captured(gp, 'governed', qid);
    const u = captured('after', 'ungoverned', qid);
    const res: AskResult = {
      source: 'mock', questionId: qid,
      ungovernedA: { agent: 'Agent A: account opening (own prompt)', text: String(u.ANSWER_A) },
      ungovernedB: { agent: 'Agent B: account maintenance (own prompt)', text: String(u.ANSWER_B) },
      governedA: withChoice(qid, { agent: 'Agent A: account opening (governed)', text: String(g.ANSWER_A), tools: qid === 'Q2' || qid === 'Q6' ? ['Procedures'] : ['Accounts'] }),
      governedB: withChoice(qid, { agent: 'Agent B: account maintenance (governed)', text: String(g.ANSWER_B), tools: qid === 'Q2' || qid === 'Q6' ? ['Procedures'] : ['Accounts'] }),
      ungovernedAgree: !!u.AGREE, governedAgree: governedAgrees(qid), judgeNote: String(g.JUDGE_NOTE),
    };
    return res;
  },

  async inventory(): Promise<Inventory> {
    const t = terms();
    const inSv = new Set(t.filter((x) => x.svName && (x.status === 'approved' || x.status === 'conflict')).map((x) => x.svName));
    return {
      source: 'mock', terms: t,
      candidates: (candidatesRaw as Row[]).map((c) => ({ docId: String(c.DOC_ID), title: String(c.TITLE), owner: String(c.OWNER), updated: String(c.UPDATED),
        pageStatus: approvals().K2 && c.DOC_ID === (approvals().K2 === 'WIKI-07' ? 'WIKI-19' : 'WIKI-07') ? 'superseded'
          : approvals().K1 && c.DOC_ID === (approvals().K1 === 'WIKI-03' ? 'WIKI-11' : 'WIKI-03') ? 'superseded' : String(c.PAGE_STATUS),
        term: String(c.TERM), definition: String(c.DEFINITION) })),
      bi: bi.metrics.map((m) => ({ ...m, inSemanticView: inSv.has(m.name) || (m.name === 'active_accounts' && inSv.has('active_accounts')) })),
      svStatus: { ACCOUNTS_SV: t.some((x) => x.domain === 'accounts' && x.status === 'conflict') ? 'conflict' : 'approved', SERVICE_SV: 'approved', ADVISORS_SV: 'approved' },
    };
  },

  async mine(docId) {
    await wait(SAMPLE_DELAY_MS.mine);
    const c = (candidatesRaw as Row[]).find((x) => x.DOC_ID === docId)!;
    return { term: String(c.TERM), definition: String(c.DEFINITION), source: 'mock' };
  },

  async conflicts(): Promise<Conflict[]> {
    const ap = approvals();
    const t = termsRaw as Term[];
    const groups = new Map<string, Conflict>();
    for (const r of conflictsRaw as Row[]) {
      const id = String(r.CONFLICT_ID);
      const term = t.find((x) => x.id === r.TERM_ID)!;
      const g = groups.get(id) ?? { id, termId: term.id, term: term.term, owner: term.owner, kind: term.kind, options: [], explanation: String(r.AI_EXPLANATION), resolved: !!ap[id] };
      g.options.push({ docId: String(r.OPTION_DOC_ID), label: String(r.OPTION_LABEL), definition: String(r.OPTION_DEFINITION),
        svExpression: (r.OPTION_SV_EXPRESSION as string | null) ?? null, chosen: ap[id] === r.OPTION_DOC_ID });
      groups.set(id, g);
    }
    return [...groups.values()];
  },

  async explain(id) {
    await wait(SAMPLE_DELAY_MS.explain);
    const c = (conflictsRaw as Row[]).find((x) => x.CONFLICT_ID === id)!;
    return { text: String(c.AI_EXPLANATION), source: 'mock' };
  },

  async approve(id, docId) {
    await wait(SAMPLE_DELAY_MS.approve);
    const ap = approvals();
    ap[id] = docId;
    window.localStorage.setItem(KEY, JSON.stringify(ap));
    return { ok: true, message: `Approved ${docId}. ACCOUNTS_SV rebuilt; superseded pages left out of Cortex Search.`, source: 'mock' };
  },

  async compose(question) {
    await wait(SAMPLE_DELAY_MS.compose);
    const o = orchestrator.find((x) => x.question === question) ?? orchestrator[0];
    return { source: 'mock', question: o.question, tools: o.tools, text: o.text };
  },

  async monitor(): Promise<Monitor> {
    const ran = typeof window !== 'undefined' && !!window.localStorage.getItem(RAN);
    return { source: 'mock', history: history(), latest: ran ? evalRows() : [], latestRunAt: ran ? '2026-11-15T02:00:00-05:00' : null,
      taskState: 'suspended', questions: QUESTIONS };
  },

  async runEval() {
    await wait(SAMPLE_DELAY_MS.eval);
    window.localStorage.setItem(RAN, '1');
    return { runId: 'SAMPLE-RUN', source: 'mock' };
  },
};

/** Clears the sample-mode approvals and eval run, to replay the story. */
export function resetSample() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(RAN);
}
