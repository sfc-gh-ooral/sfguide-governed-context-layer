'use client';

import { ArrowDownUp, FileSearch, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Reasoning } from '@/components/Reasoning';
import { Drawer, Empty, ErrorBox, Loading, PageHead, Panel, PoweredBy, Provenance, StatusPill, StreamText } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Candidate, Term } from '@/lib/types';

const SRC: Record<Term['source'], string> = { wiki: 'pill-source', bi: 'pill-draft', inferred: 'pill-sample' };
type Tab = 'glossary' | 'wiki' | 'bi';
type SortKey = 'term' | 'domain' | 'status' | 'owner';
type Sort = { k: SortKey; dir: 1 | -1 };

function Th({ k, sort, setSort, children }: { k: SortKey; sort: Sort; setSort: (f: (s: Sort) => Sort) => void; children: string }) {
  return (
    <th aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>{children}<ArrowDownUp className="w-3 h-3" aria-hidden /></button>
    </th>
  );
}

function TermDrawer({ t, onClose }: { t?: Term; onClose: () => void }) {
  return (
    <Drawer open={!!t} onClose={onClose} title={t?.term ?? ''}>
      {t && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2"><StatusPill status={t.status} /><span className={`pill ${SRC[t.source]}`}>Source: {t.source}</span><span className="pill pill-quiet">{t.kind}</span><span className="pill pill-quiet">{t.domain}</span></div>
          <div><div className="eyebrow mb-1.5">Definition</div><p className="text-2 leading-relaxed">{t.definition}</p></div>
          {t.svName && (
            <div className="panel-2 p-3">
              <div className="eyebrow mb-2">In the semantic view</div>
              <div className="mono text-[12.5px]"><span style={{ color: 'var(--source)' }}>{t.domain.toUpperCase()}_SV</span>.{t.svName}</div>
              {t.svExpression && <div className="mono text-[12px] muted mt-1 break-words">{t.svExpression}</div>}
            </div>
          )}
          {t.synonyms.length > 0 && <div><div className="eyebrow mb-1.5">Synonyms</div><div className="flex flex-wrap gap-1.5">{t.synonyms.map((s) => <span key={s} className="pill pill-quiet mono">{s}</span>)}</div></div>}
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
            <dt className="muted">Owner</dt><dd>{t.owner}</dd>
            <dt className="muted">Source ref</dt><dd className="mono">{t.sourceRef}</dd>
            {t.approvedBy && <><dt className="muted">Approved</dt><dd>{t.approvedBy} · {t.approvedAt}</dd></>}
            {t.note && <><dt className="muted">Note</dt><dd>{t.note}</dd></>}
          </dl>
          {(t.status === 'conflict' || t.status === 'missing') && <Link href="/resolver" className="btn btn-primary w-full justify-center">Open in the conflict resolver</Link>}
        </div>
      )}
    </Drawer>
  );
}

function MineDrawer({ c, onClose }: { c?: Candidate; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ term: string; definition: string; source: 'mock' | 'snowflake'; latencyMs?: number }>();
  const [err, setErr] = useState<string>();
  const run = async () => {
    if (!c) return;
    setBusy(true); setErr(undefined); setR(undefined);
    try { setR(await data.mine(c.docId)); } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={!!c} onClose={() => { setR(undefined); setErr(undefined); onClose(); }} title={c ? `${c.docId} · ${c.title}` : ''}>
      {c && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><StatusPill status={c.pageStatus} /><span className="pill pill-quiet">Updated {c.updated}</span></div>
          <p className="text-2">Owner: {c.owner}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-primary" onClick={run} disabled={busy}><Sparkles className="w-4 h-4" aria-hidden />Extract the definition</button>
            <PoweredBy>AI_EXTRACT</PoweredBy>
          </div>
          {busy && <Reasoning kind="mine" />}
          {err && <ErrorBox error={err} />}
          {r && (
            <div className="panel-2 p-4" style={{ borderColor: 'rgba(94,208,232,.35)' }}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap"><span className="mono text-[13px] font-medium">{r.term}</span><Provenance p={r} /></div>
              <StreamText text={r.definition} />
              <p className="text-[11.5px] muted mt-3">Candidate only. Nothing is written to the glossary until an owner approves it.</p>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

export default function Inventory() {
  const inv = useAsync(() => data.inventory(), []);
  const [tab, setTab] = useState<Tab>('glossary');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'status', dir: 1 });
  const [term, setTerm] = useState<Term>();
  const [cand, setCand] = useState<Candidate>();

  const rank: Record<string, number> = { conflict: 0, missing: 1, draft: 2, approved: 3 };
  const terms = useMemo(() => {
    const t = (inv.data?.terms ?? []).filter((x) => (status === 'all' || x.status === status) &&
      (!q || `${x.term} ${x.definition} ${x.owner} ${x.synonyms.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
    return t.sort((a, b) => sort.dir * (sort.k === 'status' ? rank[a.status] - rank[b.status] || a.term.localeCompare(b.term) : String(a[sort.k]).localeCompare(String(b[sort.k]))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.data, q, status, sort]);
  const counts = (s: string) => (inv.data?.terms ?? []).filter((x) => s === 'all' || x.status === s).length;
  const cands = (inv.data?.candidates ?? []).filter((c) => !q || `${c.docId} ${c.title} ${c.term}`.toLowerCase().includes(q.toLowerCase()));
  const th = (k: SortKey, children: string) => <Th k={k} sort={sort} setSort={setSort}>{children}</Th>;

  return (
    <>
      <PageHead eyebrow="Context inventory" title="Every term, its owner, and where it came from."
        lede="Definitions mined from 30 wiki pages and a BI-model export, tracked from draft to approved. Approved metrics become semantic-view metrics; their status is a Horizon tag on the view."
        right={<><PoweredBy>Horizon tags</PoweredBy><Provenance p={inv.data} ai={false} /></>} />
      {inv.error && <div className="mb-4"><ErrorBox error={inv.error} /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {inv.data ? Object.entries(inv.data.svStatus).map(([sv, st]) => (
          <div key={sv} className="panel p-4 flex items-center justify-between gap-2 fade-up">
            <span className="min-w-0"><span className="block mono text-[13px] font-medium">{sv}</span><span className="block text-[11px] muted">tag CONTEXT_STATUS</span></span>
            <StatusPill status={st} />
          </div>
        )) : Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-[66px]" />)}
      </div>

      <Panel pad={false}>
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between px-4 pt-4 pb-3">
          <div className="flex gap-1 p-0.5 rounded-[10px] border w-max max-w-full overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }} role="tablist">
            {([['glossary', `Glossary (${inv.data?.terms.length ?? '…'})`], ['wiki', `Wiki pages (${inv.data?.candidates.length ?? '…'})`], ['bi', `BI model (${inv.data?.bi.length ?? '…'})`]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap"
                style={tab === k ? { background: 'var(--surface-3)', color: 'var(--text)' } : { color: 'var(--text-2)' }}>{l}</button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 muted" aria-hidden />
            <input className="input !pl-9" placeholder="Search terms, pages, owners" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </div>
        </div>

        {tab === 'glossary' && (
          <>
            <div className="flex flex-wrap gap-1.5 px-4 pb-3" role="radiogroup" aria-label="Filter by status">
              {['all', 'conflict', 'missing', 'draft', 'approved'].map((s) => (
                <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className="pill border"
                  style={status === s ? { background: 'var(--surface-3)', borderColor: 'var(--text-2)', color: 'var(--text)' } : { borderColor: 'var(--line)', color: 'var(--text-2)' }}>
                  {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)} <span className="tabular muted">{inv.data ? counts(s) : ''}</span>
                </button>
              ))}
            </div>
            {!inv.data ? <div className="p-4"><Loading rows={6} /></div> : terms.length === 0 ? <Empty icon={<Search className="w-5 h-5" />} title="No terms match">Clear the search or pick another status.</Empty> : (
              <div className="scroll-x">
                <table className="grid min-w-[760px]">
                  <thead><tr>{th('term', 'Term')}{th('domain', 'Domain')}<th>Semantic view</th><th>Source</th>{th('owner', 'Owner')}{th('status', 'Status')}</tr></thead>
                  <tbody>
                    {terms.map((t) => (
                      <tr key={t.id} className="clickable" onClick={() => setTerm(t)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setTerm(t)}>
                        <td><div className="font-semibold text-[13px]">{t.term}</div><div className="muted text-[11.5px] line-clamp-1 max-w-[320px]">{t.definition}</div></td>
                        <td className="text-2">{t.domain}</td>
                        <td className="mono text-[11.5px]">{t.svName ?? <span className="muted">—</span>}</td>
                        <td><span className={`pill ${SRC[t.source]}`}>{t.source}</span> <span className="mono text-[11px] muted">{t.sourceRef}</span></td>
                        <td className="text-2 text-[12px]">{t.owner.split(' (')[0]}</td>
                        <td><StatusPill status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'wiki' && (!inv.data ? <div className="p-4"><Loading rows={6} /></div> : (
          <div className="scroll-x">
            <table className="grid min-w-[720px]">
              <thead><tr><th>Page</th><th>Candidate term</th><th>Updated</th><th>Page status</th><th /></tr></thead>
              <tbody>
                {cands.map((c) => (
                  <tr key={c.docId} className="clickable" onClick={() => setCand(c)}>
                    <td><span className="mono text-[11px] muted mr-2">{c.docId}</span><span className="text-[13px]">{c.title}</span></td>
                    <td className="mono text-[12px]">{c.term}</td>
                    <td className="text-2 tabular">{c.updated}</td>
                    <td><StatusPill status={c.pageStatus} /></td>
                    <td className="text-right"><span className="pill pill-source"><FileSearch className="w-3 h-3" aria-hidden />Extract</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === 'bi' && (!inv.data ? <div className="p-4"><Loading rows={6} /></div> : (
          <div className="scroll-x">
            <table className="grid min-w-[680px]">
              <thead><tr><th>Metric</th><th>BI expression</th><th>Owner</th><th>In ACCOUNTS_SV / SERVICE_SV</th></tr></thead>
              <tbody>
                {inv.data.bi.map((m) => (
                  <tr key={m.name}>
                    <td><div className="mono text-[12.5px]">{m.name}</div><div className="muted text-[11.5px]">{m.label}</div></td>
                    <td className="mono text-[11.5px] text-2">{m.expression}</td>
                    <td className="text-2 text-[12px]">{m.owner.split(' (')[0]}</td>
                    <td>{m.inSemanticView ? <span className="pill pill-accord"><span className="dot" aria-hidden />In view</span> : <Link href="/resolver?c=K3" className="pill pill-draft"><span className="dot" aria-hidden />Missing · resolve</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11.5px] muted px-4 py-3">File-based import of a BI-model export (JSON). Third-party catalogs can be sources too; this example implements only the file import.</p>
          </div>
        ))}
      </Panel>

      <TermDrawer t={term} onClose={() => setTerm(undefined)} />
      <MineDrawer c={cand} onClose={() => setCand(undefined)} />
    </>
  );
}
