#!/usr/bin/env bash
# Regenerate every image under public/ from the source logo in src/.
#
# Needs ImageMagick 7 (`magick`) or 6 (`convert`) built with WebP and AVIF
# support. Check with: magick -list format | grep -E 'AVIF|WEBP'
#
# Usage: scripts/build-images.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/src/lich-logo.webp"
out="$root/public"
img="$out/assets/img"

if command -v magick >/dev/null 2>&1; then im=(magick); else im=(convert); fi

# PNG output: 8-bit palette, maximum compression. The logo is flat colour, so
# 256 colours is visually lossless and roughly a quarter of the size.
png=(-colors 256 -define png:compression-level=9 -define png:compression-filter=5)

# Brand colours (keep in sync with public/assets/css/site.css).
navy='#050d24'

mkdir -p "$img"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Trim the transparent margin, then pad to a square so every icon is centred.
"${im[@]}" "$src" -trim +repage -background none -gravity center \
  -extent '%[fx:max(w,h)]x%[fx:max(w,h)]' "$tmp/square.png"

# Hero logo: 1x and 2x, AVIF with WebP fallback.
for size in 320 640; do
  "${im[@]}" "$tmp/square.png" -resize "${size}x${size}" -strip -quality 60 "$img/lich-$size.avif"
  "${im[@]}" "$tmp/square.png" -resize "${size}x${size}" -strip -quality 82 -define webp:method=6 "$img/lich-$size.webp"
done

# Web app manifest icons (transparent).
for size in 192 512; do
  "${im[@]}" "$tmp/square.png" -resize "${size}x${size}" -strip "${png[@]}" "$img/icon-$size.png"
done

# Maskable icon: logo inside the 80% safe zone on a solid background.
"${im[@]}" "$tmp/square.png" -resize 400x400 -background "$navy" -gravity center \
  -extent 512x512 -strip "${png[@]}" "$img/icon-maskable-512.png"

# Apple touch icon: iOS fills transparency with black, so use a solid background.
"${im[@]}" "$tmp/square.png" -resize 150x150 -background "$navy" -gravity center \
  -extent 180x180 -strip "${png[@]}" "$out/apple-touch-icon.png"

# Favicon: 16, 32 and 48 px in one .ico.
"${im[@]}" "$tmp/square.png" -strip -define icon:auto-resize=48,32,16 "$out/favicon.ico"

# Social preview card (1200x630) for Open Graph / link unfurls.
"${im[@]}" -size 1200x630 "xc:$navy" \
  \( "$tmp/square.png" -resize 500x500 \) -gravity center -composite \
  -strip "${png[@]}" "$img/og-image.png"

echo "Images written to $out"
