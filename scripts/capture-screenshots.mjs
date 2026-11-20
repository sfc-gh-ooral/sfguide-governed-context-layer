// Captures the landing-page screenshots and catalog card images from the hosted example.
//
//   npm run build:example        # refresh docs/try/ first if the UI changed
//   npm run capture              # writes docs/images/*.png and docs/catalog/*.jpg
//
// Runs headless Chromium at a fixed viewport, so image size never depends on your screen
// or editor window. It uses a fresh browser with no sign-in: only synthetic sample data
// can appear in the images. Review every image before publishing anyway.

import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");
const BASE = "/sfguide-governed-context-layer/try"; // must match basePath in next.config.ts
const CARD_ID = "governed-context-layer";           // catalog id: cards are <id>-<n>.jpg

const VIEWPORT = { width: 1600, height: 1000 };       // 16:10, same shape as catalog cards
const PAGE_SCALE = 1.25;                              // 2000x1250 PNGs: sharp, and under the guide's 500 KB
const CARD_SCALE = 0.6;                               // 1600x1000 CSS px -> 960x600 card
const SCHEME = process.env.COLOR_SCHEME || "dark";   // "dark" or "light"

// The walkthrough, in landing-page order. `card` marks which shots become catalog cards (in that order).
// Every shot starts from a fresh browser (no approvals); `act` plays the story up to that point.
async function approveAll(page, origin) {
  for (const id of ["K1", "K2", "K3"]) {
    await page.goto(`${origin}/resolver/?c=${id}`);
    await page.getByRole("radiogroup", { name: "Choose a definition" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: /^Approve / }).click();
    await page.getByText("Written back").waitFor({ timeout: 30000 });
  }
}
async function ask(page, origin, qid) {
  await page.goto(`${origin}/ask/?q=${qid}`);
  await page.getByRole("button", { name: "Ask all four agents" }).click();
  await page.getByText("Judge", { exact: true }).waitFor({ timeout: 30000 });
}

const SHOTS = [
  { name: "01-overview", card: 1, path: "/", phone: true },
  { name: "02-disagree", card: 2, path: "/", async act(page, o) { await ask(page, o, "Q1"); } },
  { name: "03-resolver", card: 3, path: "/resolver/?c=K1", phone: true },
  {
    name: "04-inventory", card: 4, path: "/inventory/",
    async act(page) { await page.locator("tbody tr.clickable", { hasText: "active account" }).first().click(); await page.getByRole("dialog").waitFor(); },
  },
  { name: "05-agree", card: 5, path: "/", phone: true, async act(page, o) { await approveAll(page, o); await ask(page, o, "Q1"); } },
  {
    name: "06-composer", card: 6, path: "/composer/",
    async act(page) { await page.getByRole("button", { name: /^How many active accounts do we have, how many/ }).click(); await page.getByText("of 4 used").waitFor({ timeout: 30000 }); },
  },
  {
    name: "07-monitor", card: 7, path: "/", phone: true,
    async act(page, o) {
      await approveAll(page, o);
      await page.goto(`${o}/monitor/`);
      await page.getByRole("button", { name: "Run consistency eval" }).click();
      await page.locator("tbody tr.clickable").first().waitFor({ timeout: 30000 });
    },
  },
  { name: "08-overview-after", path: "/", async act(page, o) { await approveAll(page, o); await page.goto(`${o}/`); } },
];
const PHONE = { width: 390, height: 844 };

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

// Serves docs/try/ at the GitHub Pages path, the way the hosted example is published.
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DOCS, "try", decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(join(DOCS, "try"))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Let entrance animations finish so every run produces the same frame.
  await page.waitForTimeout(800);
}

async function main() {
  if (!existsSync(join(DOCS, "try", "index.html"))) throw new Error("docs/try/ is missing. Run `npm run build:example` first.");
  mkdirSync(join(DOCS, "images"), { recursive: true });
  mkdirSync(join(DOCS, "catalog"), { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const outs = [[VIEWPORT, PAGE_SCALE, join(DOCS, "images", `${shot.name}.png`)]];
      if (shot.card) outs.push([VIEWPORT, CARD_SCALE, join(DOCS, "catalog", `${CARD_ID}-${shot.card}.jpg`)]);
      if (shot.phone) outs.push([PHONE, 2, join(DOCS, "images", `${shot.name}-phone.png`)]);
      for (const [viewport, scale, out] of outs) {
        const context = await browser.newContext({
          viewport, deviceScaleFactor: scale, colorScheme: SCHEME, reducedMotion: "reduce",
          // Fixed locale and time zone so dates render the same on every machine.
          locale: "en-US", timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        await page.goto(origin + shot.path);
        await settle(page);
        if (shot.act) { await shot.act(page, origin); await settle(page); }
        await page.screenshot({ path: out, ...(out.endsWith(".jpg") ? { type: "jpeg", quality: 80 } : {}) });
        await context.close();
        console.log(`${out.replace(ROOT + "/", "")}  ${Math.round(statSync(out).size / 1024)} KB`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((failure) => { console.error(failure.message); process.exit(1); });
