'use client';

// Screen 1: the same question asked of two ungoverned agents and two governed agents.
import { ArrowRight, Bot, Play, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { AgreePill, Card, Kpi, Markdown, PoweredBy, SampleAiBadge, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { AgentAnswer, AskResult } from '@/lib/types';

function Answer({ a, governed }: { a: AgentAnswer; governed: boolean }) {
  return (
    <div className="rounded-xl border p-3 h-full" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold">
        {governed ? <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} aria-hidden /> : <Bot className="w-3.5 h-3.5 muted" aria-hidden />}
        {a.agent}
      </div>
      <Markdown text={a.text} />
      {!!a.tools?.length && <div className="text-[11px] muted mt-1">Tools used: {a.tools.join(', ')}</div>}
    </div>
  );
}

export default function SideBySide() {
  const ov = useAsync(() => data.overview(), []);
  const [qid, setQid] = useState('Q1');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult>();
  const [err, setErr] = useState<string>();
  const ask = async () => {
    setBusy(true); setErr(undefined); setRes(undefined);
    try { setRes(await data.ask(qid)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const o = ov.data;
  const sample = res?.source === 'mock';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">One question, one answer</h1>
        <p className="text-sm text-2 mt-1 max-w-3xl">Two teams shipped agents with their own prompts and definitions. Ask both the same question,
          then ask the governed versions, which share one semantic view and one procedure index.</p>
      </div>

      {ov.error && <div role="alert" className="card p-4 text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {ov.error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Governed agreement" value={o?.governedAgreement != null ? `${o.governedAgreement}%` : '…'} sub="Latest eval, governed agents A and B" />
        <Kpi label="Ungoverned agreement" value={o?.ungovernedAgreement != null ? `${o.ungovernedAgreement}%` : '…'} sub="Latest eval, own-prompt agents" />
        <Kpi label="Open conflicts" value={o ? String(o.openConflicts) : '…'} sub="Definitions waiting for an owner" />
        <Kpi label="Approved terms" value={o ? `${o.approvedTerms} / ${o.totalTerms}` : '…'} sub="In the governed glossary" />
      </div>

      <Card title="Ask every agent" right={<><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>Semantic Views</PoweredBy>{res && <SourceBadge p={res} />}</>}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label htmlFor="q" className="text-xs muted">Question</label>
          <select id="q" className="btn !font-normal min-w-0 max-w-full" value={qid} onChange={(e) => { setQid(e.target.value); setRes(undefined); }} disabled={busy}>
            {(o?.questions ?? []).map((q) => <option key={q.id} value={q.id}>{q.question}</option>)}
          </select>
          <button className="btn btn-primary" onClick={ask} disabled={busy || !o}><Play className="w-3.5 h-3.5" aria-hidden />Ask all four agents</button>
        </div>

        {busy && <Reasoning kind="ask" />}
        {err && <div role="alert" className="text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {err}</div>}
        {!busy && !res && !err && (
          <p className="text-sm muted">Pick a question and ask. Start with &ldquo;How many active accounts do we have?&rdquo;: on this synthetic data set the two
            own-prompt agents give different numbers.</p>
        )}
        {res && (
          <div className="grid lg:grid-cols-2 gap-4 fade-up">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Ungoverned: each team&rsquo;s own prompt</h3>
                <div className="flex gap-2 flex-wrap"><AgreePill agree={res.ungovernedAgree} /><PoweredBy>AI_COMPLETE</PoweredBy>{sample && <SampleAiBadge />}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2"><Answer a={res.ungovernedA} governed={false} /><Answer a={res.ungovernedB} governed={false} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Governed agents A and B: shared context</h3>
                <div className="flex gap-2 flex-wrap"><AgreePill agree={res.governedAgree} /><PoweredBy>Cortex Analyst + Cortex Search</PoweredBy>{sample && <SampleAiBadge />}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2"><Answer a={res.governedA} governed /><Answer a={res.governedB} governed /></div>
              {!res.governedAgree && (
                <div className="ai-panel text-sm">
                  <strong>Why the governed agents still differ:</strong> {res.judgeNote}{' '}
                  <Link href="/resolver" className="underline inline-flex items-center gap-1">Resolve the conflict<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
