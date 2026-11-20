'use client';

// Screen 3: AI-detected conflicting definitions side by side. The owner picks one and approves;
// the decision is written back to the semantic view (human in the loop).
import { CheckCircle2, GitMerge, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Card, Markdown, Thinking, PoweredBy, SampleAiBadge, SourceBadge, StatusPill } from '@/components/ui';
import { data, isLive } from '@/lib/client';
import type { Conflict } from '@/lib/types';

function ConflictCard({ c, live, onDone }: { c: Conflict; live: boolean; onDone: () => void }) {
  const [pick, setPick] = useState(c.options.find((o) => o.chosen)?.docId ?? c.options[0].docId);
  const [note, setNote] = useState('');
  const [expl, setExpl] = useState<{ text: string; latencyMs?: number; fresh: boolean }>({ text: c.explanation, fresh: false });
  const [busy, setBusy] = useState<'explain' | 'approve'>();
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();
  const single = c.options.length === 1;

  const explain = async () => {
    setBusy('explain'); setErr(undefined);
    try { const r = await data.explain(c.id); setExpl({ text: r.text, latencyMs: r.latencyMs, fresh: true }); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(undefined); }
  };
  const approve = async () => {
    setBusy('approve'); setErr(undefined);
    try { const r = await data.approve(c.id, pick, note || 'Approved in the conflict resolver'); setMsg(r.message); onDone(); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(undefined); }
  };

  return (
    <Card title={<span className="flex items-center gap-2"><GitMerge className="w-4 h-4" aria-hidden />{c.term}<StatusPill status={c.resolved ? 'approved' : single ? 'missing' : 'conflict'} /></span>}
      right={<span className="text-xs muted">Owner: {c.owner}</span>}>
      <div className={`grid gap-3 mb-3 ${single ? '' : 'md:grid-cols-2'}`} role="radiogroup" aria-label={`Definitions for ${c.term}`}>
        {c.options.map((o) => (
          <label key={o.docId} className="rounded-xl border p-3 cursor-pointer block transition-colors"
            style={{ borderColor: pick === o.docId ? 'var(--brand)' : 'var(--border)', background: pick === o.docId ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <input type="radio" name={c.id} checked={pick === o.docId} onChange={() => setPick(o.docId)} disabled={c.resolved} />
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs muted ml-auto">{o.docId}</span>
            </div>
            <p className="text-sm">{o.definition}</p>
            {o.svExpression && <div className="text-xs mt-2"><span className="muted">Compiles to </span><code>{o.svExpression}</code></div>}
            {c.resolved && o.chosen && <div className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--positive)' }}><CheckCircle2 className="w-3.5 h-3.5" aria-hidden />Approved</div>}
            {c.resolved && !o.chosen && o.docId.startsWith('WIKI') && <div className="text-xs mt-2 muted">Page marked superseded</div>}
          </label>
        ))}
      </div>

      <div className="ai-panel mb-3">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--ai)' }}>What differs</span>
          <div className="flex gap-2 items-center flex-wrap">
            <PoweredBy>AI_COMPLETE</PoweredBy>
            {!live && <SampleAiBadge />}
            {expl.fresh && live && <SourceBadge p={{ source: 'snowflake', latencyMs: expl.latencyMs }} />}
            <button className="btn btn-ai !py-1 text-xs" onClick={explain} disabled={!!busy}><RefreshCw className="w-3.5 h-3.5" aria-hidden />Re-run</button>
          </div>
        </div>
        {busy === 'explain' ? <Reasoning kind="explain" /> : <Markdown text={expl.text} />}
      </div>

      {err && <div role="alert" className="text-sm mb-2" style={{ color: 'var(--negative)' }}>Live call failed: {err}</div>}
      {busy === 'approve' && <div className="mb-3"><Reasoning kind="approve" /></div>}
      {msg && <div role="status" className="text-sm mb-2" style={{ color: 'var(--positive)' }}>{msg} <Link href="/" className="underline">Ask the agents again</Link></div>}
      {!c.resolved && (
        <div className="flex flex-wrap gap-2 items-center">
          <label className="sr-only" htmlFor={`note-${c.id}`}>Decision note</label>
          <input id={`note-${c.id}`} className="btn !font-normal flex-1 min-w-[200px]" placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" onClick={approve} disabled={!!busy}>{single ? 'Approve and add to semantic view' : 'Approve this definition'}</button>
        </div>
      )}
    </Card>
  );
}

export default function Resolver() {
  const [list, setList] = useState<Conflict[]>();
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string>();
  const load = () => data.conflicts().then(setList, (e) => setErr(String(e.message)));
  useEffect(() => { isLive().then(setLive); load(); }, []);
  const open = list?.filter((c) => !c.resolved).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Conflict resolver</h1>
        <p className="text-sm text-2 mt-1 max-w-3xl">AI_EXTRACT mined definitions from the wiki and the BI export; where sources disagree, the data product owner decides.
          Approving updates the glossary, rebuilds ACCOUNTS_SV, marks the other page superseded so Cortex Search stops returning it, and updates the tag.</p>
        {list && <p className="text-sm mt-2"><strong>{open}</strong> open of {list.length} on this synthetic data set.</p>}
      </div>
      {err && <div role="alert" className="card p-4 text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {err}</div>}
      {!list && !err && <Thinking label="Loading conflicts" />}
      <div className="space-y-4">{list?.map((c) => <ConflictCard key={`${c.id}-${c.resolved}`} c={c} live={live} onDone={load} />)}</div>
    </div>
  );
}
