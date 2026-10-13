#!/usr/bin/env python3
"""Export this build into the Lovable project (TanStack Start) in ../wsa-lovable.

Every page build.py makes becomes a file route with real JSX, so it can be edited in Lovable.
The 55 guide pages share one dynamic route ($slug.tsx). The shared header and footer become
components in src/wsa/chrome.tsx.

The behaviour scripts (site.js, app.js, db.js) are copied as they are into public/wsa/legacy/.
<Page> loads them after hydration, and every link is a plain <a>, so each page is still a
full load, exactly like the static preview.

    python3 export_lovable.py [path-to-lovable-checkout]
"""
import json
import os
import re
import shutil
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "..", "wsa-lovable"))
sys.argv = [sys.argv[0], "--base", "/"]

import build  # noqa: E402

RECORDS = []


def capture(path, title, desc, body, *, pid="", active="", chrome="public", require=None, data=None, redirect=None, app=False, inline_js=""):
    RECORDS.append(dict(path=path, title=title, desc=desc, body=body, pid=pid, active=active, chrome=chrome,
                        require=require, data=data, redirect=redirect, app=app, inline_js=inline_js))


# static files are served from /wsa/ so they never collide with Vite's own /assets/ bundles
ASSET_RE = re.compile(r"(?<![\w/.-])assets/")


def wsa_paths(s):
    # absolute: React's SSR image preloads are emitted before <base>, so relative paths break on nested pages
    return ASSET_RE.sub("/wsa/", s)


# --------------------------------------------------------------------------- HTML -> JSX
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
INLINE = {"a", "abbr", "b", "br", "button", "cite", "code", "em", "i", "img", "input", "kbd", "label", "mark", "q", "s",
          "select", "small", "span", "strong", "sub", "sup", "svg", "textarea", "time", "u", "var", "wbr"}
ATTR = {"class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly", "maxlength": "maxLength",
        "minlength": "minLength", "autocomplete": "autoComplete", "autofocus": "autoFocus", "inputmode": "inputMode",
        "enterkeyhint": "enterKeyHint", "spellcheck": "spellCheck", "colspan": "colSpan", "rowspan": "rowSpan",
        "crossorigin": "crossOrigin", "referrerpolicy": "referrerPolicy", "allowfullscreen": "allowFullScreen",
        "frameborder": "frameBorder", "novalidate": "noValidate", "datetime": "dateTime", "srcset": "srcSet",
        "contenteditable": "contentEditable", "playsinline": "playsInline", "autoplay": "autoPlay", "viewbox": "viewBox",
        "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin",
        "stroke-dasharray": "strokeDasharray", "stroke-miterlimit": "strokeMiterlimit", "fill-rule": "fillRule",
        "clip-rule": "clipRule", "text-anchor": "textAnchor", "font-family": "fontFamily", "font-size": "fontSize",
        "font-weight": "fontWeight", "letter-spacing": "letterSpacing", "dominant-baseline": "dominantBaseline",
        "preserveaspectratio": "preserveAspectRatio", "xlink:href": "xlinkHref", "xmlns:xlink": "xmlnsXlink",
        "accept-charset": "acceptCharset", "http-equiv": "httpEquiv", "formnovalidate": "formNoValidate",
        "accesskey": "accessKey", "enctype": "encType", "hreflang": "hrefLang", "stop-color": "stopColor",
        "fill-opacity": "fillOpacity", "stroke-opacity": "strokeOpacity", "checked": "defaultChecked"}
BOOL = {"hidden", "disabled", "required", "multiple", "readonly", "autofocus", "novalidate", "allowfullscreen", "open",
        "playsinline", "muted", "loop", "controls", "autoplay", "download", "async", "defer", "formnovalidate", "checked"}
TEXT_INPUTS = {None, "text", "email", "tel", "url", "search", "number", "password", "date", "time", "datetime-local", "month", "week"}


class El:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.kids = tag, list(attrs), []


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = El("#root", [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        el = El(tag, attrs)
        self.stack[-1].kids.append(el)
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(El(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].kids.append(data)


def parse(html):
    t = Tree()
    t.feed(html)
    t.close()
    fix(t.root)
    return t.root


def fix(el):
    """React-specific clean-ups: <option selected> -> <select defaultValue>, bare <tr> in <table> -> <tbody>."""
    for k in el.kids:
        if isinstance(k, El):
            fix(k)
    if el.tag == "select":
        for o in el.kids:
            if isinstance(o, El) and o.tag == "option" and any(n == "selected" for n, _ in o.attrs):
                o.attrs = [(n, v) for n, v in o.attrs if n != "selected"]
                val = dict(o.attrs).get("value")
                if val is None:
                    val = "".join(x for x in o.kids if isinstance(x, str)).strip()
                el.attrs.append(("defaultvalue", val))
    if el.tag == "table" and any(isinstance(k, El) and k.tag == "tr" for k in el.kids):
        body = El("tbody", [])
        rest = []
        for k in el.kids:
            if isinstance(k, El) and k.tag == "tr":
                body.kids.append(k)
            elif not (isinstance(k, str) and not k.strip()):
                rest.append(k)
        el.kids = rest + [body]


def camel_css(prop):
    if prop.startswith("--"):
        return json.dumps(prop)
    parts = prop.split("-")
    if parts[0] == "":  # -webkit-line-clamp -> WebkitLineClamp
        parts = parts[1:]
        return parts[0].capitalize() + "".join(p.capitalize() for p in parts[1:])
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def style_obj(css):
    items, custom = [], False
    for decl in re.split(r";(?![^(]*\))", css):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        k, v = k.strip(), v.strip()
        if not k:
            continue
        custom |= k.startswith("--")
        items.append(f"{camel_css(k)}: {json.dumps(v)}")
    obj = "{ " + ", ".join(items) + " }"
    return "{" + obj + (" as React.CSSProperties" if custom else "") + "}"


def attr_jsx(el):
    out = []
    typ = dict(el.attrs).get("type")
    for name, val in el.attrs:
        if name == "style" and val is not None:
            out.append(f"style={style_obj(val)}")
            continue
        if name == "defaultvalue":
            out.append(f"defaultValue={json.dumps(val)}")
            continue
        if name == "value" and ((el.tag == "input" and typ in TEXT_INPUTS) or el.tag == "textarea"):
            name = "defaultValue"
        jname = name if name.startswith(("data-", "aria-")) else ATTR.get(name, name)
        if val is None or (name in BOOL and val in ("", name)):
            out.append(jname)
        elif any(c in val for c in '"\\\n&{}'):
            out.append(f"{jname}={{{json.dumps(val)}}}")
        else:
            out.append(f'{jname}="{val}"')
    return (" " + " ".join(out)) if out else ""


def esc_text(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("{", "&#123;").replace("}", "&#125;")
    return t.replace(" ", "&nbsp;")


WS = re.compile(r"[ \t\n\r\f]+")


def is_inline(node):
    return isinstance(node, str) and node.strip() or (isinstance(node, El) and node.tag in INLINE)


def render(el, ind=0):
    """JSX for an element's children, one child per line; whitespace that HTML would show is kept as {" "}."""
    pad = "  " * ind
    lines = []
    kids = el.kids
    for i, k in enumerate(kids):
        prev = kids[i - 1] if i > 0 else None
        nxt = kids[i + 1] if i + 1 < len(kids) else None
        if isinstance(k, str):
            if el.tag in ("script", "style"):
                continue
            core = WS.sub(" ", k)
            if not core.strip():
                if core and prev is not None and nxt is not None and (is_inline(prev) or is_inline(nxt)):
                    lines.append(pad + '{" "}')
                continue
            lead = core[0] == " " and prev is not None
            trail = core[-1] == " " and nxt is not None
            s = ('{" "}' if lead else "") + esc_text(core.strip()) + ('{" "}' if trail else "")
            lines.append(pad + s)
        else:
            lines.append(element(k, ind))
    return "\n".join(lines)


def element(el, ind):
    pad = "  " * ind
    a = attr_jsx(el)
    if el.tag == "script":
        code = "".join(x for x in el.kids if isinstance(x, str))
        return f"{pad}<script{a} dangerouslySetInnerHTML={{{{ __html: {json.dumps(code)} }}}} />"
    if el.tag == "textarea":
        text = "".join(x for x in el.kids if isinstance(x, str))
        if text:
            a += f" defaultValue={{{json.dumps(text)}}}"
        return f"{pad}<textarea{a} />"
    if el.tag in VOID or not el.kids or all(isinstance(k, str) and not k.strip() for k in el.kids):
        return f"{pad}<{el.tag}{a} />"
    inner = render(el, ind + 1)
    if "\n" not in inner and len(pad) + len(inner.strip()) + len(el.tag) * 2 + len(a) < 110:
        return f"{pad}<{el.tag}{a}>{inner.strip()}</{el.tag}>"
    return f"{pad}<{el.tag}{a}>\n{inner}\n{pad}</{el.tag}>"


def to_jsx(html, ind=0):
    root = parse(wsa_paths(html))
    nodes = [k for k in root.kids if isinstance(k, El) or k.strip()]
    if len(nodes) == 1 and isinstance(nodes[0], El):
        return element(nodes[0], ind)
    pad = "  " * ind
    return f"{pad}<>\n{render(root, ind + 1)}\n{pad}</>"


# --------------------------------------------------------------------------- writers
def write(rel, text):
    fp = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, "w") as f:
        f.write(text)


def route_file(path, parents):
    """'academy' -> routes/academy.tsx '/academy'; 'webinar123' with children -> routes/webinar123/index.tsx '/webinar123/'."""
    if path == "index":
        return "src/routes/index.tsx", "/"
    if path in parents:
        return f"src/routes/{path}/index.tsx", f"/{path}/"
    return f"src/routes/{path}.tsx", f"/{path}"


def ts(v):
    return json.dumps(v, ensure_ascii=False)


def head_call(r):
    return f"wsaHead({ts(r['title'])}, {ts(r['desc'])})"


def page_props(r):
    props = []
    if r["pid"]:
        props.append(f'id="{r["pid"]}"')
    if r["chrome"] != "public":
        props.append(f'chrome="{r["chrome"]}"')
    if r["active"]:
        props.append(f'active="{r["active"]}"')
    if r["require"]:
        props.append(f'require="{r["require"]}"')
    if r["app"]:
        props.append("app")
    if r["inline_js"]:
        props.append(f"inlineJs={{{ts(wsa_paths(r['inline_js']))}}}")
    if r["data"] is not None:
        props.append("data={DATA}")
    return (" " + " ".join(props)) if props else ""


def page_route(r, parents):
    fp, rid = route_file(r["path"], parents)
    if r["redirect"]:
        to = "/" if r["redirect"] in ("./", "") else "/" + r["redirect"].lstrip("/")
        write(fp, f"""import {{ createFileRoute, redirect }} from "@tanstack/react-router";

// Old Lovable link, kept so ads, DMs and emails still land somewhere.
export const Route = createFileRoute("{rid}")({{
  beforeLoad: ({{ location }}) => {{
    throw redirect({{ href: "{to}" + location.searchStr, statusCode: 301 }});
  }},
}});
""")
        return
    data = ""
    if r["data"] is not None:
        data = f"\n// Read by the page script (public/wsa/legacy/site.js) from <script id=\"wsa-data\">.\nconst DATA = {wsa_paths(ts(r['data']))};\n"
    body = to_jsx(r["body"], 3)
    comp = "Page" + re.sub(r"[^A-Za-z0-9]", "", r["path"].title()) if r["path"] != "index" else "HomePage"
    write(fp, f"""import {{ createFileRoute }} from "@tanstack/react-router";

import {{ Page }} from "@/wsa/Page";
import {{ wsaHead }} from "@/wsa/head";
{data}
export const Route = createFileRoute("{rid}")({{
  head: () => {head_call(r)},
  component: {comp},
}});

function {comp}() {{
  return (
    <Page{page_props(r)}>
{body}
    </Page>
  );
}}
""")


def chrome_tsx():
    """Header/footer components, converted from build.py's own markup."""
    nav_links = "\n".join(
        f'        <a href="{h}" aria-current={{active === "{h}" ? "page" : undefined}}>{esc_text(t)}</a>' for h, t in build.NAV)
    header = to_jsx(build.public_header(""), 2)
    header, n = re.subn(r'( *)<nav className="nav" aria-label="Main">.*?</nav>',
                        lambda m: f'{m.group(1)}<nav className="nav" aria-label="Main">\n{nav_links}\n{m.group(1)}</nav>', header, count=1, flags=re.S)
    assert n == 1, "nav swap failed"
    assert 'aria-current={active' in header, "nav swap failed"
    return f"""// Shared chrome for every page. Converted from build.py (public_header, footer, funnel_header, funnel_footer, preview_bar).
// Links are plain <a> on purpose: each page is a full load so the page scripts run fresh.

export function PreviewBar() {{
  return (
{to_jsx(build.preview_bar(), 2)}
  );
}}

export function PublicHeader({{ active = "" }}: {{ active?: string }}) {{
  return (
{header}
  );
}}

export function FunnelHeader() {{
  return (
{to_jsx(build.funnel_header(), 2)}
  );
}}

export function SiteFooter() {{
  return (
{to_jsx(build.footer(), 2)}
  );
}}

export function FunnelFooter() {{
  return (
{to_jsx(build.funnel_footer(), 2)}
  );
}}
"""


PAGE_TSX = """import { useEffect, type ReactNode } from "react";

import { FunnelFooter, FunnelHeader, PreviewBar, PublicHeader, SiteFooter } from "./chrome";

type Chrome = "public" | "funnel" | "bare" | "app";

type PageProps = {
  /** data-page on <body>: tells site.js which page behaviour to run */
  id?: string;
  chrome?: Chrome;
  /** main-nav item to mark as current */
  active?: string;
  /** "student" | "staff" | "academy" | ...: site.js sends anyone else to log in */
  require?: string;
  /** JSON the page script reads from <script id="wsa-data"> */
  data?: unknown;
  /** small inline script run before site.js (portal pages set window.WSA_RESOURCES) */
  inlineJs?: string;
  /** portal pages also load app.js */
  app?: boolean;
  children: ReactNode;
};

declare global {
  interface Window {
    __wsaScripts?: boolean;
  }
}

function addScript(src: string | null, code?: string): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    if (src) {
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve();
    } else {
      s.textContent = code ?? "";
    }
    document.body.appendChild(s);
    if (!src) resolve();
  });
}

/**
 * Every page renders inside <Page>. After React has hydrated, it runs the page scripts
 * in public/wsa/legacy/ (db.js, then site.js, then app.js on portal pages) once per page load.
 */
export function Page({ id, chrome = "public", active, require, data, inlineJs, app, children }: PageProps) {
  useEffect(() => {
    if (window.__wsaScripts) return; // StrictMode runs effects twice in dev
    window.__wsaScripts = true;
    const body = document.body;
    if (id) body.setAttribute("data-page", id);
    if (require) body.setAttribute("data-require", require);
    void (async () => {
      await addScript("/wsa/legacy/db.js");
      if (inlineJs) await addScript(null, inlineJs);
      await addScript("/wsa/legacy/site.js");
      if (app) await addScript("/wsa/legacy/app.js");
    })();
  }, [id, require, inlineJs, app]);

  return (
    <>
      <PreviewBar />
      {chrome === "public" && <PublicHeader active={active ?? ""} />}
      {chrome === "funnel" && <FunnelHeader />}
      {children}
      {chrome === "public" && <SiteFooter />}
      {chrome === "funnel" && <FunnelFooter />}
      {data !== undefined && (
        <script
          type="application/json"
          id="wsa-data"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\\\u003c") }}
        />
      )}
    </>
  );
}
"""

HEAD_TS = """// Per-page <head>. The review build is kept out of search engines until it replaces wallstalpha.com.
export function wsaHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  };
}
"""


def resource_route(resources):
    """One dynamic route for the 55 guide pages, built from a sentinel render of build.py's guide page."""
    S = {"slug": "__SLUG__", "title": "__TITLE__", "desc": "__DESC__", "cat": "__CAT__", "pdf": "__PDF__",
         "thumb": "__THUMB__", "pages": 7777, "size": "__SIZE__", "listed": False}
    before = len(RECORDS)
    build.build_resources([S])
    rec = [r for r in RECORDS[before:] if r["path"] == "__SLUG__"][0]
    del RECORDS[before:]
    body = to_jsx(rec["body"], 3)
    field = {"__SLUG__": "r.slug", "__TITLE__": "r.title", "__DESC__": "r.desc", "__CAT__": "r.cat", "__PDF__": "r.pdf",
             "__THUMB__": "r.thumb", "__SIZE__": "r.size"}
    sent = re.compile("|".join(field))

    def attr_tpl(m):
        v = m.group(2)
        if sent.fullmatch(v):
            return m.group(1) + "{" + field[v] + "}"
        return m.group(1) + "{`" + sent.sub(lambda x: "${" + field[x.group(0)] + "}", v) + "`}"
    # attribute values first ("..." and {"..."}), then text
    body = re.sub(r'(=)\{"([^"]*__[A-Z]+__[^"]*)"\}', attr_tpl, body)
    body = re.sub(r'(=)"([^"]*__[A-Z]+__[^"]*)"', attr_tpl, body)
    body = body.replace("7777 pages", "{pagesLabel}")
    body = sent.sub(lambda x: "{" + field[x.group(0)] + "}", body)
    left = re.findall(r"__[A-Z]+__", body)
    assert not left, f"unreplaced sentinels in resource page: {set(left)}"
    # related guides: same topic, different file
    marker = "</section>"
    i = body.index(marker) + len(marker)
    related = """
          {related.length > 0 && (
            <section className="section" style={{ paddingTop: "clamp(20px,3vw,36px)" }}>
              <div className="wrap">
                <div className="section-head section-head--row">
                  <div>
                    <span className="label">More in {r.cat}</span>
                  </div>
                  <a className="btn btn--ghost btn--sm" href="resources">
                    All resources <span className="arr" aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="res-grid">
                  {related.map((x) => (
                    <ResCard key={x.slug} r={x} />
                  ))}
                </div>
              </div>
            </section>
          )}"""
    body = body[:i] + related + body[i:]
    data = [{k: wsa_paths(str(r[k])) if k in ("pdf", "thumb") else r[k] for k in ("slug", "title", "desc", "cat", "pdf", "thumb", "pages", "size", "listed")}
            for r in resources]
    write("src/wsa/resources.json", json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    write("src/wsa/ResCard.tsx", """import type { Resource } from "./resources";

/** Library card: the guide's real first page, title, one-line blurb and page count (same markup as site.js resCard). */
export function ResCard({ r }: { r: Resource }) {
  return (
    <a className="res" href={r.slug}>
      <span className="res-thumb">
        <img src={r.thumb} alt="" loading="lazy" width="480" height="621" />
      </span>
      <div className="res-body">
        <h3>{r.title}</h3>
        <p>{r.desc}</p>
        <span className="res-meta">
          {r.pages} {r.pages === 1 ? "page" : "pages"} · PDF
        </span>
      </div>
    </a>
  );
}
""")
    write("src/wsa/resources.ts", """import list from "./resources.json";

export type Resource = {
  slug: string;
  title: string;
  desc: string;
  cat: string;
  /** public/wsa/resources/<slug>.pdf */
  pdf: string;
  /** first-page cover, public/wsa/resources/thumbs/<slug>.jpg */
  thumb: string;
  pages: number;
  size: string;
  /** false for duplicates and old drafts: the page stays for old links, the library lists it once */
  listed: boolean;
};

export const RESOURCES = list as Resource[];

export const resourceBySlug = (slug: string) => RESOURCES.find((r) => r.slug === slug);
""")
    write("src/routes/$slug.tsx", f"""import {{ createFileRoute, notFound }} from "@tanstack/react-router";

import {{ Page }} from "@/wsa/Page";
import {{ ResCard }} from "@/wsa/ResCard";
import {{ RESOURCES, resourceBySlug }} from "@/wsa/resources";
import {{ wsaHead }} from "@/wsa/head";

// The 55 guide pages (wallstalpha.com/coldoutreach, /IB31, ...). Data: src/wsa/resources.json.
export const Route = createFileRoute("/$slug")({{
  loader: ({{ params }}) => {{
    const r = resourceBySlug(params.slug);
    if (!r) throw notFound();
    return r;
  }},
  head: ({{ loaderData }}) => (loaderData ? wsaHead(`${{loaderData.title}} · Wall Street Alpha`, loaderData.desc) : {{}}),
  component: GuidePage,
}});

function GuidePage() {{
  const r = Route.useLoaderData();
  const pagesLabel = `${{r.pages}} ${{r.pages === 1 ? "page" : "pages"}}`;
  const related = RESOURCES.filter((x) => x.listed && x.cat === r.cat && x.slug !== r.slug && x.pdf !== r.pdf).slice(0, 4);
  return (
    <Page id="resource" active="resources">
{body}
    </Page>
  );
}}
""")


ROOT_TSX = """import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Page } from "../wsa/Page";

const FONTS = "__FONTS__";

function NotFoundComponent() {
  return (
    <Page>
      <main className="center-page">
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="label">404</span>
          <h1 className="h1" style={{ fontSize: "clamp(34px,4.4vw,52px)" }}>
            Page not found
          </h1>
          <p className="sub">The page you're looking for doesn't exist or has moved.</p>
          <a className="btn btn--solid" href="/">
            Go home
          </a>
        </div>
      </main>
    </Page>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="center-page">
      <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
        <h1 className="h2">This page didn't load</h1>
        <p className="sub">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="row-wrap">
          <button
            className="btn btn--solid"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a className="btn btn--ghost" href="/">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Wall Street Alpha" },
      { name: "description", content: "Recruiting coaching, free resources and a community for students breaking into investment banking, markets and the buy side." },
      { name: "author", content: "Wall Street Alpha" },
      { property: "og:site_name", content: "Wall Street Alpha" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/wsa/wsa-bull.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Page links are relative ("academy", "wsa/logo.png"), so they resolve from the site root on every page. */}
        <base href="/" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
"""

STYLES_CSS = """/*
 * Tailwind's theme and utilities, without Preflight (its reset fights the WSA design system).
 * The site itself is styled by ./wsa/site.css, the same stylesheet as the static preview.
 * Prefer its classes (btn, card, panel, section, wrap, label, h1/h2...) and tokens (--ink, --accent, --line...)
 * when editing pages; Tailwind utilities are available for one-off tweaks.
 */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "./wsa/site.css";
@source "../src";
"""

README = """# Wall Street Alpha (rebuild)

The rebuilt wallstalpha.com: the public site, the resource library, the job board, the community and the student and
coach portals. It was exported from the static preview build (`wsa-platform/`, live at withfulcrum.tech/wsa-preview-d45eb9)
by `export_lovable.py`.

## How it is put together

| Where | What |
| --- | --- |
| `src/routes/*.tsx` | One route per page, same URLs as the live Lovable site. Page markup is plain JSX. |
| `src/routes/$slug.tsx` | The 55 guide pages (`/coldoutreach`, `/IB31`, ...), from `src/wsa/resources.json` |
| `src/wsa/chrome.tsx` | Header, footer and the preview bar |
| `src/wsa/Page.tsx` | Wraps every page and runs the page scripts after hydration |
| `src/wsa/site.css` | The design system: tokens, components, layouts (light and dark) |
| `public/wsa/legacy/` | Page behaviour: `site.js` (sign-in, guards, forms, library, job board), `app.js` (portals), `db.js` (mock database) |
| `public/wsa/` | Images, logos, the 55 PDFs and their covers |

Links are plain `<a href>` on purpose. Every page is a full load, so the scripts start fresh.

## What is still simulated

As in the static preview, sign-ins and the portals run on a mock database in the browser (`db.js`, localStorage), and
the lecture sign-up is simulated. The application and CV forms are the live Youform embeds, so those submissions are real.
The next step is connecting Supabase (project `iujstwnbepisgixefser`) in place of `db.js`.
"""


def main():
    build.page = capture
    resources = build.build_pages()
    if not os.path.isdir(OUT):
        sys.exit(f"no Lovable checkout at {OUT}")
    paths = [r["path"] for r in RECORDS]
    parents = {p.rsplit("/", 1)[0] for p in paths if "/" in p}
    slugs = {r["slug"] for r in resources}

    # fresh routes; keep the scaffold's __root and nothing else from a previous export
    rdir = os.path.join(OUT, "src", "routes")
    for dp, dn, fn in os.walk(rdir):
        for f in fn:
            if f.endswith(".tsx") and f != "__root.tsx":
                os.remove(os.path.join(dp, f))
    for r in RECORDS:
        if r["path"] in slugs:
            continue
        page_route(r, parents)
    resource_route(resources)

    write("src/routes/__root.tsx", ROOT_TSX.replace("__FONTS__", build.FONTS))
    write("src/wsa/chrome.tsx", chrome_tsx())
    write("src/wsa/Page.tsx", PAGE_TSX)
    write("src/wsa/head.ts", HEAD_TS)
    write("src/styles.css", STYLES_CSS)
    write("src/wsa/site.css", wsa_paths(open(os.path.join(ROOT, "src", "site.css")).read()))
    write("WSA.md", README)

    # page scripts and static files
    leg = os.path.join(OUT, "public", "wsa", "legacy")
    os.makedirs(leg, exist_ok=True)
    for name in ("site.js", "app.js"):
        write(f"public/wsa/legacy/{name}", wsa_paths(open(os.path.join(ROOT, "src", name)).read()))
    modules = json.load(open(os.path.join(ROOT, "data", "modules.json")))
    dbjs = open(os.path.join(ROOT, "src", "db.js")).read().replace("/*__MODULES__*/[]", json.dumps(modules, ensure_ascii=False))
    write("public/wsa/legacy/db.js", wsa_paths(dbjs))
    src_assets = os.path.join(ROOT, "assets")
    dst_assets = os.path.join(OUT, "public", "wsa")
    for dp, dn, fn in os.walk(src_assets):
        for f in fn:
            if f.startswith("."):
                continue
            s = os.path.join(dp, f)
            d = os.path.join(dst_assets, os.path.relpath(s, src_assets))
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d) or os.path.getmtime(s) > os.path.getmtime(d):
                shutil.copy2(s, d)
    n = sum(1 for r in RECORDS if r["path"] not in slugs)
    print(f"Exported {n} routes + 1 guide route ({len(slugs)} guides) into {OUT}")


if __name__ == "__main__":
    main()
