#!/usr/bin/env node
// Opens the real app in a real browser and checks it still works: every route
// renders its heading with no uncaught errors, the beers list, the insight
// panels and the passport's badges, stamps and bingo card fill in, a committed
// logo loads from /logos/, a map pin's popup stays open after the click that opened it,
// and the old /stats address lands on Insights.
//
// It starts `vite dev` itself — the production build targets Cloudflare
// Workers, which nothing here can run — and drives Chromium against it.
//
//     npm run smoke
//
// CHROMIUM_PATH for an environment that has a browser but not the one
// Playwright expects to find (the session hook sets it in agent containers).
import { spawn } from "node:child_process";
import { createServer } from "node:net";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("\nplaywright is not installed — run `npm install`.\n");
  process.exit(1);
}

// A free port, so a dev server already running on the default one is no
// obstacle and never the thing being tested.
const port = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;

const vite = spawn(
  "npx",
  ["vite", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], detached: true },
);
let viteLog = "";
vite.stdout.on("data", (d) => (viteLog += d));
vite.stderr.on("data", (d) => (viteLog += d));
const stopVite = () => {
  try {
    process.kill(-vite.pid);
  } catch {}
};
process.on("exit", stopVite);

// Ready when the home page answers, not when the log says so.
const deadline = Date.now() + 60000;
for (;;) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  if (Date.now() > deadline) {
    console.error(`\nvite dev never answered on ${base}.\n${viteLog}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];

// Logos, fonts and map tiles are decoration: the page is expected to render
// without them, so failures there are not the test's business.
const NOISE = /Failed to load resource|ERR_FAILED|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|net::/;
page.on("console", (m) => {
  if (m.type() === "error" && !NOISE.test(m.text())) errors.push(`${page.url()}: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`${page.url()}: uncaught ${e.message}`));

let pass = true;
const check = async (label, fn) => {
  let ok = false,
    note = "";
  try {
    const v = await fn();
    ok = !!v;
    note = v && v !== true ? ` — ${v}` : "";
  } catch (e) {
    note = ` — ${e.message.split("\n")[0]}`;
  }
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${note}`);
  pass = ok && pass;
};

// Not `networkidle`: logos and map tiles keep the network busy, or hang when
// they're blocked. A route is ready once its heading has hydrated.
const visit = async (path, heading) => {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1", { hasText: heading }).first().waitFor({ timeout: 30000 });
};

await check("home", async () => {
  await visit("/", "JWAL BREW REVIEW");
  return true;
});

await check("beers list", async () => {
  await visit("/beers", "All beers");
  await page.locator("main ul > li").first().waitFor({ timeout: 15000 });
  const rows = await page.locator("main ul > li").count();
  return rows > 0 && `${rows} reviews`;
});

// Every logo is a committed file served from /logos/. A move that left the
// URLs pointing somewhere else would fall through to favicons silently.
await check("logos load from /logos/", async () => {
  const img = page.locator('main img[src^="/logos/"]').first();
  await img.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('main img[src^="/logos/"]');
      return el && el.complete && el.naturalWidth > 0;
    },
    null,
    { timeout: 10000 },
  );
  return await img.getAttribute("src");
});

await check("insights", async () => {
  await visit("/insights", "Insights");
  await page.locator("main section h2").first().waitFor({ timeout: 15000 });
  const panels = await page.locator("main section h2").count();
  return panels > 3 && `${panels} panels`;
});

await check("insights tabs", async () => {
  for (const tab of ["Taste", "Places", "Next"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(150);
  }
  return "taste · places · next";
});

// The Passport: badges computed from the log, stamps per brewing country,
// and the twelve-square bingo card. Each tab has to render real content, not
// just its heading.
await check("passport badges", async () => {
  await visit("/passport", "Passport");
  const panel = page.locator("main section", { hasText: "Badges" }).last();
  await panel.locator("li").first().waitFor({ timeout: 15000 });
  const cards = await panel.locator("li").count();
  const earned = await panel.getByText(/^Earned/).count();
  return cards >= 10 && earned > 0 && `${earned} of ${cards} earned`;
});

await check("passport stamps and bingo", async () => {
  await page.getByRole("tab", { name: "Stamps" }).click();
  const stamps = page.locator("main section", { hasText: "Brewed in" }).locator("li");
  await stamps.first().waitFor({ timeout: 5000 });
  const n = await stamps.count();
  await page.getByRole("tab", { name: "Bingo" }).click();
  const cells = page.locator("main table tbody td");
  await cells.first().waitFor({ timeout: 5000 });
  const c = await cells.count();
  return n > 0 && c === 12 && `${n} stamps · ${c} bingo squares`;
});

await check("home links to the passport", async () => {
  await visit("/", "JWAL BREW REVIEW");
  const strip = page.locator('main a[href="/passport"]');
  await strip.waitFor({ timeout: 15000 });
  return /streak/.test(await strip.innerText()) && "streak strip";
});

await check("add a beer", async () => {
  await visit("/add", "Add a beer");
  return true;
});

// The Map Rule: a click opens the popup, and must not redraw the pins and
// close it again. Proved by looking, which is what the invariant can't do.
await check("map pin popup stays open", async () => {
  await visit("/map", "Beer map");
  const pins = page.locator(".leaflet-marker-icon");
  await pins.first().waitFor({ timeout: 15000 });
  const count = await pins.count();
  await pins.nth(Math.floor(count / 2)).click({ force: true });
  await page.locator(".leaflet-popup").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  const open = await page.locator(".leaflet-popup").count();
  return open === 1 && `${count} pins, popup still open`;
});

await check("/stats redirects to Insights", async () => {
  await page.goto(`${base}/stats`, { waitUntil: "domcontentloaded" });
  await page.locator("h1", { hasText: "Insights" }).first().waitFor({ timeout: 30000 });
  return new URL(page.url()).pathname === "/insights" && "/stats → /insights";
});

await browser.close();
stopVite();

if (errors.length) console.log(`\n  console errors:\n    ${errors.join("\n    ")}`);
if (!pass || errors.length) {
  console.log("\nSmoke test failed.\n");
  process.exit(1);
}
console.log("\nSmoke test passed.\n");
process.exit(0);
