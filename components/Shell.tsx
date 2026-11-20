'use client';

// Veritome app shell: solid top bar (logo, sections, persona, Sample/Live), a story rail of the five
// beats, the hosted-example notice, and the disclaimer footer. No sidebar by design (docs/DESIGN.md).
import { Check, Menu, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { resetSample } from '@/lib/mock-data';
import { preferSample } from '@/lib/mode';
import { BEATS, type Beat, beats, onBeats, resetBeats } from '@/lib/story';
import { ModeChip } from './ModeChip';
import { LogoMark } from './ui';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/ask', label: 'Side by side' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/resolver', label: 'Resolver' },
  { href: '/composer', label: 'Composer' },
  { href: '/monitor', label: 'Monitor' },
];
const REPO = 'https://github.com/sfc-gh-ooral/sfguide-governed-context-layer';

function StoryRail() {
  const [done, setDone] = useState<Beat[]>([]);
  useEffect(() => { setDone(beats()); return onBeats(() => setDone(beats())); }, []);
  const next = BEATS.find((b) => !done.includes(b.id));
  return (
    <div className="border-b" style={{ borderColor: 'var(--line)', background: 'rgba(18,22,28,.7)' }}>
      <div className="max-w-[1360px] mx-auto px-4 md:px-6 py-2.5 flex items-center gap-3">
        <span className="eyebrow shrink-0 hidden sm:inline">Story</span>
        <ol className="relative flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1" aria-label="Story progress">
          {BEATS.map((b, i) => {
            const isDone = done.includes(b.id);
            const isNext = next?.id === b.id;
            return (
              <li key={b.id} className="flex items-center gap-1.5 shrink-0">
                <Link href={b.href} title={b.hint}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-semibold border transition-colors"
                  style={isDone ? { background: 'var(--accord-soft)', borderColor: 'rgba(200,242,90,.35)', color: 'var(--accord)' }
                    : isNext ? { background: 'var(--surface-2)', borderColor: 'var(--text-2)', color: 'var(--text)' }
                    : { borderColor: 'var(--line)', color: 'var(--muted)' }}>
                  <span className="w-5 h-5 rounded-full grid place-items-center text-[10.5px]"
                    style={isDone ? { background: 'var(--accord)', color: '#0b0e12' } : { background: 'var(--surface-3)', color: 'var(--text-2)' }}>
                    {isDone ? <Check className="w-3 h-3" aria-hidden /> : i + 1}
                  </span>
                  {b.label}
                  <span className="sr-only">{isDone ? ' (done)' : isNext ? ' (next)' : ''}</span>
                </Link>
                {i < BEATS.length - 1 && <span className="w-4 h-px" style={{ background: isDone ? 'var(--accord)' : 'var(--line)' }} aria-hidden />}
              </li>
            );
          })}
        </ol>
        {next && <span className="hidden lg:block text-xs muted shrink-0">Next: {next.hint}</span>}
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sample, setSample] = useState(true);
  useEffect(() => {
    if (HOSTED_EXAMPLE || preferSample()) return;
    fetch('/api/mode').then((r) => r.json()).then((j) => setSample(j.mode !== 'live')).catch(() => setSample(true));
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const reset = () => { if (sample) resetSample(); resetBeats(); window.location.reload(); };

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] btn">Skip to content</a>
      {HOSTED_EXAMPLE && (
        <div role="note" className="text-xs px-4 py-2 text-center border-b" style={{ background: 'var(--sample-soft)', borderColor: 'var(--line)', color: 'var(--text-2)' }}>
          <strong style={{ color: 'var(--sample)' }}>Hosted example, Sample mode.</strong> Runs in your browser on synthetic data; AI answers are captured samples, not live Cortex output.{' '}
          <a href={`${REPO}#live-mode-deploy-to-your-account`} className="underline underline-offset-2" style={{ color: 'var(--text)' }}>Run it live in your account</a>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}>
        <div className="max-w-[1360px] mx-auto h-14 px-3 md:px-6 flex items-center gap-2 md:gap-3">
          <button className="lg:hidden btn !px-2 !py-1.5" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu className="w-4 h-4" /></button>
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Veritome home">
            <LogoMark />
            <span className="leading-tight">
              <span className="block font-semibold tracking-[-0.02em] text-[15px]">Veritome</span>
              <span className="hidden sm:block text-[10.5px] muted -mt-0.5">Context ledger · Northwind Financial</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-0.5 ml-4 min-w-0" aria-label="Sections">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}
                className="relative px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: active(n.href) ? 'var(--text)' : 'var(--text-2)' }}>
                {n.label}
                {active(n.href) && <span className="absolute left-3 right-3 -bottom-[9px] h-[2px] rounded-full" style={{ background: 'var(--accord)' }} aria-hidden />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-ghost !px-2 !py-1.5 hidden sm:inline-flex" onClick={reset} title="Clear approvals, eval runs and story progress in this browser">
              <RotateCcw className="w-3.5 h-3.5" aria-hidden /><span className="hidden 2xl:inline text-xs">Reset story</span>
            </button>
            <div className="hidden xl:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }} title="Signed-in persona (fictional)">
              <span className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: 'var(--source-soft)', color: 'var(--source)' }}>PN</span>
              <span className="leading-tight">
                <span className="block text-xs font-semibold">Priya Natarajan</span>
                <span className="block text-[10.5px] muted">Data product owner</span>
              </span>
            </div>
            <ModeChip />
          </div>
        </div>
      </header>
      <StoryRail />

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu" className="absolute left-0 top-0 h-full w-[84%] max-w-xs p-4 border-r drawer-in"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between mb-5">
              <span className="flex items-center gap-2 font-semibold"><LogoMark size={24} />Veritome</span>
              <button className="btn !px-2 !py-1.5" onClick={() => setOpen(false)} aria-label="Close menu"><X className="w-4 h-4" /></button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Sections">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined} className="px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={active(n.href) ? { background: 'var(--accord-soft)', color: 'var(--accord)' } : { color: 'var(--text-2)' }}>{n.label}</Link>
              ))}
            </nav>
            <div className="mt-5 pt-4 border-t text-xs muted" style={{ borderColor: 'var(--line)' }}>
              Signed in as <strong className="text-2">Priya Natarajan</strong>, data product owner (fictional).
              <button className="btn w-full mt-3 justify-center" onClick={reset}><RotateCcw className="w-3.5 h-3.5" aria-hidden />Reset story</button>
            </div>
          </div>
        </div>
      )}

      <main id="main" key={pathname} className="flex-1 w-full max-w-[1360px] mx-auto px-4 md:px-6 py-6 md:py-8 min-w-0">{children}</main>
      <footer className="border-t" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-[1360px] mx-auto px-4 md:px-6 py-4 text-[11.5px] muted flex flex-col md:flex-row gap-2 justify-between">
          <span>Synthetic data and illustrative logic for a fictional firm. Not production, regulatory, or compliance advice. Not an official Snowflake product.</span>
          <a href={REPO} className="underline underline-offset-2">Source and live-mode guide</a>
        </div>
      </footer>
    </div>
  );
}
