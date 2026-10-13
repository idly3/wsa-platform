#!/usr/bin/env python3
"""Local preview that matches the VPS: serves dist/ under /<slug>/ and maps /x to x.html,
like Caddy's `try_files {path} {path}.html {path}/index.html`.

    python3 serve.py 4176
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
SLUG = open(os.path.join(ROOT, "data", "slug.txt")).read().strip()
PREFIX = "/" + SLUG


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=DIST, **k)

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        if not path.startswith(PREFIX):
            return os.path.join(DIST, "__missing__")
        rel = path[len(PREFIX):].lstrip("/")
        full = os.path.join(DIST, rel)
        if rel and os.path.isfile(full):
            return full
        if os.path.isfile(full.rstrip("/") + ".html"):
            return full.rstrip("/") + ".html"
        if os.path.isfile(os.path.join(full, "index.html")):
            return os.path.join(full, "index.html")
        return os.path.join(DIST, "__missing__")

    def do_GET(self):
        if self.path in ("/", ""):
            self.send_response(302)
            self.send_header("Location", PREFIX + "/")
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4176
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
