'use client';

// Screen 4: one orchestrator agent over three domain semantic views. Nothing is merged into one
// giant model; the answer shows which domain view answered each part.
import { Bot, Database, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Card, Markdown, PoweredBy, SampleAiBadge, SourceBadge } from '@/components/ui';
import { data, isLive } from '@/lib/client';
import type { ComposeResult } from '@/lib/types';

const DOMAINS = [
  { tool: 'Accounts', view: 'ACCOUNTS_SV', owner: 'Account Operations', covers: 'Active, funded, and total accounts; balances; account events' },
  { tool: 'Service', view: 'SERVICE_SV', owner: 'Client Service', covers: 'Service requests, open requests, resolution time' },
  { tool: 'Advisors', view: 'ADVISORS_SV', owner: 'Advisor Platform', covers: 'Advisors, regions, accounts and assets per book' },
];
const PRESETS = [
  'How many active accounts do we have, how many service requests are open, and how many advisors are in the West region?',
  'What is the average resolution time for address change requests?',
  'How many advisors are there per region, and what is the total balance in their books?',
];

export default function Composer() {
  const [q, setQ] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ComposeResult>();
  const [err, setErr] = useState<string>();
  const [live, setLive] = useState(false);
  useEffect(() => { isLive().then(setLive); }, []);
  const run = async (question = q) => {
    setBusy(true); setErr(undefined); setRes(undefined);
    try { setRes(await data.compose(question)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const used = new Set(res?.tools ?? []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Domain composer</h1>
        <p className="text-sm text-2 mt-1 max-w-3xl">Each domain keeps its own governed semantic view and owner. One orchestrator Cortex Agent routes each part of a
          question to the domain that owns it, so you can combine domains without merging them into one model.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3 stagger">
        {DOMAINS.map((d) => {
          const on = used.has(d.tool);
          return (
            <div key={d.view} className="card p-4 transition-all" style={on ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 3px var(--accent-soft)' } : undefined}>
              <div className="flex items-center gap-2 mb-1"><Database className="w-4 h-4" style={{ color: 'var(--accent)' }} aria-hidden /><code className="text-sm font-semibold">{d.view}</code>
                {on && <span className="ml-auto text-[11px] font-semibold" style={{ color: 'var(--positive)' }}>Answered</span>}</div>
              <div className="text-xs muted mb-1">Owner: {d.owner}</div>
              <div className="text-sm">{d.covers}</div>
            </div>
          );
        })}
      </div>

      <Card title={<span className="flex items-center gap-2"><Bot className="w-4 h-4" aria-hidden />Operations orchestrator</span>}
        right={<><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>Cortex Analyst</PoweredBy>{res && <SourceBadge p={res} />}</>}>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => <button key={p} className="btn text-xs !font-normal text-left" onClick={() => { setQ(p); run(p); }} disabled={busy}>{p}</button>)}
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <label htmlFor="cq" className="sr-only">Question</label>
          <input id="cq" className="btn !font-normal flex-1 min-w-[220px]" value={q} onChange={(e) => setQ(e.target.value)} readOnly={!live}
            title={live ? undefined : 'Sample mode answers the three sample questions; Live mode takes any question'} />
          <button className="btn btn-primary" onClick={() => run()} disabled={busy || !q.trim()}><Play className="w-3.5 h-3.5" aria-hidden />Ask</button>
        </div>
        {busy && <Reasoning kind="compose" />}
        {err && <div role="alert" className="text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {err}</div>}
        {res && (
          <div className="ai-panel">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-semibold">Domains used: {res.tools.length ? res.tools.join(', ') : 'none'}</span>
              {res.source === 'mock' && <SampleAiBadge />}
            </div>
            <Markdown text={res.text} />
          </div>
        )}
      </Card>
    </div>
  );
}
