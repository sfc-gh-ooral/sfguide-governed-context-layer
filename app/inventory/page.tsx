'use client';

// Screen 2: the context inventory. Terms, metrics, owners, sources, status, and conflicts, plus
// the candidate definitions AI_EXTRACT mined from the wiki and the file-based BI import.
import { AlertTriangle, ArrowRight, FileText, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Card, Kpi, PoweredBy, SampleAiBadge, SourceBadge, StatusPill } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Candidate, Term } from '@/lib/types';

const STATUSES = ['all', 'conflict', 'missing', 'draft', 'approved'] as const;
const SOURCES = ['all', 'wiki', 'bi', 'inferred'] as const;

function TermDetail({ t, onClose }: { t: Term; onClose: () => void }) {
  return (
    <div className="card p-4 fade-up" role="region" aria-label={`Term ${t.term}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-xs muted">{t.id} · {t.domain} · {t.kind}</div>
          <h2 className="text-lg font-semibold">{t.term}</h2>
        </div>
        <button className="btn !px-2" onClick={onClose} aria-label="Close details"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-2 flex-wrap mb-3"><StatusPill status={t.status} /><span className="text-xs muted">Source: {t.source} ({t.sourceRef})</span></div>
      <p className="text-sm mb-3">{t.definition}</p>
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="muted">Owner</dt><dd>{t.owner}</dd>
        <dt className="muted">Synonyms</dt><dd>{t.synonyms.join(', ') || '—'}</dd>
        <dt className="muted">Semantic view</dt><dd>{t.svName ? <code>{t.svName} = {t.svExpression}</code> : 'Not a metric'}</dd>
        {t.approvedBy && <><dt className="muted">Approved</dt><dd>{t.approvedBy} · {t.approvedAt}{t.note ? ` · “${t.note}”` : ''}</dd></>}
      </dl>
      {(t.status === 'conflict' || t.status === 'missing') && (
        <Link href="/resolver" className="btn btn-primary mt-4 no-underline">Open in the conflict resolver<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
      )}
    </div>
  );
}

function MineRow({ c }: { c: Candidate }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ term: string; definition: string; source: string; latencyMs?: number }>();
  const [err, setErr] = useState<string>();
  const run = async () => {
    setBusy(true); setErr(undefined);
    try { setR(await data.mine(c.docId)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  return (
    <tr>
      <td className="whitespace-nowrap"><FileText className="w-3.5 h-3.5 inline mr-1 muted" aria-hidden />{c.docId}</td>
      <td><div className="font-medium">{c.title}</div><div className="text-xs muted">{c.owner} · updated {c.updated}</div></td>
      <td><StatusPill status={c.pageStatus} /></td>
      <td className="min-w-[260px]">
        {busy ? <Reasoning kind="mine" compact /> : err ? <span role="alert" style={{ color: 'var(--negative)' }}>Live call failed: {err}</span> : (
          <><strong>{(r ?? c).term}</strong>: {(r ?? c).definition}
            {r && <div className="mt-1 flex gap-2">{r.source === 'mock' ? <SampleAiBadge /> : <SourceBadge p={{ source: 'snowflake', latencyMs: r.latencyMs }} />}</div>}</>
        )}
      </td>
      <td><button className="btn btn-ai !py-1 text-xs" onClick={run} disabled={busy}><Sparkles className="w-3.5 h-3.5" aria-hidden />Re-extract</button></td>
    </tr>
  );
}

export default function Inventory() {
  const inv = useAsync(() => data.inventory(), []);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [source, setSource] = useState<(typeof SOURCES)[number]>('all');
  const [sel, setSel] = useState<string>();
  const terms = useMemo(() => (inv.data?.terms ?? []).filter((t) => (status === 'all' || t.status === status) && (source === 'all' || t.source === source)), [inv.data, status, source]);
  const t = inv.data?.terms ?? [];
  const selected = t.find((x) => x.id === sel);
  const count = (s: string) => t.filter((x) => x.status === s).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Context inventory</h1>
        <p className="text-sm text-2 mt-1 max-w-3xl">Every business term the agents rely on, who owns it, where it came from, and whether it is approved.
          Approved metrics compile into the domain semantic views; status and owner are also Horizon Catalog tags on each view.</p>
      </div>
      {inv.error && <div role="alert" className="card p-4 text-sm" style={{ color: 'var(--negative)' }}>Live call failed: {inv.error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Terms" value={inv.data ? String(t.length) : '…'} sub="Wiki, BI export, and inferred" />
        <Kpi label="Approved" value={inv.data ? String(count('approved')) : '…'} sub="Published to semantic views" />
        <Kpi label="Conflicts" value={inv.data ? String(count('conflict')) : '…'} sub="Two sources disagree" />
        <Kpi label="Gaps" value={inv.data ? String(count('missing') + count('draft')) : '…'} sub="Missing in a view, or draft" />
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start">
        <Card title="Glossary" right={<><PoweredBy>Semantic Views</PoweredBy><PoweredBy>Horizon Catalog tags</PoweredBy>{inv.data && <SourceBadge p={inv.data} />}</>}>
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <div className="seg flex" role="group" aria-label="Filter by status">
              {STATUSES.map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className="px-2.5 py-1">{s}</button>)}
            </div>
            <div className="seg flex" role="group" aria-label="Filter by source">
              {SOURCES.map((s) => <button key={s} aria-pressed={source === s} onClick={() => setSource(s)} className="px-2.5 py-1">{s}</button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Term</th><th>Domain</th><th>Owner</th><th>Source</th><th>Status</th></tr></thead>
              <tbody>
                {terms.map((x) => (
                  <tr key={x.id} className="click" onClick={() => setSel(x.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(x.id)} aria-selected={sel === x.id}>
                    <td><div className="font-medium">{x.term}</div><div className="text-xs muted">{x.kind}{x.svName ? ` · ${x.svName}` : ''}</div></td>
                    <td>{x.domain}</td><td className="text-xs">{x.owner}</td>
                    <td className="text-xs">{x.source}<div className="muted">{x.sourceRef}</div></td>
                    <td>{x.status === 'conflict' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" style={{ color: 'var(--negative)' }} aria-label="Conflict" />}<StatusPill status={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          {selected ? <TermDetail t={selected} onClose={() => setSel(undefined)} /> : (
            <div className="card p-4 text-sm muted">Select a term to see its definition, owner, synonyms, and how it compiles into a semantic view.</div>
          )}
          <Card title="Semantic views" right={<PoweredBy>Horizon Catalog tags</PoweredBy>}>
            <ul className="space-y-2 text-sm">
              {Object.entries(inv.data?.svStatus ?? {}).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-2"><code>{k}</code><span className="flex items-center gap-1 text-xs muted">CONTEXT_STATUS <StatusPill status={v} /></span></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="BI model import (file-based)" right={<span className="text-xs muted">data/bi-model-export.json</span>}>
        <p className="text-xs muted mb-2">Metric definitions from a BI tool export, compared with ACCOUNTS_SV. Third-party catalogs could be sources too; this example imports a file only.</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>BI metric</th><th>Expression</th><th>Owner</th><th>In semantic view</th></tr></thead>
            <tbody>
              {(inv.data?.bi ?? []).map((m) => (
                <tr key={m.name}><td><div className="font-medium">{m.label}</div><code className="text-xs">{m.name}</code></td>
                  <td className="text-xs"><code>{m.expression}</code></td><td className="text-xs">{m.owner}</td>
                  <td>{m.inSemanticView ? <StatusPill status="approved" /> : ['open_service_requests', 'avg_resolution_days'].includes(m.name)
                    ? <span className="text-xs muted">In SERVICE_SV</span> : <StatusPill status="missing" />}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Candidate definitions mined from the wiki" right={<PoweredBy>AI_EXTRACT</PoweredBy>}>
        <p className="text-xs muted mb-2">30 synthetic wiki and procedure pages. AI_EXTRACT pulled one term and definition from each during setup; re-extract any page to run it again.</p>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="data-table">
            <thead><tr><th>Page</th><th>Title</th><th>Page status</th><th>Extracted term and definition</th><th /></tr></thead>
            <tbody>{(inv.data?.candidates ?? []).map((c) => <MineRow key={c.docId} c={c} />)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
