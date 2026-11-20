'use client';

// Screen 5: a nightly eval asks the question bank of every agent and an AI_COMPLETE judge scores
// agreement. The trend shows agreement climbing as owners approve definitions.
import { Play } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Reasoning } from '@/components/Reasoning';
import { AgreePill, Card, Kpi, PoweredBy, SampleAiBadge, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

export default function MonitorPage() {
  const [tick, setTick] = useState(0);
  const m = useAsync(() => data.monitor(), [tick]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [took, setTook] = useState<number>();
  const run = async () => {
    setBusy(true); setErr(undefined);
    try { const r = await data.runEval(); setTook(r.latencyMs); setTick((t) => t + 1); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const h = m.data?.history ?? [];
  const last = h.at(-1);
  const first = h[0];
  const chart = h.map((p) => ({ day: p.day.slice(5) + (p.seeded ? '' : ' (run)'), Governed: p.governed, Ungoverned: p.ungoverned }));
  const rows = m.data?.latest ?? [];
  const qids = [...new Set(rows.map((r) => r.questionId))];
  const sample = m.data?.source === 'mock';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Consistency monitor</h1>
        <p className="text-sm text-2 mt-1 max-w-3xl">Every night a Snowflake task asks the question bank of all four agents. An AI_COMPLETE judge checks whether each pair
          gives the same facts. Earlier points are seeded history on this synthetic data set; runs you start are marked &ldquo;run&rdquo;.</p>
      </div>
      {m.error && <div role="alert" className="card p-4 text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {m.error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Governed agreement" value={last?.governed != null ? `${last.governed}%` : '…'} sub={first?.governed != null ? `From ${first.governed}% on ${first.day}` : ''} />
        <Kpi label="Ungoverned agreement" value={last?.ungoverned != null ? `${last.ungoverned}%` : '…'} sub="Own-prompt agents A and B" />
        <Kpi label="Questions in the bank" value={m.data ? String(m.data.questions.length) : '…'} sub="AGENTS.QUESTION_BANK" />
        <Kpi label="Nightly task" value={m.data?.taskState ?? '…'} sub="NIGHTLY_CONSISTENCY_EVAL, 02:00 ET" />
      </div>

      <Card title="Agreement rate by night" right={<><PoweredBy>Snowflake Tasks</PoweredBy>{m.data && <SourceBadge p={m.data} />}</>}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Governed" stroke="var(--positive)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Ungoverned" stroke="var(--negative)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Latest run, by question" right={<><PoweredBy>Cortex Agents</PoweredBy><PoweredBy>AI_COMPLETE judge</PoweredBy>{sample && rows.length > 0 && <SampleAiBadge />}</>}>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button className="btn btn-primary" onClick={run} disabled={busy}><Play className="w-3.5 h-3.5" aria-hidden />Run the eval now</button>
          <span className="text-xs muted">{sample ? 'Sample mode replays a captured live run.' : 'Live: asks 6 questions of 4 agents; about 3–4 minutes.'}
            {took !== undefined && ` Last run took ${(took / 1000).toFixed(0)} s.`}</span>
        </div>
        {busy && <div className="mb-3"><Reasoning kind="eval" /></div>}
        {err && <div role="alert" className="text-sm mb-2" style={{ color: 'var(--negative)' }}>Live call failed: {err}</div>}
        {busy ? null : !rows.length ? <p className="text-sm muted">No run yet in this session. Approve definitions in the conflict resolver, then run the eval to see agreement climb.</p> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Question</th><th>Governed A vs B</th><th>Ungoverned A vs B</th><th>Judge note (governed)</th></tr></thead>
              <tbody>
                {qids.map((id) => {
                  const g = rows.find((r) => r.questionId === id && r.pair === 'governed');
                  const u = rows.find((r) => r.questionId === id && r.pair === 'ungoverned');
                  return (
                    <tr key={id}><td className="font-medium">{g?.question ?? u?.question}</td>
                      <td>{g && <AgreePill agree={g.agree} />}</td><td>{u && <AgreePill agree={u.agree} />}</td>
                      <td className="text-xs text-2 max-w-[420px]">{g?.note}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
