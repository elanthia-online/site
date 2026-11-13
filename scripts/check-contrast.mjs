#!/usr/bin/env node
// Check WCAG 2 contrast for every foreground/background pair the site uses,
// in both colour schemes. Colours are read from public/assets/css/site.css,
// so this fails if a token changes to something that no longer passes.
//
// Usage: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/assets/css/site.css', import.meta.url), 'utf8');

const raw = {};
for (const [, name, hex] of css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) raw[name] = hex;

// Resolve a token to [light, dark] hex values.
function token(name) {
  const m = css.match(new RegExp(`--${name}:\\s*light-dark\\(([^,]+),\\s*([^)]+\\)?)\\)\\s*;`));
  if (!m) throw new Error(`token --${name} is not a light-dark() pair`);
  return [m[1], m[2]].map((v) => {
    v = v.trim();
    const ref = v.match(/^var\(--([\w-]+)\)$/);
    if (ref) return raw[ref[1]];
    if (v === '#fff') return '#ffffff';
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    throw new Error(`cannot resolve ${v} in --${name}`);
  });
}

function luminance(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, what it is]
const pairs = [
  ['text', 'bg', 4.5, 'body text'],
  ['text', 'surface', 4.5, 'card text'],
  ['text-muted', 'bg', 4.5, 'tagline and footer'],
  ['text-muted', 'surface', 4.5, 'card game label'],
  ['link', 'bg', 4.5, 'links'],
  ['link', 'surface', 4.5, 'card titles'],
  ['button-text', 'button-bg', 4.5, 'button label'],
  ['focus', 'bg', 3, 'focus ring'],
  ['focus', 'surface', 3, 'focus ring on card'],
  ['border', 'bg', 3, 'card border'],
];

let failed = false;
for (const [fg, bg, min, label] of pairs) {
  const f = token(fg);
  const b = token(bg);
  ['light', 'dark'].forEach((scheme, i) => {
    const r = ratio(f[i], b[i]);
    const ok = r >= min;
    if (!ok) failed = true;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${scheme.padEnd(5)}  ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${label}: --${fg} ${f[i]} on --${bg} ${b[i]}`);
  });
}
process.exit(failed ? 1 : 0);
