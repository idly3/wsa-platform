#!/bin/sh
# Push this build into the Lovable project "Wall Street Alpha Core" (Rudra's Lovable) through its GitHub repo.
#   ./push_lovable.sh git@github.com:<owner>/<repo>.git ["commit message"]
# Uses the deploy key ~/.ssh/wsa_lovable_deploy (added to the repo with write access).
# Lovable syncs the default branch, so every push shows up in the editor and preview.
# Nothing goes live until someone clicks Publish in Lovable.
set -eu
REPO="${1:?usage: ./push_lovable.sh git@github.com:owner/repo.git [message]}"
MSG="${2:-Sync from the wsa-platform build}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/wsa-lovable-push"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/wsa_lovable_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

rm -rf "$WORK"
git clone --quiet "$REPO" "$WORK"
cd "$WORK"
git config user.name "Rudra Manda"
git config user.email "lolubroke@gmail.com"

python3 "$HERE/export_lovable.py" "$WORK"

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed."
  exit 0
fi
git commit --quiet -m "$MSG" -m "Exported by wsa-platform/export_lovable.py." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push --quiet origin HEAD
echo "Pushed $(git rev-parse --short HEAD) to $REPO"
