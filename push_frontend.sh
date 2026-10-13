#!/bin/sh
# Push the public front end (export_frontend.py) into the Lovable project through its GitHub repo.
#   ./push_frontend.sh git@github.com:<owner>/<repo>.git ["commit message"]
# Uses the deploy key ~/.ssh/wsa_lovable_deploy (added to the repo with write access).
# Lovable syncs the default branch: the push shows up in the editor and preview. Nothing goes live until Publish.
set -eu
REPO="${1:?usage: ./push_frontend.sh git@github.com:owner/repo.git [message]}"
MSG="${2:-Import the Wall Street Alpha front end}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/wsa-frontend-push"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/wsa_lovable_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

python3 "$HERE/export_frontend.py" >/dev/null
rm -rf "$WORK"
git clone --quiet "$REPO" "$WORK"
cd "$WORK"
git config user.name "Rudra Manda"
git config user.email "lolubroke@gmail.com"
rsync -a --exclude .DS_Store "$HERE/handoff/frontend/" "$WORK/"

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed."
  exit 0
fi
git commit --quiet -m "$MSG" -m "Exported by wsa-platform/export_frontend.py." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push --quiet origin HEAD
echo "Pushed $(git rev-parse --short HEAD) to $REPO"
