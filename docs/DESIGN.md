# Design: Veritome, the context ledger

This file sets the look and voice of the app and the landing page. Tokens here are the source of
truth for `app/globals.css` and `docs/assets/site.css`.

## Brand

- **Product:** Veritome, a fictional context-governance product used by the fictional broker-dealer
  Northwind Financial. "Veri" (true) + "tome" (book): one book of definitions every agent reads.
- **Logo mark:** two strokes that start apart and merge into one, inside a rounded square. It is the
  story of the pack in one shape: two agents, one answer.

```svg
<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
  <rect width="32" height="32" rx="9" fill="#C8F25A"/>
  <path d="M8 9c5 0 7 7 8 7M8 23c5 0 7-7 8-7h8" fill="none" stroke="#0B0E12" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="24" cy="16" r="2.6" fill="#0B0E12"/>
</svg>
```

- **Wordmark:** "Veritome" in Space Grotesk 600, letter-spacing -0.02em, followed by a muted
  "Context ledger".
- **Voice:** precise and calm, like a good data steward. Short sentences, concrete numbers, cites
  its sources. It says "approved definition" and "owner", never "magic". It names disagreement
  plainly ("These two agents gave different numbers") and never blames the agent builder.

## Audience

Data product owners (curate definitions), agent builders (reuse them), and business users (want one
answer). The default persona chip is "Priya Natarajan · Data product owner, Account Operations".

## Design direction: "control room after dark"

Dark-first, high-contrast operations console. The UI is built around one idea: **disagreement is
coral, agreement is lime.** Every screen uses that pair, so a first-time viewer learns it in seconds.

### Palette

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#0B0E12` | Page background (graphite night) |
| `--surface` | `#12161C` | Cards, panels |
| `--surface-2` | `#1A2029` | Inputs, table header, nested panels |
| `--surface-3` | `#222A35` | Hover rows, pressed |
| `--line` | `#263040` | Borders, gridlines |
| `--text` | `#E8EDF2` | Primary text |
| `--text-2` | `#A9B4C2` | Secondary text |
| `--muted` | `#8592A3` | Captions, axis labels |
| `--accord` | `#C8F25A` | Governed, agreement, approved, primary action |
| `--accord-ink` | `#0B0E12` | Text on lime |
| `--drift` | `#FF7A5C` | Ungoverned, disagreement, conflict |
| `--source` | `#5ED0E8` | Citations, sources, AI activity |
| `--draft` | `#F5B841` | Draft / missing status |
| `--sample` | `#B9A4FF` | "Sample AI response" label and Sample badge |

Tinted fills are the same hue at 12–16% opacity on `--surface`. Contrast was checked with
`scripts/check-contrast.mjs`: every text token is at least 4.5:1 on `--bg`, `--surface` and
`--surface-2`, and every pill's text is at least 4.5:1 on its own tinted fill.

### Typography

- **Space Grotesk** (400/500/600/700) for UI and display. Headlines are tight (-0.02em) and large;
  KPI values use tabular figures.
- **JetBrains Mono** (400/500) for terms, metric names, semantic-view expressions, page IDs and SQL.
  Monospace marks "this is a governed object" throughout.
- Both self-hosted with `next/font` in the app; the landing page reuses the same woff2 files from
  `docs/fonts/` (SIL Open Font License, included).

### Layout model

- **Top navigation, no sidebar.** A 56 px solid top bar holds the logo, six sections, the persona
  chip and the Sample/Live switch with an environment badge.
- Under it, a **story rail**: five numbered beats (Disagree → Surface → Approve → Agree → Monitor)
  that light up lime as the reader completes them. It doubles as the walkthrough.
- Content sits in a 12-column grid, max 1360 px. At 390 px the nav becomes a menu sheet, the rail
  scrolls inside itself, and every grid collapses to one column. No page scrolls sideways.
- Detail opens in a **right-side drawer** (term detail, eval question detail), full-screen on phones.

### Density

Medium-dense, built for operators: 13–14 px body, 12 px table text, 11 px uppercase labels with
0.08em tracking. Cards have 16–20 px padding and 14 px radius.

### Charts

Recharts with thin 2 px lines, lime for governed and coral for ungoverned, dotted `--line`
gridlines, no chart borders, a dark tooltip with a colored key, and a legend above the chart. Bars
are rounded 4 px. Seeded history is drawn dashed so it is never mistaken for a real run.

### Motion

- Page sections fade up 8 px over 260 ms, staggered by 40 ms.
- KPI values count up over 700 ms when they first appear.
- Skeleton loaders shimmer at 1.4 s.
- AI answers stream in word by word (about 18 ms per word) after the staged reasoning finishes.
- The composer draws routing edges from the orchestrator to each domain that answered.
- All motion respects `prefers-reduced-motion`.

## Landing page identity

`docs/index.html` uses the same graphite and lime. The hero is a typographic split: "120,402"
in coral and "98,115" in coral on two lines that converge into one lime line reading "One governed
answer." No device mockup, no gradient blob, no serif. Screenshots sit in dark framed panels with
a numbered caption strip.

## How this differs from the live catalog

I looked at the landing pages and Try apps of Auto Finance Portfolio Analytics (Odometer), Workforce
Intelligence, Loss Triangle Suite, Wealth Advisor Assistant, Credit Risk Model Studio, KYC Onboarding
Workbench, Cross-Border FX and Cyber Risk Copilot, and I know the Tallyward rebuild (pack 05) is ink,
paper and red. What this design avoids:

| Pack | Their look | Veritome instead |
| --- | --- | --- |
| Auto Finance (Odometer) | Dark green left sidebar, green gradient hero banner, serif + italic green hero | No sidebar, no hero banner, no serif |
| Workforce Intelligence | Purple sidebar, pastel KPI blobs, serif headline with purple accent | Graphite + lime/coral, flat tiles, grotesk |
| Loss Triangle Suite | Dark navy with magenta sidebar highlight | Top nav, lime accent, no magenta |
| Wealth Advisor Assistant | Light UI, blue sidebar, blue "morning brief" banner | Dark-first, no banner |
| Credit Risk Model Studio | Light grey, serif headings, top tabs on white | Dark, story rail, mono for governed objects |
| KYC Workbench | Blue full-bleed gradient hero, centered text | Left-aligned typographic split hero |
| Cross-Border FX, Cyber Risk Copilot | White document-style landing, blue buttons | Dark landing, lime buttons |
| Tallyward (05, in progress) | Ink, paper and red, audit-workpaper | No paper texture, no red, no ruled lines |

No other pack uses a lime/coral pair, a top-nav-plus-story-rail layout, or a split-number hero.
