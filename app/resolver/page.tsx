'use client';

import { Check, CheckCircle2, GitMerge, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Empty, ErrorBox, Loading, Markdown, PageHead, Panel, PoweredBy, Provenance, StatusPill, StreamText } from '@/components/ui';
import { data } from '@/lib/client';
import { markBeat } from '@/lib/story';
import type { Conflict, Provenance as Prov } from '@/lib/types';

function Detail({ c, onDone }: { c: Conflict; onDone: () => void }) {
  const [pick, setPick] = useState(c.options.find((o) => o.chosen)?.docId ?? '');
  const [note, setNote] = useState('');
  const [expl, setExpl] = useState<{ text: string; p?: Prov; fresh: boolean }>({ text: c.explanation, fresh: false });
  const [busy, setBusy] = useState<'explain' | 'approve'>();
  const [msg, setMsg] = useState<{ text: string; p: Prov }>();
  const [err, setErr] = useState<string>();
  useEffect(() => { setPick(c.options.find((o) => o.chosen)?.docId ?? ''); setExpl({ text: c.explanation, fresh: false }); setMsg(undefined); setErr(undefined); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const explain = async () => {
    setBusy('explain'); setErr(undefined);
    try { const r = await data.explain(c.id); setExpl({ text: r.text, p: r, fresh: true }); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(undefined); }
  };
  const approve = async () => {
    setBusy('approve'); setErr(undefined);
    try {
      const r = await data.approve(c.id, pick, note || 'Approved in the conflict resolver');
      setMsg({ text: r.message, p: r }); markBeat('approve'); onDone();
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(undefined); }
  };
  const single = c.options.length === 1;

  return (
    <div className="space-y-4 min-w-0">
      <Panel title={<span className="flex items-center gap-2 flex-wrap"><span className="mono text-xs muted">{c.id}</span>{c.term}</span>}
        sub={`Owner: ${c.owner} · ${c.kind}`} right={c.resolved ? <StatusPill status="approved" /> : <StatusPill status={single ? 'missing' : 'conflict'} />}>
        <div className={`grid gap-3 ${single ? '' : 'md:grid-cols-2'}`} role="radiogroup" aria-label="Choose a definition">
          {c.options.map((o, i) => {
            const on = pick === o.docId;
            return (
              <button key={o.docId} role="radio" aria-checked={on} disabled={c.resolved || !!busy} onClick={() => setPick(o.docId)}
                className="text-left panel-2 p-4 transition-all relative min-w-0"
                style={on ? { borderColor: 'var(--accord)', boxShadow: '0 0 0 3px rgba(200,242,90,.12)' } : undefined}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="pill" style={{ background: i ? 'var(--drift-soft)' : 'var(--source-soft)', color: i ? 'var(--drift)' : 'var(--source)' }}>{single ? 'Proposal' : `Option ${String.fromCharCode(65 + i)}`} · {o.docId}</span>
                  <span className="w-5 h-5 rounded-full border grid place-items-center" style={on ? { background: 'var(--accord)', borderColor: 'var(--accord)' } : { borderColor: 'var(--line)' }}>
                    {on && <Check className="w-3 h-3" style={{ color: '#0b0e12' }} aria-hidden />}
                  </span>
                </div>
                <div className="font-semibold text-[13.5px] mb-1">{o.label}</div>
                <p className="text-[13px] text-2 leading-relaxed">{o.definition}</p>
                {o.svExpression && <div className="mono text-[11.5px] mt-3 px-2 py-1.5 rounded-md break-words" style={{ background: 'var(--bg)', color: 'var(--source)' }}>{o.svExpression}</div>}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Why these differ" sub="AI-detected conflict, explained for the owner" right={<><PoweredBy>AI_COMPLETE</PoweredBy>{expl.p ? <Provenance p={expl.p} /> : <span className="pill pill-quiet">Stored at setup</span>}</>}>
        {busy === 'explain' ? <Reasoning kind="explain" /> : expl.fresh ? <StreamText text={expl.text} /> : <Markdown text={expl.text} />}
        <button className="btn mt-3" onClick={explain} disabled={!!busy}><RefreshCw className="w-3.5 h-3.5" aria-hidden />Re-run the explanation</button>
      </Panel>

      <Panel title="Owner decision" sub="Human approval writes the definition back to the semantic view">
        {c.resolved && !msg ? (
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accord)' }} aria-hidden />
            Approved <span className="mono">{c.options.find((o) => o.chosen)?.docId}</span>. <Link className="underline" href="/ask">Ask the agents again</Link></div>
        ) : (
          <>
            <label className="text-xs muted block mb-1.5" htmlFor="note">Decision note (saved to CONTEXT.DECISIONS)</label>
            <textarea id="note" className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} disabled={!!busy || !!msg}
              placeholder="e.g. Growth reporting uses funded accounts; engagement is tracked as a separate metric." />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button className="btn btn-primary" onClick={approve} disabled={!pick || !!busy || !!msg}><GitMerge className="w-4 h-4" aria-hidden />Approve {pick || 'a definition'}</button>
              <PoweredBy>Semantic Views</PoweredBy><PoweredBy>Cortex Search</PoweredBy>
            </div>
            {busy === 'approve' && <div className="mt-4"><Reasoning kind="approve" /></div>}
          </>
        )}
        {msg && (
          <div className="mt-4 panel-2 p-3 flex items-start gap-2 fade-up" style={{ borderColor: 'rgba(200,242,90,.45)' }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--accord)' }} aria-hidden />
            <div className="text-sm min-w-0"><div className="flex gap-2 items-center flex-wrap mb-1"><strong>Written back</strong><Provenance p={msg.p} ai={false} /></div>
              <span className="text-2">{msg.text}</span> <Link className="underline" href={`/ask?q=${c.id === 'K2' ? 'Q2' : c.id === 'K3' ? 'Q5' : 'Q1'}`}>Ask the agents again</Link></div>
          </div>
        )}
        {err && <div className="mt-3"><ErrorBox error={err} /></div>}
      </Panel>
    </div>
  );
}

export default function Resolver() {
  const [list, setList] = useState<Conflict[]>();
  const [sel, setSel] = useState<string>();
  const [err, setErr] = useState<string>();
  const load = () => data.conflicts().then((l) => { setList(l); setSel((s) => s ?? new URLSearchParams(window.location.search).get('c') ?? l.find((x) => !x.resolved)?.id ?? l[0]?.id); }, (e) => setErr(String(e.message)));
  useEffect(() => { load(); markBeat('surface'); }, []);
  const c = list?.find((x) => x.id === sel);
  const open = list?.filter((x) => !x.resolved).length ?? 0;

  return (
    <>
      <PageHead eyebrow="Conflict resolver" title="Two pages, one term. The owner decides."
        lede="AI_EXTRACT mined candidate definitions from every wiki page; where approved pages disagree, or a BI metric is missing from the semantic view, the conflict lands here. Nothing changes until an owner approves."
        right={<span className={`pill ${open ? 'pill-drift' : 'pill-accord'}`}><span className="dot" aria-hidden />{list ? `${open} open of ${list.length}` : '…'}</span>} />
      {err && <ErrorBox error={err} />}
      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <Panel title="Queue" pad={false}>
          {!list ? <div className="p-4"><Loading rows={4} /></div> : list.length === 0 ? <Empty icon={<Sparkles className="w-5 h-5" />} title="No conflicts" /> : (
            <ul className="p-2 space-y-1">
              {list.map((x) => (
                <li key={x.id}>
                  <button onClick={() => setSel(x.id)} aria-current={x.id === sel} className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                    style={x.id === sel ? { background: 'var(--surface-3)' } : undefined}>
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-[13px] truncate">{x.term}</span>
                      <StatusPill status={x.resolved ? 'approved' : x.options.length === 1 ? 'missing' : 'conflict'} /></div>
                    <div className="mono text-[11px] muted mt-0.5 truncate">{x.id} · {x.options.map((o) => o.docId).join(' vs ')}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {c ? <Detail key={c.id} c={c} onDone={load} /> : <Panel><Loading rows={8} /></Panel>}
      </div>
    </>
  );
}
