// Browser-side access to ContextData. Sample mode (the hosted /try/ build, no server connection,
// or the reader chose Sample) runs the bundled implementation in the browser. Live mode sends
// every call to /api/data on the server; a live failure surfaces as an error.
import type { ContextData } from './context-data';
import { HOSTED_EXAMPLE } from './hosted';
import { mockData } from './mock-data';
import { preferSample } from './mode';

let live: Promise<boolean> | null = null;
export function isLive(): Promise<boolean> {
  if (HOSTED_EXAMPLE || preferSample()) return Promise.resolve(false);
  live ??= fetch('/api/mode').then((r) => r.json()).then((j) => j.mode === 'live').catch(() => false);
  return live;
}

async function remote<T>(op: keyof ContextData, args: string[]): Promise<T> {
  const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const data = new Proxy({} as ContextData, {
  get: (_t, op: keyof ContextData) => async (...args: string[]) =>
    (await isLive()) ? remote(op, args) : (mockData[op] as (...a: string[]) => Promise<unknown>)(...args),
});
