#!/usr/bin/env node
// Renders every file in public/stats/logos/ onto one contact sheet, so the
// hundred logos can be *looked at* rather than trusted.
//
// Nothing else in the repo can tell a brand's mark from a photograph of a
// bottle, or from the grey globe a favicon service answers with for a domain
// it does not know. Both load, both are the right size, and both pass every
// check there is. A person looking at a sheet spots either in a second.
//
//     node tools/logo-sheet.mjs            # writes logo-sheet.png
//     node tools/logo-sheet.mjs --out x.png
//
// The tiles are half light, half dark: a white wordmark on a white tile is
// invisible, and so is a black one on black, and both are logos that will
// look broken on exactly one of the two surfaces this project renders.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './load-data.mjs';
import { imageSize } from './probe-logo-sources.mjs';

const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? process.argv[outArg + 1] : join(ROOT, '..', '..', 'logo-sheet.png');

const LOGO_DIR = join(ROOT, 'logos');
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
               '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon' };

const files = readdirSync(LOGO_DIR).filter(f => MIME[f.slice(f.lastIndexOf('.'))]).sort();
const tiles = files.map(f => {
  const ext = f.slice(f.lastIndexOf('.'));
  const buf = readFileSync(join(LOGO_DIR, f));
  const s = imageSize(buf);
  // The caption carries the resolution as well as the name: a logo can be the
  // right mark and still be a 48px one, and that is not visible at tile size.
  const px = ext === '.svg' ? 'vector' : `${s?.w ?? '?'}×${s?.h ?? '?'}`;
  return { name: f.slice(0, -ext.length), px, kb: Math.round(buf.length / 1024),
           src: `data:${MIME[ext]};base64,${buf.toString('base64')}` };
});
const small = tiles.filter(t => t.px !== 'vector' && +t.px.split('×')[0] < 512);


const COLS = 8;
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#f4f4f5;font:12px/1.3 system-ui,sans-serif;color:#3f3f46}
  .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:10px;padding:12px}
  figure{margin:0;text-align:center}
  .swatch{display:flex;height:104px;border:1px solid #d4d4d8;border-radius:8px;overflow:hidden}
  .swatch>div{flex:1;display:flex;align-items:center;justify-content:center}
  .lt{background:#ffffff}.dk{background:#17171a}
  img{max-width:74px;max-height:74px;object-fit:contain}
  figcaption{margin-top:4px;word-break:break-word}
  .px{display:block;color:#a1a1aa}
</style><div class="grid">${tiles.map(t => `
  <figure>
    <div class="swatch">
      <div class="lt"><img src="${t.src}" alt=""></div>
      <div class="dk"><img src="${t.src}" alt=""></div>
    </div>
    <figcaption>${t.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
      <span class="px">${t.px} · ${t.kb}KB</span></figcaption>
  </figure>`).join('')}</div>`;

const { chromium } = await import('playwright');
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(500);
writeFileSync(OUT, await page.screenshot({ fullPage: true }));

// The sheet answers "is this the brand's mark?", which only a person can. This
// answers the two questions underneath it that a person reading a light sheet
// will miss, and that no other check here can see at all: does the file draw
// anything, and does what it draws survive the ground the site actually paints
// it on. Both have shipped: a WebP with every pixel transparent (renders
// nothing, forever, and decodes cleanly so no fallback is ever tried), and
// marks drawn for a light label that measure 0% readable on --bg.
const ground = await page.evaluate(async (tiles) => {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d', { willReadFrequently: true });
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const BG = [15, 15, 17], BGL = lum(...BG);        // --bg #0f0f11
  const out = [];
  for (const t of tiles) {
    const img = new Image();
    const ok = await new Promise(r => { img.onload = () => r(true); img.onerror = () => r(false); img.src = t.src; });
    if (!ok) { out.push({ name: t.name, why: 'will not decode' }); continue; }
    x.clearRect(0, 0, 96, 96);
    const s = Math.min(96 / img.naturalWidth, 96 / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    x.drawImage(img, (96 - w) / 2, (96 - h) / 2, w, h);
    const d = x.getImageData(0, 0, 96, 96).data;
    let drawn = 0, readable = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255; if (a < 0.15) continue; drawn++;
      const L = lum(d[i] * a + BG[0] * (1 - a), d[i + 1] * a + BG[1] * (1 - a), d[i + 2] * a + BG[2] * (1 - a));
      if ((Math.max(L, BGL) + .05) / (Math.min(L, BGL) + .05) > 1.6) readable++;
    }
    if (drawn < 92) out.push({ name: t.name, why: 'draws nothing — every pixel transparent' });
    else if (readable / 9216 < 0.02) out.push({ name: t.name, why: `invisible on --bg (${(readable / 9216 * 100).toFixed(1)}% readable)` });
  }
  return out;
}, tiles);
await browser.close();

console.log(`${tiles.length} logos → ${OUT}`);
console.log(`${tiles.filter(t => t.px === 'vector').length} vector · ` +
  `${tiles.length - tiles.filter(t => t.px === 'vector').length} raster · ` +
  `${small.length} under 512px${small.length ? `: ${small.map(t => `${t.name} (${t.px})`).join(', ')}` : ''}`);
if (ground.length) {
  console.log(`\n${ground.length} render nothing a reader can see:`);
  for (const g of ground) console.log(`  ✗ ${g.name} — ${g.why}`);
  console.log('A mark drawn for a light label needs the white tile logos/README.md describes.');
} else {
  console.log('Every logo draws, and every one of them reads on the site\'s ground.');
}
process.exitCode = ground.length ? 1 : 0;
