'use client';

// Shared Veritome building blocks: panels, KPI tiles with count-up, status pills, capability badges,
// AI provenance labels, skeletons, a drawer, and a streaming markdown reveal.
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Sparkles, X, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Provenance } from '@/lib/types';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#C8F25A" />
      <path d="M8 9c5 0 7 7 8 7M8 23c5 0 7-7 8-7h8" fill="none" stroke="#0B0E12" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="16" r="2.6" fill="#0B0E12" />
    </svg>
  );
}

export function PageHead({ eyebrow, title, lede, right }: { eyebrow: string; title: ReactNode; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between mb-6 fade-up">
      <div className="min-w-0 max-w-3xl">
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="text-[26px] md:text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">{title}</h1>
        {lede && <p className="text-2 mt-2 text-[14.5px] leading-relaxed">{lede}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

export function Panel({ title, sub, right, children, className = '', pad = true, style }:
  { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean; style?: React.CSSProperties }) {
  return (
    <section className={`panel fade-up ${className}`} style={style}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
            {sub && <p className="text-xs muted mt-0.5">{sub}</p>}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

export function useCountUp(target: number | null | undefined, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

type Tone = 'accord' | 'drift' | 'source' | 'draft' | 'quiet';
export function Kpi({ label, value, suffix = '', note, tone = 'quiet', delta, icon }:
  { label: string; value: number | null | undefined; suffix?: string; note?: ReactNode; tone?: Tone; delta?: { v: number; good: boolean; text: string }; icon?: ReactNode }) {
  const n = useCountUp(value);
  const color = tone === 'quiet' ? 'var(--text)' : `var(--${tone})`;
  return (
    <div className="panel lift p-4 fade-up relative overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <span className="muted" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-2 text-[30px] font-semibold tabular tracking-[-0.02em]" style={{ color }}>
        {value == null ? <span className="skeleton inline-block w-20 h-8 align-middle" /> : `${Math.round(n).toLocaleString('en-US')}${suffix}`}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
        {delta && (
          <span className={`pill ${delta.good ? 'pill-accord' : 'pill-drift'}`}>
            {delta.v >= 0 ? <ArrowUpRight className="w-3 h-3" aria-hidden /> : <ArrowDownRight className="w-3 h-3" aria-hidden />}{delta.text}
          </span>
        )}
        {note && <span className="muted">{note}</span>}
      </div>
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: tone === 'quiet' ? 'var(--line)' : color }} aria-hidden />
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  approved: ['pill-accord', 'Approved'], conflict: ['pill-drift', 'Conflict'], missing: ['pill-draft', 'Missing in view'],
  draft: ['pill-draft', 'Draft'], superseded: ['pill-quiet', 'Superseded'], unknown: ['pill-quiet', 'Unknown'],
};
export function StatusPill({ status }: { status: string }) {
  const [cls, label] = STATUS[status] ?? ['pill-quiet', status];
  return <span className={`pill ${cls}`}><span className="dot" aria-hidden />{label}</span>;
}

export function AgreePill({ agree, label }: { agree: boolean; label?: string }) {
  return <span className={`pill ${agree ? 'pill-accord' : 'pill-drift'}`}><span className="dot" aria-hidden />{label ?? (agree ? 'Agree' : 'Disagree')}</span>;
}

/** Names the Snowflake capability behind a component. Only used for capabilities run in Live mode. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return <span className="pill pill-source"><Zap className="w-3 h-3" aria-hidden />Powered by {children}</span>;
}

/** Shows where an AI or data result came from: a labeled sample, or a live call with measured latency. */
export function Provenance({ p, ai = true }: { p?: Provenance; ai?: boolean }) {
  if (!p) return null;
  if (p.source === 'mock') return <span className="pill pill-sample"><Sparkles className="w-3 h-3" aria-hidden />{ai ? 'Sample AI response' : 'Sample data'}</span>;
  return <span className="pill pill-accord tabular"><span className="dot" aria-hidden />Live{p.latencyMs != null ? ` · ${(p.latencyMs / 1000).toFixed(1)} s` : ''}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-4/5' : 'w-full'}`} />)}
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div role="alert" className="panel-2 p-3 flex gap-2 items-start text-sm" style={{ borderColor: 'var(--drift)' }}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--drift)' }} aria-hidden />
      <div className="min-w-0 break-words"><strong>Live call failed.</strong> <span className="text-2">{error}</span></div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-11 h-11 rounded-xl grid place-items-center mb-3" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{icon}</div>
      <div className="font-semibold">{title}</div>
      {children && <div className="text-sm muted mt-1 max-w-sm mx-auto">{children}</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        className="absolute right-0 top-0 h-full w-full sm:w-[520px] overflow-y-auto border-l outline-none drawer-in"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <div className="font-semibold min-w-0 truncate">{title}</div>
          <button className="btn !px-2 !py-1.5" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function inline(s: string, key: number): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return <span key={key}>{parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
    : p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p)}</span>;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, '')); i++; }
      const L = ordered ? 'ol' : 'ul';
      out.push(<L key={k++}>{items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}</L>);
      continue;
    }
    if (/^\|/.test(l)) { // compact tables from agent output: render rows as lines
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|\s*-/.test(lines[i])) rows.push(lines[i]); i++; }
      out.push(<ul key={k++}>{rows.map((r, j) => <li key={j}>{inline(r.split('|').map((c) => c.trim()).filter(Boolean).join(' · '), j)}</li>)}</ul>);
      continue;
    }
    out.push(<p key={k++}>{inline(l.replace(/^#+\s/, ''), 0)}</p>);
    i++;
  }
  return <div className="prose-ai text-[13.5px] leading-relaxed text-2">{out}</div>;
}

/** Reveals text word by word, like a streaming model response. */
export function StreamText({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(words.length); onDone?.(); return; }
    const id = window.setInterval(() => setN((x) => {
      if (x + 2 >= words.length) { window.clearInterval(id); onDone?.(); return words.length; }
      return x + 2;
    }), speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const done = n >= words.length;
  return <div className={done ? '' : 'caret-wrap'}><Markdown text={words.slice(0, n).join('')} />{!done && <span className="caret" aria-hidden />}</div>;
}

export const fmt = (n: number) => n.toLocaleString('en-US');
