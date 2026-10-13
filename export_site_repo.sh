#!/bin/sh
# Build a complete, push-ready Git repo of the public site: Lovable's TanStack Start starter (scaffold/)
# plus the front end (export_frontend.py). It runs a full build to check it and regenerate the route tree,
# then commits. Re-running adds a new commit on top of the existing history.
#   ./export_site_repo.sh [out_dir]          (default: ../wsa-site-export, and ../wsa-site-export.zip)
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/../wsa-site-export}"
NODE_MODULES="$HERE/../wsa-lovable/node_modules"

python3 "$HERE/export_frontend.py" >/dev/null

if [ -d "$OUT/.git" ]; then
  find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  rm -rf "$OUT"
  mkdir -p "$OUT"
  git -C "$OUT" init -q -b main
fi
rsync -a "$HERE/scaffold/" "$OUT/"
rsync -a --exclude .DS_Store "$HERE/handoff/frontend/" "$OUT/"
cp "$HERE/site-repo-README.md" "$OUT/README.md"

# build once: proves it compiles and writes src/routeTree.gen.ts (the router's generated route list)
if [ -d "$NODE_MODULES" ]; then
  ln -s "$NODE_MODULES" "$OUT/node_modules"
  trap 'rm -f "$OUT/node_modules"; rm -rf "$OUT/.output" "$OUT/.tanstack" "$OUT/.wrangler" "$OUT/.nitro" "$OUT/dist"' EXIT
  (cd "$OUT" && npx --no-install vite build >/dev/null 2>&1 && npx --no-install tsc --noEmit)
  rm -f "$OUT/node_modules"
  rm -rf "$OUT/.output" "$OUT/.tanstack" "$OUT/.wrangler" "$OUT/.nitro" "$OUT/dist"
fi

cd "$OUT"
git config user.name "Rudra Manda"
git config user.email "lolubroke@gmail.com"
git add -A
if git diff --cached --quiet; then
  echo "No changes since the last export."
else
  git commit -q -m "Wall Street Alpha front end" -m "Exported by wsa-platform/export_site_repo.sh." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi
cd ..
rm -f "$(basename "$OUT").zip"
zip -qr "$(basename "$OUT").zip" "$(basename "$OUT")" -x "*/.git/*"
echo "$OUT ($(git -C "$OUT" rev-parse --short HEAD), $(git -C "$OUT" ls-files | wc -l | tr -d ' ') files) and $(pwd)/$(basename "$OUT").zip"
