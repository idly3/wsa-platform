#!/bin/sh
# Rebuild and push the review site to https://withfulcrum.tech/<slug>/
# The withfulcrum.tech Caddy block already serves /var/www/fulcrum with
# try_files {path} {path}.html {path}/index.html, so no Caddy change is needed.
set -e
cd "$(dirname "$0")"
SLUG=$(cat data/slug.txt)
python3 build.py --base "/$SLUG/"
rsync -az --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  -e "ssh -o ConnectTimeout=10 -o BatchMode=yes" \
  dist/ "root@85.31.237.84:/var/www/fulcrum/$SLUG/"
echo "Live: https://withfulcrum.tech/$SLUG/"
