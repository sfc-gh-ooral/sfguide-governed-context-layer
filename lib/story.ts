// The five story beats shown in the story rail. Each is marked when the reader does it, in the
// browser only, so the walkthrough works the same in Sample and Live mode.
export const BEATS = [
  { id: 'disagree', label: 'Disagree', hint: 'Ask both agents the same question', href: '/ask' },
  { id: 'surface', label: 'Surface', hint: 'See the conflicting definitions', href: '/resolver' },
  { id: 'approve', label: 'Approve', hint: 'The owner picks one definition', href: '/resolver' },
  { id: 'agree', label: 'Agree', hint: 'Ask again: governed agents match', href: '/ask' },
  { id: 'monitor', label: 'Monitor', hint: 'Run the nightly consistency eval', href: '/monitor' },
] as const;
export type Beat = (typeof BEATS)[number]['id'];
const KEY = 'gcl-beats';
const EVT = 'gcl-beats';

export function beats(): Beat[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function markBeat(b: Beat) {
  const cur = beats();
  if (cur.includes(b)) return;
  window.localStorage.setItem(KEY, JSON.stringify([...cur, b]));
  window.dispatchEvent(new Event(EVT));
}
export function resetBeats() { window.localStorage.removeItem(KEY); }
export function onBeats(fn: () => void) {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
