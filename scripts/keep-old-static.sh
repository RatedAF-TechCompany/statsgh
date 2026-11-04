#!/usr/bin/env bash
# Run after `opennextjs-cloudflare build`, before deploy. Keeps hashed /_next/static files from
# previous builds in the Workers assets upload so open tabs and cached HTML never hit 404 chunks.
# Files are content-hashed, so old and new never collide; nothing existing is overwritten.
set -euo pipefail
ARCHIVE="${STATIC_ARCHIVE:-/workspace/statsgh-static-archive}"
NEW=".open-next/assets/_next/static"
mkdir -p "$ARCHIVE"
cp -rn "$ARCHIVE"/. "$NEW"/ 2>/dev/null || true
cp -rn "$NEW"/. "$ARCHIVE"/
echo "static files in upload: $(find "$NEW" -type f | wc -l)"
