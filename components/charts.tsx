'use client';

// Dark tooltip and legend shared by every chart (docs/DESIGN.md: thin lines, dotted grid, colored key).
import type { ReactNode } from 'react';

export const AXIS = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = { stroke: 'var(--line)', strokeDasharray: '2 4', vertical: false } as const;

type Item = { name?: ReactNode; value?: unknown; color?: string; dataKey?: unknown };
export function ChartTip({ active, payload, label, unit = '' }: { active?: boolean; payload?: Item[]; label?: ReactNode; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-xl" style={{ background: '#0f1318', borderColor: 'var(--line)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 tabular">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span className="text-2">{p.name}</span>
          <span className="ml-auto pl-4 font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString('en-US') : String(p.value)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="w-4 h-0 border-t-2" style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }} aria-hidden />{i.label}
        </span>
      ))}
    </div>
  );
}
