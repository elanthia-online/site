# elanthia.online

Source for [elanthia.online](https://elanthia.online/), the home page of the Elanthia Online
project: open-source tools, scripts and front ends for GemStone IV and DragonRealms.

The site is plain, hand-written HTML and CSS with no build step and no JavaScript. What's in
[`public/`](public/) is exactly what gets published.

## Layout

| Path                                                                      | What it is                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/index.html`                                                       | The home page.                                                                                                                                    |
| `public/404.html`                                                         | The "page not found" page. GitHub Pages serves it for any missing URL, at any depth, so it links assets with root-absolute paths (`/assets/...`). |
| `public/assets/css/site.css`                                              | All styles. Colours are tokens at the top of the file.                                                                                            |
| `public/assets/img/`, `public/favicon.ico`, `public/apple-touch-icon.png` | Logo, icons and the social preview image. These files are generated, so don't edit them by hand (see below).                                      |
| `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`      | Crawler rules, sitemap and web app manifest.                                                                                                      |
| `src/lich-logo.webp`                                                      | The source logo that all images are generated from.                                                                                               |
| `scripts/`                                                                | Image generation and the test scripts.                                                                                                            |
| `.github/workflows/pages.yml`                                             | CI checks and the GitHub Pages deploy.                                                                                                            |

## Working on the site

Edit the files in `public/` directly. To preview the site locally:

```bash
npm install
npm run serve
```

Then open <http://127.0.0.1:8080/>. Any static file server works too, for example
`python3 -m http.server -d public`. The npm one also serves `404.html` for missing pages,
the way GitHub Pages does.

### Tests

```bash
npx playwright install chromium   # once
npm test
```

`npm test` runs three checks, and CI runs the same three on every pull request:

- **`test:html`** validates the HTML with [html-validate](https://html-validate.org/), using its
  recommended and accessibility rule sets.
- **`test:contrast`** reads the colour tokens from `site.css` and checks every text, link, button,
  focus-ring and border pair against WCAG AA, in both light and dark mode.
- **`test:browser`** loads each page in Chromium and runs these checks:
  - [axe-core](https://github.com/dequelabs/axe-core) against WCAG 2.2 AA and best practice.
  - No console errors, Content Security Policy violations or failed requests.
  - No horizontal scrolling at 320 px wide or with text at 200%.
  - Forced colours and reduced motion still work.
  - Keyboard tab order and focus rings.
  - The 404 page works at a nested path.

  Pass a directory to save screenshots: `node scripts/test-browser.mjs screenshots`.

CI also checks every link once a week with [lychee](https://github.com/lycheeverse/lychee).
That job reports dead links but doesn't block merging, because outside sites go down for reasons
this repo can't fix.

### Changing the logo or icons

Replace `src/lich-logo.webp` (a square-ish image with a transparent background works best),
then regenerate every image:

```bash
npm run images
```

This needs ImageMagick with WebP and AVIF support (`magick -list format | grep -E 'AVIF|WEBP'`).
The script trims and centres the logo, then writes all of these:

- The hero logo at 1x and 2x, as AVIF and WebP.
- The favicon at 16, 32 and 48 px.
- A 180 px Apple touch icon on a solid background, because iOS fills transparency with black.
- 192 and 512 px manifest icons, plus a maskable icon.
- The 1200x630 social preview image.

### Design and accessibility rules

- **Colour schemes.** Light and dark follow the visitor's system setting, using `color-scheme`
  and `light-dark()` tokens. If you change a colour, run `npm run test:contrast`.
- **Text sizes.** All text uses `rem`, and the root font size is never set, so browser and OS text
  scaling work (`<meta name="text-scale">`). Fluid sizes use `clamp()`, with a maximum no larger
  than 2.5 times the minimum.
- **Motion.** The page only moves for visitors with no reduced-motion preference.
- **Project cards.**
  - Each card is an `<article>` whose heading link is stretched over the whole card. Keep one
    link per card.
  - The list keeps `role="list"`, because Safari drops list semantics from a `list-style: none`
    list.
- **Content Security Policy.** Each page sets `default-src 'none'` in a `<meta>` tag and only
  allows same-origin styles, images and the manifest. The site has no scripts, inline styles,
  web fonts or third-party requests. Keep it that way, or update the policy in both pages.

## Deployment

Every push to `master` runs the checks, then publishes `public/` to GitHub Pages
(`.github/workflows/pages.yml`). The `github-pages` environment only accepts deploys from
`master`. Pull requests run the checks without deploying.

The custom domain is set in **Settings → Pages** (not with a `CNAME` file, which this kind of
workflow deploy doesn't use), and HTTPS is enforced there. `elanthia.online` is a verified
domain for the organisation, so no other repository can claim it.

### DNS

DNS for `elanthia.online` is hosted on Cloudflare, in DNS-only mode (grey cloud):

- The apex resolves to GitHub Pages' addresses (`185.199.108.153` through `185.199.111.153`).
  It's either a CNAME to `elanthia-online.github.io` that Cloudflare flattens, or those four A
  records.
- `www` is a CNAME to the apex, and GitHub redirects it to `https://elanthia.online/`.

GitHub issues and renews the TLS certificate itself. If the records are ever switched to
Cloudflare's proxy (orange cloud), set Cloudflare's SSL mode to **Full (strict)** to avoid a
redirect loop. Certificate renewals can also fail while the proxy is on.

GitHub Pages can't set HTTP response headers, which is why the security policy lives in
`<meta>` tags. Headers that only work as real HTTP headers, such as `frame-ancestors` and HSTS,
would need the Cloudflare proxy.

## Other Elanthia Online sites

These live in their own repositories, not here:

| Site                                                                               | Repository                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [shops.elanthia.online](https://shops.elanthia.online/)                            | [bodega](https://github.com/elanthia-online/bodega)                   |
| [analytics.elanthia.online](https://analytics.elanthia.online/)                    | [analytics](https://github.com/elanthia-online/analytics)             |
| [forums.archives.elanthia.online](https://forums.archives.elanthia.online/topics/) | [forums.archives](https://github.com/elanthia-online/forums.archives) |
| [Lich 5 API docs](https://elanthia-online.github.io/lich-5-docs/)                  | [lich-5-docs](https://github.com/elanthia-online/lich-5-docs)         |
