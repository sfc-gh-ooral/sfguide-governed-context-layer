'use client';

import { Bot, CircleSlash, Play, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { AgreePill, Empty, ErrorBox, PageHead, Panel, PoweredBy, Provenance, StreamText } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { beats, markBeat } from '@/lib/story';
import type { AgentAnswer, AskResult } from '@/lib/types';

const CITE: Record<string, string> = { Accounts: 'ACCOUNTS_SV', Service: 'SERVICE_SV', Advisors: 'ADVISORS_SV', Procedures: 'PROCEDURES_SEARCH' };

function AnswerCard({ a, governed, delay }: { a: AgentAnswer; governed: boolean; delay: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  const [name, kind] = a.agent.split(' (');
  return (
    <div className="panel-2 p-4 min-w-0 fade-up" style={{ borderColor: governed ? 'rgba(200,242,90,.28)' : 'rgba(255,122,92,.28)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: governed ? 'var(--accord-soft)' : 'var(--drift-soft)', color: governed ? 'var(--accord)' : 'var(--drift)' }}>
          {governed ? <ShieldCheck className="w-4 h-4" aria-hidden /> : <Bot className="w-4 h-4" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold truncate">{name}</span>
          <span className="block text-[11px] muted">{kind?.replace(')', '')}</span>
        </span>
      </div>
      <div className="min-h-[72px]">{show ? <StreamText text={a.text} /> : <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" /></div>}</div>
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        {governed && a.tools?.length ? a.tools.map((t) => <span key={t} className="pill pill-source mono">cites {CITE[t] ?? t}</span>)
          : <span className="pill pill-quiet">No citation · own prompt</span>}
      </div>
    </div>
  );
}

function Verdict({ agree, label }: { agree: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-3" style={{ background: agree ? 'var(--accord-soft)' : 'var(--drift-soft)' }}>
      <span className="text-[13px] font-semibold" style={{ color: agree ? 'var(--accord)' : 'var(--drift)' }}>{label}</span>
      <AgreePill agree={agree} label={agree ? 'Same facts' : 'Different facts'} />
    </div>
  );
}

export default function Ask() {
  const ov = useAsync(() => data.overview(), []);
  const [qid, setQid] = useState('Q1');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult>();
  const [err, setErr] = useState<string>();
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('q'); if (q) setQid(q); }, []);

  async function ask() {
    setBusy(true); setErr(undefined); setRes(undefined);
    try {
      const r = await data.ask(qid);
      setRes(r);
      if (!r.ungovernedAgree) markBeat('disagree');
      if (r.governedAgree && beats().includes('approve')) markBeat('agree');
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  }
  const qs = ov.data?.questions ?? [];
  const q = qs.find((x) => x.id === qid);

  return (
    <>
      <PageHead eyebrow="Side by side" title="Ask once. Compare every agent."
        lede="Agents A and B each run on their own prompt and the wiki page they were built from. The governed versions of the same agents read one semantic view and one approved procedure index."
        right={<><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>Cortex Analyst</PoweredBy><PoweredBy>Cortex Search</PoweredBy></>} />

      <Panel className="mb-5" title="Question bank" sub="The same six questions run every night in the consistency monitor">
        <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Question">
          {qs.length === 0 && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-8 w-48" />)}
          {qs.map((x) => (
            <button key={x.id} role="radio" aria-checked={x.id === qid} onClick={() => setQid(x.id)} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-[13px] border text-left transition-colors"
              style={x.id === qid ? { background: 'var(--accord-soft)', borderColor: 'rgba(200,242,90,.5)', color: 'var(--text)' } : { borderColor: 'var(--line)', color: 'var(--text-2)' }}>
              <span className="mono text-[11px] muted mr-1.5">{x.id}</span>{x.question}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-primary" onClick={ask} disabled={busy || !q}><Play className="w-4 h-4" aria-hidden />{busy ? 'Asking four agents…' : 'Ask all four agents'}</button>
          {res && <Provenance p={res} />}
          {q && <span className="text-xs muted">Topic: <span className="mono">{q.topic}</span></span>}
        </div>
      </Panel>

      {err && <div className="mb-4"><ErrorBox error={err} /></div>}
      {busy && <div className="max-w-2xl mb-5"><Reasoning kind="ask" /></div>}
      {!busy && !res && !err && (
        <div className="panel"><Empty icon={<CircleSlash className="w-5 h-5" />} title="No answers yet">Pick a question and ask all four agents. Start with Q1: it shows the planted disagreement.</Empty></div>
      )}

      {res && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Ungoverned agents" sub="Own prompt, own wiki page, AI_COMPLETE" right={<PoweredBy>AI_COMPLETE</PoweredBy>}>
            <Verdict agree={res.ungovernedAgree} label={res.ungovernedAgree ? 'They happen to agree' : 'They disagree'} />
            <div className="grid sm:grid-cols-2 gap-3"><AnswerCard a={res.ungovernedA} governed={false} delay={0} /><AnswerCard a={res.ungovernedB} governed={false} delay={250} /></div>
          </Panel>
          <Panel title="Governed agents A and B" sub="Same agents, reading shared semantic views and approved procedures" right={<PoweredBy>Cortex Agents</PoweredBy>}>
            <Verdict agree={res.governedAgree} label={res.governedAgree ? 'One answer, one cited definition' : 'Still split: the context has an open conflict'} />
            <div className="grid sm:grid-cols-2 gap-3"><AnswerCard a={res.governedA} governed delay={500} /><AnswerCard a={res.governedB} governed delay={750} /></div>
            <div className="panel-2 p-3 mt-3 text-xs text-2"><span className="eyebrow mr-2">Judge</span>{res.judgeNote}</div>
          </Panel>
        </div>
      )}
    </>
  );
}
