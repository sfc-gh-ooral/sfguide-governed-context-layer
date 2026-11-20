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
async function approveAll(page) {
  await page.goto(page.url().replace(/\/try\/.*$/, "/try/resolver/"));
  const buttons = page.getByRole("button", { name: /^Approve/ });
  await buttons.first().waitFor();
  for (let n = await buttons.count(); n > 0; n--) {
    await buttons.first().click();
    await page.waitForFunction((left) => [...document.querySelectorAll("button")].filter((b) => /^Approve/.test(b.textContent ?? "")).length < left, n, { timeout: 30000 });
  }
}
async function ask(page, label) {
  await page.getByLabel("Question").selectOption({ label });
  await page.getByRole("button", { name: "Ask all four agents" }).click();
  await page.getByText("Governed agents A and B: shared context").waitFor({ timeout: 30000 });
}

// The walkthrough, in landing-page order. `card` marks which shots become catalog cards (in that order).
const SHOTS = [
  { name: "01-side-by-side", card: 1, path: "/", async act(page) { await ask(page, "How many active accounts do we have?"); } },
  {
    name: "02-inventory", card: 2, path: "/inventory/",
    async act(page) { await page.locator("tbody tr.click", { hasText: "active account" }).first().click(); },
  },
  { name: "03-resolver", card: 3, path: "/resolver/", wait: "text=What differs" },
  {
    name: "04-agreement", card: 4, path: "/",
    async act(page) {
      await approveAll(page);
      await page.goto(page.url().replace(/resolver\/$/, ""));
      await ask(page, "How do I change a client\u2019s address?");
    },
  },
  {
    name: "05-composer", card: 5, path: "/composer/",
    async act(page) {
      await page.getByRole("button", { name: /^How many active accounts do we have, how many/ }).click();
      await page.getByText("Domains used:").waitFor({ timeout: 30000 });
    },
  },
  {
    name: "06-monitor", card: 6, path: "/",
    async act(page) {
      await approveAll(page);
      await page.goto(page.url().replace(/resolver\/$/, "monitor/"));
      await page.getByRole("button", { name: "Run the eval now" }).click();
      await page.getByText("Judge note (governed)").waitFor({ timeout: 30000 });
    },
  },
];

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
      for (const [scale, out] of [
        [PAGE_SCALE, join(DOCS, "images", `${shot.name}.png`)],
        ...(shot.card ? [[CARD_SCALE, join(DOCS, "catalog", `${CARD_ID}-${shot.card}.jpg`)]] : []),
      ]) {
        const context = await browser.newContext({
          viewport: VIEWPORT, deviceScaleFactor: scale, colorScheme: SCHEME, reducedMotion: "reduce",
          // Fixed locale and time zone so dates render the same on every machine.
          locale: "en-US", timezoneId: "America/New_York",
        });
        const page = await context.newPage();
        await page.goto(origin + shot.path);
        if (shot.wait) await page.locator(shot.wait).first().waitFor();
        await settle(page);
        if (shot.act) { await shot.act(page); await settle(page); }
        await page.screenshot({ path: out, ...(out.endsWith(".jpg") ? { type: "jpeg", quality: 82 } : {}) });
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
