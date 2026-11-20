'use client';

import { CalendarClock, ListChecks, Play, ShieldCheck, Swords } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, ChartTip, GRID, Legend } from '@/components/charts';
import { Reasoning } from '@/components/Reasoning';
import { AgreePill, Drawer, Empty, ErrorBox, Kpi, PageHead, Panel, PoweredBy, Provenance, Skeleton } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import { markBeat } from '@/lib/story';
import type { EvalRow } from '@/lib/types';

export default function Monitor() {
  const [tick, setTick] = useState(0);
  const m = useAsync(() => data.monitor(), [tick]);
  const [busy, setBusy] = useState(false);
  const [took, setTook] = useState<number>();
  const [err, setErr] = useState<string>();
  const [row, setRow] = useState<{ q: string; g?: EvalRow; u?: EvalRow }>();

  async function run() {
    setBusy(true); setErr(undefined);
    try { const r = await data.runEval(); setTook(r.latencyMs); markBeat('monitor'); setTick((t) => t + 1); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  }
  const h = m.data?.history ?? [];
  // Seeded and real points are drawn as separate series so seeded history reads as dashed.
  const lastSeeded = h.map((p) => p.seeded).lastIndexOf(true);
  const chart = h.map((p, i) => ({ label: p.day.slice(5),
    gS: p.seeded ? p.governed : null, uS: p.seeded ? p.ungoverned : null,
    g: !p.seeded || i === lastSeeded ? p.governed : null, u: !p.seeded || i === lastSeeded ? p.ungoverned : null }));
  const last = h.at(-1);
  const rows = m.data?.questions.map((q) => ({ q, g: m.data!.latest.find((r) => r.questionId === q.id && r.pair === 'governed'), u: m.data!.latest.find((r) => r.questionId === q.id && r.pair === 'ungoverned') })) ?? [];

  return (
    <>
      <PageHead eyebrow="Consistency monitor" title="Do our agents still agree tonight?"
        lede="A suspended nightly task asks the question bank of all four agents and an AI_COMPLETE judge scores each pair. Run it now to add a point to the trend."
        right={<><PoweredBy>Snowflake Tasks</PoweredBy><PoweredBy>AI_COMPLETE judge</PoweredBy></>} />
      {(m.error || err) && <div className="mb-4"><ErrorBox error={(m.error || err)!} /></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <Kpi label="Governed, latest" value={m.data ? last?.governed ?? 0 : null} suffix="%" tone="accord" icon={<ShieldCheck className="w-4 h-4" />} note={last?.seeded ? 'seeded point' : 'real run'} />
        <Kpi label="Ungoverned, latest" value={m.data ? last?.ungoverned ?? 0 : null} suffix="%" tone="drift" icon={<Swords className="w-4 h-4" />} />
        <Kpi label="Question bank" value={m.data?.questions.length} icon={<ListChecks className="w-4 h-4" />} note="AGENTS.QUESTION_BANK" />
        <div className="panel p-4 fade-up">
          <div className="flex items-center justify-between"><span className="eyebrow">Nightly task</span><CalendarClock className="w-4 h-4 muted" aria-hidden /></div>
          <div className="mt-2 text-[20px] font-semibold capitalize">{m.data?.taskState ?? <Skeleton className="w-24 h-7" />}</div>
          <div className="text-xs muted mt-1 break-words">NIGHTLY_CONSISTENCY_EVAL · 02:00 ET when resumed</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <Panel className="lg:col-span-2" title="Agreement trend" sub="Dashed: seeded history. Solid: real runs."
          right={<Legend items={[{ label: 'Governed', color: 'var(--accord)' }, { label: 'Ungoverned', color: 'var(--drift)' }, { label: 'Seeded', color: 'var(--muted)', dashed: true }]} />}>
          {!m.data ? <Skeleton className="h-[260px]" /> : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} minTickGap={18} />
                  <YAxis {...AXIS} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" />
                  <Tooltip content={<ChartTip unit="%" />} cursor={{ stroke: 'var(--line)' }} />
                  <Line name="Governed (seeded)" dataKey="gS" stroke="var(--accord)" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line name="Ungoverned (seeded)" dataKey="uS" stroke="var(--drift)" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line name="Governed" dataKey="g" stroke="var(--accord)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--accord)' }} connectNulls />
                  <Line name="Ungoverned" dataKey="u" stroke="var(--drift)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--drift)' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Run the eval now" sub="6 questions × 4 agents, then 12 judge calls">
          {busy ? <Reasoning kind="eval" /> : (
            <>
              <button className="btn btn-primary w-full justify-center" onClick={run}><Play className="w-4 h-4" aria-hidden />Run consistency eval</button>
              <p className="text-xs muted mt-3">Live runs call every agent for real; about 3–4 minutes on this data set. Sample mode replays a captured run.</p>
              {took != null && <p className="text-xs mt-2"><Provenance p={{ source: 'snowflake', latencyMs: took }} ai={false} /></p>}
              {m.data?.latestRunAt && <p className="text-xs text-2 mt-3">Last real run: <span className="mono">{m.data.latestRunAt.slice(0, 16).replace('T', ' ')}</span></p>}
            </>
          )}
        </Panel>
      </div>

      <Panel title="Latest run, per question" sub="Click a row for the judge's notes" right={m.data?.latest.length ? <Provenance p={m.data} /> : null} pad={false}>
        {m.data && m.data.latest.length === 0 ? (
          <Empty icon={<ListChecks className="w-5 h-5" />} title="No real run yet">The trend so far is seeded history. Run the eval to see each question&apos;s result.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid min-w-[620px]">
              <thead><tr><th>ID</th><th>Question</th><th>Ungoverned pair</th><th>Governed pair</th></tr></thead>
              <tbody>
                {!m.data ? <tr><td colSpan={4}><Skeleton className="h-24" /></td></tr> : rows.map((r) => (
                  <tr key={r.q.id} className="clickable" onClick={() => setRow({ q: r.q.question, g: r.g, u: r.u })}>
                    <td className="mono text-[11.5px] muted">{r.q.id}</td>
                    <td className="text-[13px]">{r.q.question}</td>
                    <td>{r.u && <AgreePill agree={r.u.agree} />}</td>
                    <td>{r.g && <AgreePill agree={r.g.agree} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Drawer open={!!row} onClose={() => setRow(undefined)} title={row?.q ?? ''}>
        {row && (['g', 'u'] as const).map((k) => row[k] && (
          <div key={k} className="panel-2 p-4 mb-3">
            <div className="flex items-center justify-between gap-2 mb-2"><span className="font-semibold text-sm">{k === 'g' ? 'Governed pair' : 'Ungoverned pair'}</span><AgreePill agree={row[k]!.agree} /></div>
            <p className="text-[13px] text-2 leading-relaxed">{row[k]!.note}</p>
          </div>
        ))}
        {m.data?.source === 'mock' && <span className="pill pill-sample">Sample AI response</span>}
      </Drawer>
    </>
  );
}
