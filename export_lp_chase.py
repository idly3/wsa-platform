#!/usr/bin/env python3
"""Build the rebuilt homepage as one self-contained route for Chase's Lovable project: /landingpageversion1.

The output in handoff/landingpageversion1/ holds:
- landingpageversion1.tsx: goes in src/routes/. It's plain React with no page scripts and no mock sign-in.
  The menu, the Dean's List ticker, the forum threads and "Show answer" are React state.
- lp.css: goes in public/landingpageversion1/. It's the design system, loaded by this route only,
  so Chase's other pages are untouched.
- the images: also go in public/landingpageversion1/.

Links go to Chase's own pages where they exist. Pages his site doesn't have yet (academy, resources,
community, question bank, Dean's List, about, join) open the full rebuild preview instead.
"""
import os
import re
import shutil
import sys

sys.argv = [sys.argv[0]]
import export_lovable as ex  # noqa: E402  (also imports build with --base /)

build = ex.build
ROOT = ex.ROOT
OUT = os.path.join(ROOT, "handoff", "landingpageversion1")
A = "/landingpageversion1"
PREVIEW = "https://withfulcrum.tech/wsa-preview-d45eb9"
ON_CHASE = {"apply", "vsl", "webinar123", "technicalguide", "jobs", "login", "dashboard", "coldoutreach", "terms", "privacy"}


def prune(el):
    """Drop signed-in-only chrome (data-when="in") and the script hooks this page no longer needs."""
    keep = []
    for k in el.kids:
        if isinstance(k, ex.El):
            a = dict(k.attrs)
            if a.get("data-when") == "in" or "usermenu" in (a.get("class") or ""):
                continue
            k.attrs = [(n, v) for n, v in k.attrs if n not in ("data-when", "data-home-link")]
            prune(k)
        keep.append(k)
    el.kids = keep


def jsx(html, ind):
    root = ex.parse(ex.wsa_paths(html))
    prune(root)
    nodes = [k for k in root.kids if isinstance(k, ex.El)]
    assert len(nodes) == 1, "expected one root element"
    return ex.element(nodes[0], ind)


def links(s):
    def fix(m):
        h = m.group(1)
        if h in ("./", ""):
            return f'href="{A}"'
        if h.startswith(("http", "mailto:", "/", "#")):
            return m.group(0)
        if h in ON_CHASE:
            return f'href="/{h}"'
        if h == "coach":  # Chase's coach side lives inside /dashboard
            return 'href="/dashboard"'
        return f'href="{PREVIEW}/{h}"'
    return re.sub(r'href="([^"]*)"', fix, s)


def swap(s, old, new, count=1):
    assert s.count(old) == count, f"expected {count}x: {old[:70]}"
    return s.replace(old, new)


def main():
    build.page = ex.capture
    build.build_pages()
    home = next(r for r in ex.RECORDS if r["path"] == "index")

    header = jsx(build.public_header(""), 3)
    body = jsx(home["body"], 3)
    footer = jsx(build.footer(), 3)

    # mobile menu
    header = swap(header, 'aria-expanded="false" aria-controls="mobile-panel"',
                  'aria-expanded={menuOpen} aria-controls="mobile-panel" onClick={() => setMenuOpen((o) => !o)}')
    header = swap(header, 'className="wrap mobile-panel"', 'className={`wrap mobile-panel${menuOpen ? " open" : ""}`}')
    # Dean's List ticker, forum threads and the sort buttons, "Show answer"
    body = re.sub(r'<div className="belt" data-belt />', "<Ticker />", body)
    assert "<Ticker />" in body
    body = re.sub(r'<ul className="thread-list" data-threads="\d+" data-thread-link="[^"]*" />', "<Threads sort={sort} />", body)
    assert "<Threads sort={sort} />" in body
    for key in ("hot", "new"):
        body = re.sub(rf'data-sort="{key}" aria-pressed="(true|false)"',
                      f'aria-pressed={{sort === "{key}"}} onClick={{() => setSort("{key}")}}', body)
    body = re.sub(r'aria-expanded="false" data-reveal="ans-dep">\s*Show answer\s*</button>',
                  'aria-expanded={shown} onClick={() => setShown((v) => !v)}>\n{shown ? "Hide answer" : "Show answer"}\n</button>', body)
    body = swap(body, 'id="ans-dep" hidden', 'id="ans-dep" hidden={!shown}')
    assert "data-" not in re.sub(r'data-(src|page)=', "", body).replace("aria-", ""), "leftover script hooks"
    # Tailwind ships a bare `contents` utility (display: contents); rename ours
    body = body.replace('className="contents"', 'className="toc"')

    page = "\n".join([links(header), body, links(footer)])
    page = links(page).replace("/wsa/", f"{A}/")

    wins = re.search(r"var WINS = \[(.*?)\];", open(os.path.join(ROOT, "src", "site.js")).read(), re.S).group(1)
    threads = re.search(r"var THREADS = \[(.*?)\];", open(os.path.join(ROOT, "src", "site.js")).read(), re.S).group(1)
    tsx = TEMPLATE.replace("__FONTS__", build.FONTS).replace("__WINS__", wins.strip()).replace("__THREADS__", threads.strip())
    tsx = tsx.replace("__PAGE__", page).replace("__PREVIEW__", PREVIEW).replace("__A__", A)

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    open(os.path.join(OUT, "landingpageversion1.tsx"), "w").write(tsx)

    css = open(os.path.join(ROOT, "src", "site.css")).read()
    css = re.sub(r"\.contents(?![\w-])", ".toc", css)
    css = css.replace('[data-page="home"]', ".lp-home")
    open(os.path.join(OUT, "lp.css"), "w").write(
        "/* Wall Street Alpha rebuild: design system for /landingpageversion1 only (loaded by that route). */\n" + css)

    # images this page uses
    files = set(re.findall(rf'{A}/([\w./-]+\.(?:png|jpe?g|svg|webp))', tsx))
    files |= {"logos/wins/" + f for f in re.findall(r'"([\w-]+\.(?:png|jpe?g))"', wins)}
    for f in sorted(files):
        src = os.path.join(ROOT, "assets", f)
        dst = os.path.join(OUT, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    print(f"{OUT}: tsx {len(tsx)//1024} KB, css {len(css)//1024} KB, {len(files)} images")
    for f in sorted(files):
        print("  ", f)


TEMPLATE = r'''import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Landing page, version 1: the rebuilt wallstalpha.com homepage, for review.
// Self-contained: its stylesheet (public/landingpageversion1/lp.css) and images (public/landingpageversion1/)
// load on this page only, so no other page changes. Links go to the live pages where they exist;
// pages the site doesn't have yet open the full rebuild preview (__PREVIEW__).

const A = "__A__";
const PREVIEW = "__PREVIEW__";
const FONTS = "__FONTS__";

export const Route = createFileRoute("/landingpageversion1")({
  head: () => ({
    meta: [
      { title: "Wall Street Alpha | Landing page v1" },
      {
        name: "description",
        content:
          "Recruiting coaching, free guides, a live job board and a community for students breaking into investment banking, markets and the buy side.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
      { rel: "stylesheet", href: `${A}/lp.css` },
    ],
  }),
  component: LandingPageV1,
});

// The Dean's List: school, school logo, firm, firm logo, role, city
const WINS: [string, string, string, string, string, string][] = [
__WINS__
];

type Thread = { t: string; d: string; v: number; c: number; h: number; f: string };
const THREADS: Thread[] = [
__THREADS__
];

const ago = (h: number) => (h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`);

function Logo({ file, name }: { file: string; name: string }) {
  return <img className="lg" src={`${A}/logos/wins/${file}`} alt={`${name} logo`} width="30" height="30" />;
}

/** Slow, steady ticker (26px a second), paused on hover by the stylesheet. */
function Ticker() {
  const belt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = belt.current;
    if (!b) return;
    const setSpeed = () => {
      const w = b.scrollWidth / 2;
      if (w > 0) b.style.animationDuration = `${Math.round(w / 26)}s`;
    };
    setSpeed();
    const t = window.setTimeout(setSpeed, 800);
    return () => window.clearTimeout(t);
  }, []);
  const row = (copy: boolean) =>
    WINS.map(([school, schoolLogo, firm, firmLogo, role], i) => (
      <div className="win" key={`${copy ? "b" : "a"}${i}`} aria-hidden={copy || undefined}>
        <Logo file={schoolLogo} name={school} />
        <span className="school">{school}</span>
        <span className="to" aria-hidden="true">→</span>
        <Logo file={firmLogo} name={firm} />
        <span className="where">{firm}</span>
        <span className="role">{role}</span>
      </div>
    ));
  return (
    <div className="belt" ref={belt}>
      {row(false)}
      {row(true)}
    </div>
  );
}

function Threads({ sort }: { sort: "hot" | "new" }) {
  const rows = THREADS.slice()
    .sort((a, b) => (sort === "new" ? a.h - b.h : b.v - a.v))
    .slice(0, 6);
  return (
    <ul className="thread-list">
      {rows.map((x) => (
        <li className="thread" key={x.t}>
          <div className="votes">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 5l8 11H4z" />
            </svg>
            {x.v}
          </div>
          <div className="t-body">
            <a className="t-title" href={`${PREVIEW}/community`}>
              {x.t}
            </a>
            <div className="t-meta">
              <span className="t-desk">{x.d}</span>
              <span className="flair">{x.f}</span>
              <span>{x.c} replies</span>
              <span>{ago(x.h)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LandingPageV1() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [shown, setShown] = useState(false);
  return (
    <div className="lp-home">
__PAGE__
    </div>
  );
}
'''

if __name__ == "__main__":
    main()
