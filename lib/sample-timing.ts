// Sample-mode response time per AI surface, in ms (plus up to 0.6 s jitter). Live calls measured
// 4–20 s for one question and about 3.5 minutes for a full eval; these are shorter but long enough
// that the staged progress reads like a real interaction.
export const SAMPLE_DELAY_MS = { ask: 7200, mine: 4200, explain: 4800, approve: 5200, compose: 6800, eval: 8000 } as const;
