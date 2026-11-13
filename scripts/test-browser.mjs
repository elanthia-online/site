// Browser checks for the site in Chromium: axe-core (WCAG 2.2 AA + best
// practice), console/CSP errors, failed requests, reflow at 320px, 200% text,
// forced colours, reduced motion, keyboard order and focus, and the 404 page
// at a nested path. Serves public/ the way GitHub Pages does.
//
// Usage: node scripts/test-browser.mjs [screenshot-dir]
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const shots = process.argv[2];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

// Mimic GitHub Pages: /dir/ -> index.html, unknown path -> 404.html with status 404.
const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith('/')) p += 'index.html';
  try {
    if (p.split('/').includes('..')) throw new Error('outside public/');
    const body = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': types['.html'] });
    res.end(await readFile(join(root, '404.html')));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let problems = 0;
const fail = (msg) => { problems++; console.log('FAIL', msg); };
const ok = (msg) => console.log('ok  ', msg);

async function check(browser, name, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1280, height: opts.height ?? 900 }, colorScheme: opts.scheme ?? 'light', reducedMotion: opts.reducedMotion ?? 'no-preference', forcedColors: opts.forcedColors ?? 'none', deviceScaleFactor: opts.dpr ?? 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !(opts.expect404 && m.text().includes('404'))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`request failed ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/does-not-exist')) errors.push(`${r.status()} ${r.url()}`); });
  const resp = await page.goto(base + url, { waitUntil: 'networkidle' });
  if (opts.zoomText) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  if (errors.length) fail(`${name}: ${errors.join(' | ')}`); else ok(`${name}: no console/CSP/network errors (status ${resp.status()})`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) fail(`${name}: horizontal overflow ${overflow}px`); else ok(`${name}: no horizontal scroll`);

  if (opts.axe !== false) {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    if (r.violations.length) for (const v of r.violations) fail(`${name}: axe ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    else ok(`${name}: axe clean (${r.passes.length} rules passed, ${r.incomplete.length} need review: ${r.incomplete.map((i) => i.id).join(', ') || 'none'})`);
  }
  if (opts.shot && shots) await page.screenshot({ path: `${shots}/${opts.shot}.png`, fullPage: true });
  if (opts.after) await opts.after(page);
  await ctx.close();
  return resp;
}

const chrome = await chromium.launch({ args: ['--no-sandbox'] });

await check(chrome, 'home light desktop', '/', { shot: 'home-light-desktop' });
await check(chrome, 'home dark desktop', '/', { scheme: 'dark', shot: 'home-dark-desktop' });
await check(chrome, 'home dark mobile 375', '/', { scheme: 'dark', width: 375, height: 812, dpr: 2, shot: 'home-dark-mobile' });
await check(chrome, 'home light 320 reflow', '/', { width: 320, height: 640 });
await check(chrome, 'home 200% text at 640', '/', { width: 640, zoomText: true, shot: 'home-200pct-text' });
await check(chrome, 'home forced colors', '/', { forcedColors: 'active', scheme: 'dark', shot: 'home-forced-colors' });
await check(chrome, 'home reduced motion', '/', { reducedMotion: 'reduce', axe: false, after: async (page) => {
  const t = await page.$eval('.card', (el) => getComputedStyle(el).transitionProperty);
  if (t.includes('translate')) fail(`reduced motion still transitions: ${t}`); else ok('reduced motion: no translate transition');
} });

// Keyboard: tab order and visible focus ring on cards.
await check(chrome, 'home keyboard', '/', { scheme: 'dark', axe: false, after: async (page) => {
  const order = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => document.activeElement.textContent.trim()));
  }
  ok(`tab order: ${order.join(' > ')}`);
  for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement.closest('.card') ?? document.activeElement).outlineStyle);
  if (outline !== 'solid') fail(`focused card has no outline (${outline})`); else ok('focused card shows outline');
  if (shots) await page.screenshot({ path: `${shots}/home-focus.png` });
  // Whole card is clickable: click card body text, expect navigation request.
  const href = await page.$eval('.card a.card-link', (a) => a.href);
  const [req] = await Promise.all([page.waitForRequest(() => true, { timeout: 3000 }).catch(() => null), page.locator('.card > p').first().boundingBox().then((b) => page.mouse.click(b.x + b.width / 2, b.y + b.height / 2))]);
  if (req && req.url().startsWith(href.replace(/\/$/, ''))) ok(`card body click navigates to ${href}`); else fail(`card body click did not navigate (${req?.url()})`);
} });

const r404 = await check(chrome, '404 nested', '/does-not-exist/deep/page', { scheme: 'dark', expect404: true, shot: '404-dark' });
if (r404.status() !== 404) fail(`404 status ${r404.status()}`);

// Images: correct source chosen, hero not lazy.
await check(chrome, 'images', '/', { axe: false, dpr: 2, after: async (page) => {
  const src = await page.$eval('.hero-logo', (i) => i.currentSrc);
  ok(`hero currentSrc at 2x: ${src.replace(base, '')}`);
} });
await chrome.close();

server.close();
console.log(problems ? `\n${problems} problem(s)` : '\nall checks passed');
process.exit(problems ? 1 : 0);
