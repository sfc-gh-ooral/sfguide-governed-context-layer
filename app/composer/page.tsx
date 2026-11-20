'use client';

import { Network, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Empty, ErrorBox, PageHead, Panel, PoweredBy, Provenance, StreamText } from '@/components/ui';
import { data, isLive } from '@/lib/client';
import type { ComposeResult } from '@/lib/types';

const PRESETS = [
  'How many active accounts do we have, how many service requests are open, and how many advisors are in the West region?',
  'What is the average resolution time for address change requests?',
  'How many advisors are there per region, and what is the total balance in their books?',
];
const NODES = [
  { id: 'Accounts', obj: 'ACCOUNTS_SV', y: 34 },
  { id: 'Service', obj: 'SERVICE_SV', y: 98 },
  { id: 'Advisors', obj: 'ADVISORS_SV', y: 162 },
  { id: 'Procedures', obj: 'PROCEDURES_SEARCH', y: 226 },
];

function Routing({ used, running }: { used: string[]; running: boolean }) {
  return (
    <svg viewBox="0 0 520 260" className="w-full h-auto" role="img" aria-label={`Orchestrator routed to: ${used.join(', ') || 'none yet'}`}>
      <defs><linearGradient id="edge" x1="0" x2="1"><stop offset="0" stopColor="#5ED0E8" /><stop offset="1" stopColor="#C8F25A" /></linearGradient></defs>
      {NODES.map((n) => {
        const on = used.includes(n.id);
        const d = `M150 130 C 250 130, 250 ${n.y + 18}, 330 ${n.y + 18}`;
        return (
          <g key={n.id}>
            <path d={d} fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 5" />
            {on && <path key={used.join()} d={d} fill="none" stroke="url(#edge)" strokeWidth="2.5" className="route-edge" />}
            <rect x="330" y={n.y} width="182" height="36" rx="9" fill={on ? 'rgba(200,242,90,.12)' : '#1A2029'} stroke={on ? '#C8F25A' : '#263040'} />
            <text x="344" y={n.y + 15} fill={on ? '#C8F25A' : '#A9B4C2'} fontSize="12" fontWeight="600">{n.id}</text>
            <text x="344" y={n.y + 29} fill="#8592A3" fontSize="10" fontFamily="var(--font-mono)">{n.obj}</text>
          </g>
        );
      })}
      <rect x="8" y="104" width="142" height="52" rx="11" fill="#12161C" stroke={running ? '#5ED0E8' : '#34404f'} />
      <text x="22" y="126" fill="#E8EDF2" fontSize="12.5" fontWeight="600">Orchestrator</text>
      <text x="22" y="142" fill="#8592A3" fontSize="10" fontFamily="var(--font-mono)">ORCHESTRATOR_AGENT</text>
    </svg>
  );
}

export default function Composer() {
  const [live, setLive] = useState(false);
  const [question, setQuestion] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ComposeResult>();
  const [err, setErr] = useState<string>();
  useEffect(() => { isLive().then(setLive); }, []);

  async function run(q = question) {
    setBusy(true); setErr(undefined); setRes(undefined);
    try { setRes(await data.compose(q)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead eyebrow="Domain composer" title="Three domains, one orchestrator, no giant model."
        lede="Accounts, Service and Advisors each keep their own semantic view and owner. One orchestrator Cortex Agent routes each part of a question to the right view and shows which one answered."
        right={<><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>Cortex Analyst</PoweredBy></>} />

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Panel title="Ask across domains" sub={live ? 'Pick a starter or write your own question' : 'Sample mode replays three captured questions'}>
            <div className="space-y-2 mb-3">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { setQuestion(p); if (!live) run(p); }} disabled={busy}
                  className="w-full text-left panel-2 lift px-3 py-2.5 text-[13px]" style={question === p ? { borderColor: 'rgba(200,242,90,.5)' } : undefined}>{p}</button>
              ))}
            </div>
            {live && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(); }}>
                <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Question" maxLength={400} />
                <button className="btn btn-primary" disabled={busy || !question.trim()}><Send className="w-4 h-4" aria-hidden /><span className="hidden sm:inline">Ask</span></button>
              </form>
            )}
            {!live && <button className="btn btn-primary" onClick={() => run()} disabled={busy}><Send className="w-4 h-4" aria-hidden />Ask the orchestrator</button>}
          </Panel>
          <Panel title="Routing" sub="Which domain view answered" right={res && <span className="pill pill-accord">{res.tools.length} of 4 used</span>}>
            <Routing used={res?.tools ?? []} running={busy} />
          </Panel>
        </div>

        <Panel title="Orchestrated answer" right={res && <Provenance p={res} />} className="min-h-[300px]">
          {err && <ErrorBox error={err} />}
          {busy && <Reasoning kind="compose" />}
          {!busy && !res && !err && <Empty icon={<Network className="w-5 h-5" />} title="Ask a question">The answer cites each domain it used, and the routing panel lights up the views that answered.</Empty>}
          {res && (
            <>
              <div className="text-[13px] font-semibold mb-3">{res.question}</div>
              <StreamText text={res.text} />
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                {res.tools.map((t) => <span key={t} className="pill pill-source mono">{NODES.find((n) => n.id === t)?.obj ?? t}</span>)}
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
