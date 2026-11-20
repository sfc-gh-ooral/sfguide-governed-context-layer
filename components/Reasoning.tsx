'use client';

// Staged progress for AI calls. The steps name what the live path actually does. In Sample mode they
// advance over the scripted delay; in Live mode they advance on the same timer and the last one holds
// until the real answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = keyof typeof SAMPLE_DELAY_MS;

const STEPS: Record<ReasoningKind, string[]> = {
  ask: [
    'Agent A and Agent B answer from their own prompts with AI_COMPLETE',
    'Governed agents A and B run as Cortex Agents',
    'Cortex Analyst queries ACCOUNTS_SV; Cortex Search reads approved procedures',
    'Comparing each pair of answers with an AI_COMPLETE judge',
  ],
  mine: ['Reading the wiki page', 'Extracting the term and its definition with AI_EXTRACT'],
  explain: ['Collecting every candidate definition for the term', 'Explaining the differences with AI_COMPLETE', 'Saving the explanation to CONFLICTS'],
  approve: [
    'Recording the decision in CONTEXT.DECISIONS',
    'Updating the glossary and marking the other page superseded',
    'Rebuilding ACCOUNTS_SV from the approved glossary',
    'Refreshing Cortex Search and the CONTEXT_STATUS tag',
  ],
  compose: [
    'Planning with the orchestrator Cortex Agent',
    'Routing each part to a domain semantic view',
    'Generating SQL with Cortex Analyst per domain',
    'Combining the domain answers',
  ],
  eval: ['Reading the 6-question bank', 'Asking every question of all four agents', 'Judging agreement with AI_COMPLETE', 'Writing results to EVAL_RESULTS'],
};

export function Reasoning({ kind }: { kind: ReasoningKind }) {
  const steps = STEPS[kind];
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, [kind]);
  const per = SAMPLE_DELAY_MS[kind] / steps.length;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / per));
  return (
    <div className="panel-2 p-4" role="status" aria-live="polite" style={{ borderColor: 'rgba(94,208,232,.35)' }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--source)' }}>
          <span className="w-2 h-2 rounded-full pulse-ring" style={{ background: 'var(--source)' }} aria-hidden />Working
        </div>
        <span className="text-[11px] muted tabular mono">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className="flex items-start gap-2.5 text-[12.5px]" style={{ color: state === 'todo' ? 'var(--muted)' : 'var(--text)' }}>
              {state === 'done' ? <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accord)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--source)' }} aria-hidden />
                : <span className="w-4 h-4 shrink-0 rounded-full border" style={{ borderColor: 'var(--line)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="h-1 rounded-full mt-4 overflow-hidden" style={{ background: 'var(--surface-3)' }} aria-hidden>
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%`, background: 'linear-gradient(90deg, var(--source), var(--accord))' }} />
      </div>
    </div>
  );
}
