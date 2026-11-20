// Checks WCAG contrast for the Veritome tokens in docs/DESIGN.md: text on every background,
// and each pill's text on its own tinted fill (tint = hue at the given opacity over --surface).
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
const T = { bg: '#0b0e12', surface: '#12161c', surface2: '#1a2029', surface3: '#222a35', text: '#e8edf2', text2: '#a9b4c2', muted: '#8592a3',
  accord: '#c8f25a', drift: '#ff7a5c', source: '#5ed0e8', draft: '#f5b841', sample: '#b9a4ff' };
let fail = 0;
const check = (name, fg, bg) => { const r = ratio(fg, bg); if (r < 4.5) fail++; console.log(`${r >= 4.5 ? 'pass' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${name}`); };
for (const bg of ['bg', 'surface', 'surface2', 'surface3'])
  for (const fg of ['text', 'text2', 'muted', 'accord', 'drift', 'source', 'draft', 'sample']) check(`${fg} on ${bg}`, hex(T[fg]), hex(T[bg]));
for (const [fg, a] of [['accord', 0.13], ['drift', 0.14], ['source', 0.13], ['draft', 0.14], ['sample', 0.14]])
  check(`${fg} pill`, hex(T[fg]), mix(hex(T[fg]), hex(T.surface2), a));
check('ink on accord button', hex(T.bg), hex(T.accord));
check('ink on sample switch', hex(T.bg), hex(T.sample));
process.exit(fail ? 1 : 0);
