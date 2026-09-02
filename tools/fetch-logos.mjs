#!/usr/bin/env node
// Fetches every beer's official logo once, so the site stops asking for it on
// every page load.
//
// The runtime chain asks a third party for a logo each time a card renders,
// and answers only as well as that service is having a day. When Brandfetch
// started refusing the embedded client ID, all 97 beers without a local file
// dropped silently to Google's 16px default favicon and the site rendered a
// hundred grey globes. Nothing in the repo had changed; nothing in the repo
// could have prevented it.
//
// So the logo becomes a file we hold. This walks a ladder of sources per
// brand, prefers the brand's own site over any aggregator — a site's declared
// icon is the brand saying what its mark is, an aggregator's answer is a guess
// about it — takes the largest real image it finds, and writes it into
// public/stats/logos/. The remote chain stays exactly where it is, as the
// fallback it always was.
//
//     node tools/fetch-logos.mjs                 # everything with no file yet
//     node tools/fetch-logos.mjs --force         # re-fetch even what we have
//     node tools/fetch-logos.mjs --only "Grolsch,Duvel"
//
// Needs open internet and Playwright's Chromium (which re-encodes what comes
// back). The Fetch logos workflow runs it on a runner and commits the result;
// logo-fetch-report.json records where every logo came from, so a wrong one
// can be traced back to the source that gave it.
import { mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadData } from './load-data.mjs';
import { imageSize } from './probe-logo-sources.mjs';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const onlyArg = args.indexOf('--only');
const ONLY = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',').map(s => s.trim())) : null;

const LOGO_DIR = join(ROOT, 'logos');
const REPORT = join(ROOT, '..', '..', 'logo-fetch-report.json');

// A raster this small is a favicon, not a logo: the generic globe the services
// answer with for a domain they don't know is 16px, and anything under this is
// too coarse to draw at 2× on a card. The audit's own "suspect" line is 32px —
// this sits above it deliberately, so what we commit clears the bar we check.
const MIN_PX = 48;
// What we store. Larger than anywhere the site draws a logo (48px at 2× is 96),
// small enough that a hundred of them are a rounding error in the repo.
const OUT_PX = 256;

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url, { timeout = 20000, accept = 'image/*,*/*' } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow',
      headers: { 'user-agent': UA, accept } });
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()),
             type: (res.headers.get('content-type') || '').split(';')[0].trim(),
             url: res.url };
  } catch { return null; }
  finally { clearTimeout(t); }
}

// ── the brand's own site ──────────────────────────────────────
// Read the icons the site declares, largest first. `mask-icon` is skipped on
// purpose: Safari's pinned-tab icon is a monochrome silhouette by definition,
// which is a worse logo than a colour favicon half its size.
function iconsFromHtml(html, base) {
  const out = [];
  const abs = href => { try { return new URL(href, base).href; } catch { return null; } };
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    if (!/(^|\s)(apple-touch-icon|apple-touch-icon-precomposed|icon|shortcut icon)(\s|$)/.test(rel)) continue;
    if (/mask-icon/.test(rel)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const u = href && abs(href);
    if (!u) continue;
    const sizes = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const declared = /\.svg(\?|$)/i.test(u) || /svg/i.test(tag.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || '')
      ? 512 : (parseInt(sizes, 10) || 0);
    out.push({ url: u, hint: declared, why: `site rel="${rel.trim()}"` });
  }
  out.sort((a, b) => b.hint - a.hint);

  // og:image last: it is as often a hero photograph as a logo, and a photo of
  // a bottle in a 24px table cell is worse than the favicon it displaced.
  const og = html.match(/<meta[^>]+(?:property|name)\s*=\s*["']og:image["'][^>]*>/i)?.[0];
  const ogHref = og?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
  if (ogHref && abs(ogHref)) out.push({ url: abs(ogHref), hint: 0, why: 'site og:image', last: true });
  return out;
}

const siteCache = new Map();
async function siteCandidates(domain) {
  if (siteCache.has(domain)) return siteCache.get(domain);
  let found = [];
  for (const base of [`https://${domain}/`, `https://www.${domain}/`]) {
    const page = await get(base, { accept: 'text/html,application/xhtml+xml,*/*' });
    if (page && /html/i.test(page.type)) {
      found = iconsFromHtml(page.buf.toString('utf8'), page.url);
      if (found.length) break;
    }
  }
  if (!found.length)
    found = ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png', 'favicon.svg']
      .map(p => ({ url: `https://${domain}/${p}`, hint: 0, why: `site /${p}` }));
  siteCache.set(domain, found);
  return found;
}

// The aggregators, in the order they proved useful when probed. Brandfetch is
// absent on purpose: it answers 403 to the public client ID this project used,
// for every URL shape and every domain. Google's `sz` is 256 and not 512 for
// the same kind of reason — 512 is not a size it serves, and asking for one it
// does not serve gets the 16px default back.
const AGGREGATORS = [
  { why: 'google faviconV2', url: d => `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${d}&size=256` },
  { why: 'icon.horse',       url: d => `https://icon.horse/icon/${d}` },
  { why: 'duckduckgo',       url: d => `https://icons.duckduckgo.com/ip3/${d}.ico` },
];

async function candidatesFor(domain) {
  const site = await siteCandidates(domain);
  return [
    ...site.filter(s => !s.last),
    ...AGGREGATORS.map(a => ({ url: a.url(domain), why: a.why })),
    ...site.filter(s => s.last),
  ];
}

const EXT = { svg: '.svg', png: '.png', jpg: '.jpg', webp: '.webp', gif: '.gif', ico: '.ico' };

function measure(buf, type) {
  if (!buf || buf.length < 64) return null;
  if (/text\/html/i.test(type || '')) return null;
  const s = imageSize(buf);
  if (!s || !s.fmt || s.fmt === '?') return null;
  if (s.fmt !== 'svg' && Math.max(s.w, s.h) < MIN_PX) return null;
  return s;
}

// Vector wins outright — it is the mark itself rather than a rendering of it.
// Among rasters the biggest wins, and a tie goes to whoever was asked first,
// which is how the ladder's ordering turns into a preference.
const scoreOf = s => (s.fmt === 'svg' ? 100000 : Math.max(s.w, s.h));

export const slug = name => name.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/ß/g, 'ss').replace(/['’]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function findLogo(name, domains) {
  const tried = [];
  let best = null;
  for (const d of domains) {
    for (const cand of await candidatesFor(d)) {
      const got = await get(cand.url);
      const size = got && measure(got.buf, got.type);
      tried.push(`${cand.why} · ${d} · ${size ? `${size.w}×${size.h} ${size.fmt}` : 'no'}`);
      if (!size) continue;
      const score = scoreOf(size);
      if (!best || score > best.score)
        best = { score, buf: got.buf, size, source: cand.why, domain: d, url: cand.url };
      if (score >= 100000) break;                       // vector: nothing beats it
    }
    if (best && best.score >= 180) break;               // already better than we draw
  }
  return best ? { name, ...best, tried } : { name, buf: null, tried };
}

// ── main ──────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { beers, WANT_TO_TRY, BRAND_DOMAINS } = loadData();
  const names = [...new Set([...beers.map(b => b.beer), ...WANT_TO_TRY.map(w => w.beer)])].sort();

  mkdirSync(LOGO_DIR, { recursive: true });
  const onDisk = new Set(readdirSync(LOGO_DIR));
  const fileFor = n => [...Object.values(EXT)].map(e => slug(n) + e).find(f => onDisk.has(f));

  const work = names.filter(n => (!ONLY || ONLY.has(n)) && (FORCE || !fileFor(n)));
  console.log(`${names.length} beers · ${names.filter(fileFor).length} already have a file · fetching ${work.length}\n`);

  const found = [], missing = [];
  const queue = [...work];
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const r = await findLogo(name, [].concat(BRAND_DOMAINS[name] ?? []));
      if (r.buf) { found.push(r); console.log(`  ✓ ${name} — ${r.source} (${r.domain}) ${r.size.w}×${r.size.h} ${r.size.fmt}`); }
      else { missing.push(r); console.log(`  ✗ ${name} — nothing usable`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // ── normalise ───────────────────────────────────────────────
  // SVG is written through untouched. A raster is redrawn onto a transparent
  // OUT_PX square — contained, never cropped — and re-encoded as WebP, so a
  // hundred logos are one predictable format at one predictable size. Chromium
  // does the decoding, which is what lets an .ico or an animated .gif land the
  // same way as a .png.
  const rasters = found.filter(r => r.size.fmt !== 'svg');
  if (rasters.length) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch(
      process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage();
    for (const r of rasters) {
      const mime = r.size.fmt === 'ico' ? 'image/x-icon' : `image/${r.size.fmt}`;
      const out = await page.evaluate(async ({ dataUrl, OUT_PX }) => {
        const img = new Image();
        const ok = await new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); img.src = dataUrl; });
        if (!ok || !img.naturalWidth) return null;
        const c = document.createElement('canvas');
        c.width = c.height = OUT_PX;
        const ctx = c.getContext('2d');
        const scale = Math.min(OUT_PX / img.naturalWidth, OUT_PX / img.naturalHeight, 1);
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (OUT_PX - w) / 2, (OUT_PX - h) / 2, w, h);
        return c.toDataURL('image/webp', 0.92);
      }, { dataUrl: `data:${mime};base64,${r.buf.toString('base64')}`, OUT_PX });
      if (out) { r.buf = Buffer.from(out.split(',')[1], 'base64'); r.ext = '.webp'; }
      else r.ext = EXT[r.size.fmt] ?? '.png';
    }
    await browser.close();
  }

  for (const r of found) {
    const ext = r.size.fmt === 'svg' ? '.svg' : (r.ext ?? '.webp');
    // A re-fetch that lands in a different format must not leave the old file
    // behind for the data to keep pointing at.
    for (const e of Object.values(EXT))
      if (e !== ext && onDisk.has(slug(r.name) + e)) unlinkSync(join(LOGO_DIR, slug(r.name) + e));
    r.file = `logos/${slug(r.name)}${ext}`;
    writeFileSync(join(ROOT, r.file), r.buf);
  }

  writeFileSync(REPORT, JSON.stringify({
    at: new Date().toISOString(),
    total: names.length,
    fetched: found.map(r => ({ beer: r.name, file: r.file, source: r.source, domain: r.domain,
                               url: r.url, size: `${r.size.w}×${r.size.h}`, bytes: r.buf.length })),
    missing: missing.map(r => ({ beer: r.name, tried: r.tried })),
  }, null, 2));

  console.log(`\n${found.length} written · ${missing.length} still missing`);
  for (const m of missing) console.log(`  ✗ ${m.beer}\n      ${m.tried.join('\n      ')}`);
}
