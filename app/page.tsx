'use client';

import { ArrowRight, BookCheck, GitMerge, ShieldCheck, Swords } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, ChartTip, GRID, Legend } from '@/components/charts';
import { ErrorBox, fmt, Kpi, Loading, PageHead, Panel, PoweredBy, Provenance, Skeleton, StatusPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const TYPE_SHORT: Record<string, string> = { 'Individual Brokerage': 'Individual', 'Joint Brokerage': 'Joint', 'Traditional IRA': 'Trad. IRA', 'Roth IRA': 'Roth IRA', 'Cash Management': 'Cash Mgmt' };

export default function Overview() {
  const s = useAsync(() => Promise.all([data.overview(), data.inventory(), data.conflicts()]), []);
  const [ov, inv, conflicts] = s.data ?? [];
  const active = inv?.terms.find((t) => t.svName === 'active_accounts');
  const funded = ov?.byType.reduce((a, r) => a + r.funded, 0);
  const logged = ov?.byType.reduce((a, r) => a + r.loggedIn, 0);
  const resolved = active?.status === 'approved';
  const governedValue = active?.sourceRef === 'WIKI-11' ? logged : funded;
  const hist = ov?.history.map((p) => ({ ...p, label: p.day.slice(5) })) ?? [];
  const first = ov?.history[0];
  const open = conflicts?.filter((c) => !c.resolved) ?? [];

  return (
    <>
      <PageHead eyebrow="Overview · as of 15 Nov 2026"
        title={<>Two agents, one question, <span style={{ color: 'var(--drift)' }}>two answers</span>. Until the context is governed.</>}
        lede="Veritome keeps Northwind Financial's business definitions in one place: governed semantic views, an approved procedure index, and tags. Every agent reads the same context, so every agent gives the same answer."
        right={<><PoweredBy>Semantic Views</PoweredBy><Provenance p={ov} ai={false} /></>} />

      {s.error && <div className="mb-4"><ErrorBox error={s.error} /></div>}

      {/* The planted disagreement, as numbers */}
      <section className="panel fade-up p-5 md:p-6 mb-5 overflow-hidden relative">
        <div className="grid lg:grid-cols-[1.1fr_auto_1fr] gap-6 items-center">
          <div className="min-w-0">
            <div className="eyebrow mb-3">&ldquo;How many active accounts do we have?&rdquo;</div>
            <div className="space-y-3">
              {[{ who: 'Agent A · account opening', n: funded, why: 'reads WIKI-03: open and funded' },
                { who: 'Agent B · account maintenance', n: logged, why: 'reads WIKI-11: logged in within 90 days' }].map((r) => (
                <div key={r.who} className="flex items-baseline gap-4 flex-wrap">
                  <span className="text-[34px] md:text-[42px] font-semibold tabular tracking-[-0.03em] leading-none" style={{ color: 'var(--drift)' }}>
                    {r.n == null ? <Skeleton className="inline-block w-40 h-10" /> : fmt(r.n)}
                  </span>
                  <span className="text-xs text-2"><strong className="text-[var(--text)]">{r.who}</strong><br />{r.why}</span>
                </div>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 120 120" className="hidden lg:block w-28 h-28" aria-hidden>
            <path d="M4 26 C 60 26, 60 60, 116 60" fill="none" stroke="var(--drift)" strokeWidth="2.5" />
            <path d="M4 94 C 60 94, 60 60, 116 60" fill="none" stroke="var(--drift)" strokeWidth="2.5" />
            <circle cx="112" cy="60" r="6" fill="var(--accord)" />
          </svg>
          <div className="panel-2 p-4 min-w-0" style={resolved ? { borderColor: 'rgba(200,242,90,.45)' } : undefined}>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="eyebrow">Governed answer</span>
              {active && <StatusPill status={active.status} />}
            </div>
            {!inv ? <Loading rows={2} /> : (
              <>
                <div className="text-[38px] font-semibold tabular tracking-[-0.03em] leading-none" style={{ color: resolved ? 'var(--accord)' : 'var(--draft)' }}>{governedValue != null ? fmt(governedValue) : '—'}</div>
                {resolved ? (
                  <p className="text-xs text-2 mt-2">Both governed agents read <code>active_accounts</code> from <code>ACCOUNTS_SV</code>, approved by {active?.approvedBy ?? 'the owner'} from {active?.sourceRef}.</p>
                ) : (
                  <>
                    <p className="text-xs text-2 mt-2">Both governed agents read <code>active_accounts</code> from <code>ACCOUNTS_SV</code>, so they agree. But the view still uses WIKI-03 provisionally: the term is tagged conflict until its owner approves one definition.</p>
                    <Link href="/resolver" className="btn btn-primary mt-3">Resolve the conflict<ArrowRight className="w-4 h-4" aria-hidden /></Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <Kpi label="Governed agreement" value={ov?.governedAgreement} suffix="%" tone="accord" icon={<ShieldCheck className="w-4 h-4" />}
          delta={ov?.governedAgreement != null && first?.governed != null ? { v: ov.governedAgreement - first.governed, good: ov.governedAgreement >= first.governed, text: `${ov.governedAgreement - first.governed >= 0 ? '+' : ''}${ov.governedAgreement - first.governed} pts in ${ov.history.length} runs` } : undefined} />
        <Kpi label="Ungoverned agreement" value={ov?.ungovernedAgreement} suffix="%" tone="drift" icon={<Swords className="w-4 h-4" />} note="own prompts, own wiki" />
        <Kpi label="Approved terms" value={ov?.approvedTerms} suffix={ov ? ` / ${ov.totalTerms}` : ''} tone="source" icon={<BookCheck className="w-4 h-4" />} note="in the glossary" />
        <Kpi label="Open conflicts" value={ov?.openConflicts} tone={ov?.openConflicts ? 'draft' : 'accord'} icon={<GitMerge className="w-4 h-4" />} note={ov?.openConflicts ? 'need an owner' : 'all resolved'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <Panel className="lg:col-span-2" title="Agreement rate, nightly eval" sub="Share of the 6-question bank where both agents of a pair gave the same facts"
          right={<Legend items={[{ label: 'Governed agents', color: 'var(--accord)' }, { label: 'Ungoverned agents', color: 'var(--drift)' }]} />}>
          {!ov ? <Skeleton className="h-[240px]" /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hist} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis {...AXIS} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" />
                  <Tooltip content={<ChartTip unit="%" />} cursor={{ stroke: 'var(--line)' }} />
                  <Line name="Governed agents" dataKey="governed" stroke="var(--accord)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                  <Line name="Ungoverned agents" dataKey="ungoverned" stroke="var(--drift)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-[11.5px] muted mt-2">The first 14 nights are seeded history so the trend has a past; later points are real runs. <Link className="underline" href="/monitor">Open the monitor</Link></p>
        </Panel>

        <Panel title="Open work" sub="Conflicts waiting on an owner" right={<PoweredBy>AI_COMPLETE</PoweredBy>}>
          {!conflicts ? <Loading rows={4} /> : open.length === 0 ? (
            <div className="text-sm text-2 py-6 text-center"><ShieldCheck className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accord)' }} aria-hidden />Every conflict has an approved definition.</div>
          ) : (
            <ul className="space-y-2">
              {open.map((c) => (
                <li key={c.id}>
                  <Link href={`/resolver?c=${c.id}`} className="panel-2 lift p-3 flex items-center gap-3">
                    <span className="mono text-[11px] muted">{c.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{c.term}</span>
                      <span className="block text-[11.5px] muted truncate">{c.options.map((o) => o.docId).join(' vs ')} · {c.owner.split(' (')[0]}</span>
                    </span>
                    <StatusPill status={c.options.some((o) => o.docId.startsWith('BI')) || c.kind === 'missing' ? 'missing' : 'conflict'} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" title="Two definitions of &ldquo;active&rdquo;, by account type" sub="Open accounts on the synthetic data set: funded (WIKI-03) vs. logged in within 90 days (WIKI-11)"
          right={<Legend items={[{ label: 'Funded', color: 'var(--source)' }, { label: 'Logged in ≤ 90 days', color: 'var(--drift)' }]} />}>
          {!ov ? <Skeleton className="h-[230px]" /> : (
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ov.byType.map((r) => ({ ...r, label: TYPE_SHORT[r.type] ?? r.type }))} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barGap={3}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} ticks={[0, 5000, 10000, 15000, 20000, 25000]} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.03)' }} />
                  <Bar name="Funded" dataKey="funded" fill="var(--source)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar name="Logged in ≤ 90 days" dataKey="loggedIn" fill="var(--drift)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Domain semantic views" sub="Each domain keeps its own view; the orchestrator composes them" right={<PoweredBy>Horizon tags</PoweredBy>}>
          {!ov ? <Loading rows={5} /> : (
            <ul className="space-y-2">
              {ov.domains.map((d) => (
                <li key={d.view} className="panel-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[12.5px] font-medium">{d.view}</span>
                    <StatusPill status={d.status} />
                  </div>
                  <div className="text-[11.5px] muted mt-1 tabular">{d.label} · {d.terms} glossary terms · {fmt(d.rows)} rows</div>
                </li>
              ))}
              <li><Link href="/composer" className="btn w-full justify-center mt-1">Ask across domains<ArrowRight className="w-4 h-4" aria-hidden /></Link></li>
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
