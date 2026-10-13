#!/usr/bin/env python3
"""Export the public front end as plain React for a Lovable (TanStack Start) project.

Covers the homepage and every page reachable from it. The student and coach portals are left out.
There is no mock database, no simulated sign-in and no page scripts: every interaction is React state.
- Sign-in state and Academy access come from useViewer() in src/wsa/viewer.ts. Everyone is a signed-out
  visitor until you connect your auth.
- The forms call the stubs in src/wsa/backend.ts. They're marked as not connected until you wire them.

    python3 export_frontend.py [out_dir]     (default: handoff/frontend, an overlay for the project root)
"""
import copy
import json
import os
import re
import shutil
import sys

OUT_ARG = sys.argv[1] if len(sys.argv) > 1 else None
sys.argv = [sys.argv[0]]
import export_lovable as ex  # noqa: E402  (imports build.py with --base /)

build = ex.build
ROOT = ex.ROOT
OUT = os.path.abspath(OUT_ARG or os.path.join(ROOT, "handoff", "frontend"))

PUBLIC = ["index", "vsl", "academy", "apply", "applydm", "booked", "webinar123", "webinar123/register", "webinar-registered",
          "technicalguide", "technicalguide/sent", "resources", "jobs", "community", "deans-list", "about",
          "terms", "privacy", "login", "join"]
REDIRECTS = {"wins": "deans-list", "apply2": "apply", "apply3": "apply", "lecture": "webinar123", "home-original": "vsl"}
OLD_LINKS = set(REDIRECTS)  # permanent (301); switched-off pages redirect temporarily (302)
# portal links have nowhere to go in a front end: send them to sign-in
LINK_MAP = {"dashboard": "login", "coach": "login", "dashboard/profile": "login", "membership": "academy"}


def page_links(page):
    """Portal links go to sign-in. Every Apply button goes to the VSL page first (build.APPLY_VIA_VSL); only the VSL page
    links straight to the application form."""
    links = dict(LINK_MAP)
    if not build.ACADEMY_PAGE:
        links["academy"] = links["membership"] = "vsl"
    if build.APPLY_VIA_VSL and page not in build.APPLY_DIRECT:
        links["apply"] = "vsl"
    return links


YOUFORM_KEYS = {"5hers03e": "apply", "2icrdiql": "applyDm", "juj0batp": "cv"}
W = "@/wsa/widgets"


# --------------------------------------------------------------------------- JSX with raw expressions
class Raw:
    """Verbatim JSX (a component tag or an {expression})."""

    def __init__(self, code, inline=False):
        self.code, self.inline = code, inline


class Cond:
    """{expr && (node)}"""

    def __init__(self, expr, node):
        self.expr, self.node = expr, node


def is_inline(n):
    if isinstance(n, str):
        return bool(n.strip())
    if isinstance(n, ex.El):
        return n.tag in ex.INLINE
    return isinstance(n, Raw) and n.inline


def attrs_jsx(el):
    plain = [(n, v) for n, v in el.attrs if n != "__raw__"]
    raw = [v for n, v in el.attrs if n == "__raw__"]
    return ex.attr_jsx(ex.El(el.tag, plain)) + "".join(" " + r for r in raw)


def node_jsx(n, ind):
    if isinstance(n, Raw):
        return "  " * ind + n.code
    if isinstance(n, Cond):
        pad = "  " * ind
        return f"{pad}{{{n.expr} && (\n{node_jsx(n.node, ind + 1)}\n{pad})}}"
    return element(n, ind)


def render(el, ind):
    pad = "  " * ind
    lines, kids = [], el.kids
    for i, k in enumerate(kids):
        prev = kids[i - 1] if i > 0 else None
        nxt = kids[i + 1] if i + 1 < len(kids) else None
        if isinstance(k, str):
            core = ex.WS.sub(" ", k)
            if not core.strip():
                if core and prev is not None and nxt is not None and (is_inline(prev) or is_inline(nxt)):
                    lines.append(pad + '{" "}')
                continue
            lead = core[0] == " " and prev is not None
            trail = core[-1] == " " and nxt is not None
            lines.append(pad + ('{" "}' if lead else "") + ex.esc_text(core.strip()) + ('{" "}' if trail else ""))
        else:
            lines.append(node_jsx(k, ind))
    return "\n".join(lines)


def element(el, ind):
    pad = "  " * ind
    a = attrs_jsx(el)
    if el.tag == "textarea":
        return f"{pad}<textarea{a} />"
    if el.tag in ex.VOID or not el.kids or all(isinstance(k, str) and not k.strip() for k in el.kids):
        return f"{pad}<{el.tag}{a} />"
    inner = render(el, ind + 1)
    if "\n" not in inner and len(pad) + len(inner.strip()) + 2 * len(el.tag) + len(a) < 110:
        return f"{pad}<{el.tag}{a}>{inner.strip()}</{el.tag}>"
    return f"{pad}<{el.tag}{a}>\n{inner}\n{pad}</{el.tag}>"


def tree_jsx(root, ind):
    nodes = [k for k in root.kids if not (isinstance(k, str) and not k.strip())]
    if len(nodes) == 1:
        return node_jsx(nodes[0], ind)
    pad = "  " * ind
    return f"{pad}<>\n{render(root, ind + 1)}\n{pad}</>"


def parse(html):
    return ex.parse(ex.wsa_paths(html))


# --------------------------------------------------------------------------- tree helpers
def walk(holder):
    kids = [holder.node] if isinstance(holder, Cond) else holder.kids
    for k in list(kids):
        if isinstance(k, ex.El):
            yield k, holder
            yield from walk(k)
        elif isinstance(k, Cond):
            if isinstance(k.node, ex.El):
                yield k.node, k
                yield from walk(k.node)


def find(root, pred):
    return [(n, h) for n, h in walk(root) if pred(n)]


def get(el, name):
    for k, v in el.attrs:
        if k == name:
            return "" if v is None else v
    return None


def has(el, name):
    return any(k == name for k, _ in el.attrs)


def drop(el, *names):
    el.attrs = [(k, v) for k, v in el.attrs if k not in names]


def raw_attr(el, code):
    el.attrs.append(("__raw__", code))


def classes(el):
    return (get(el, "class") or "").split()


def replace(holder, node, new):
    if isinstance(holder, Cond):
        holder.node = new
    else:
        holder.kids[next(i for i, k in enumerate(holder.kids) if k is node)] = new


def remove(holder, node):
    holder.kids[:] = [k for k in holder.kids if k is not node]


def text_of(el):
    return "".join(k if isinstance(k, str) else text_of(k) for k in el.kids if isinstance(k, (str, ex.El)))


class Ctx:
    def __init__(self):
        self.imports, self.hooks, self.react = {}, [], set()

    def use(self, mod, *names):
        self.imports.setdefault(mod, set()).update(names)

    def hook(self, line, *react):
        self.react.update(react)
        if line not in self.hooks:
            self.hooks.append(line)

    def viewer(self):
        self.use("@/wsa/viewer", "useViewer")
        self.hook("const { signedIn, access } = useViewer();")

    def import_lines(self):
        out = []
        if self.react:
            out.append(f'import {{ {", ".join(sorted(self.react))} }} from "react";')
        for mod in sorted(self.imports):
            out.append(f'import {{ {", ".join(sorted(self.imports[mod]))} }} from "{mod}";')
        return out


SECTIONS = {}  # component name -> file text


# --------------------------------------------------------------------------- page transforms
def transform(root, ctx, page=""):
    for n, h in find(root, lambda n: {"demo-box", "snapshot-note", "usermenu"} & set(classes(n))):
        remove(h, n)

    # interactive sections become generated components
    for hook, comp, maker in [("data-resources", "ResourceLibrary", make_library), ("data-jobs", "JobBoard", make_jobs),
                              ("data-webinar-form", "LectureForm", make_lecture_form),
                              ("data-guide-form", "GuideForm", make_guide_form), ("data-join", "JoinForm", make_join_form)]:
        for n, h in find(root, lambda n, a=hook: has(n, a)):
            access = get(n, "data-access")
            SECTIONS[comp] = maker(copy.deepcopy(n))
            new = Raw(f"<{comp} />")
            if access is not None:
                ctx.viewer()
                new = Cond("access" if access == "yes" else "!access", new)
            replace(h, n, new)
            ctx.use(f"@/wsa/sections/{comp}", comp)
    for n, h in find(root, lambda n: any(isinstance(k, ex.El) and has(k, "data-login") for k in n.kids)):
        SECTIONS["LoginPanel"] = make_login(copy.deepcopy(n))
        replace(h, n, Raw("<LoginPanel />"))
        ctx.use("@/wsa/sections/LoginPanel", "LoginPanel")

    for n, h in find(root, lambda n: has(n, "data-belt")):
        replace(h, n, Raw("<Ticker />"))
        ctx.use(W, "Ticker")
    for n, h in find(root, lambda n: has(n, "data-wins-grid")):
        replace(h, n, Raw("<WinsGrid />"))
        ctx.use(W, "WinsGrid")
    for n, h in find(root, lambda n: has(n, "data-mini-wins")):
        replace(h, n, Raw(f'<MiniWins n={{{get(n, "data-mini-wins") or 4}}} />'))
        ctx.use(W, "MiniWins")
    for n, h in find(root, lambda n: has(n, "data-threads")):
        replace(h, n, Raw(f'<Threads sort={{sort}} limit={{{get(n, "data-threads") or 6}}} />'))
        ctx.use(W, "Threads")
        ctx.hook('const [sort, setSort] = useState<"hot" | "new">("hot");', "useState")
    for n, _ in find(root, lambda n: has(n, "data-sort")):
        v = get(n, "data-sort")
        drop(n, "data-sort", "aria-pressed")
        raw_attr(n, f'aria-pressed={{sort === "{v}"}} onClick={{() => setSort("{v}")}}')
    for i, (n, _) in enumerate(find(root, lambda n: has(n, "data-reveal")), 1):
        var, setter = f"shown{i}", f"setShown{i}"
        ctx.hook(f"const [{var}, {setter}] = useState(false);", "useState")
        target = get(n, "data-reveal")
        drop(n, "data-reveal", "aria-expanded")
        raw_attr(n, f"aria-expanded={{{var}}} onClick={{() => {setter}((v) => !v)}}")
        n.kids = [Raw(f'{{{var} ? "Hide answer" : "Show answer"}}', True)]
        for t, _ in find(root, lambda m, tid=target: get(m, "id") == tid):
            drop(t, "hidden")
            raw_attr(t, f"hidden={{!{var}}}")
    for n, h in find(root, lambda n: has(n, "data-rotator")):
        words = [text_of(s).strip() for s in n.kids if isinstance(s, ex.El)]
        replace(h, n, Raw(f"<Rotator words={{{json.dumps(words)}}} />", True))
        ctx.use(W, "Rotator")
    for n, _ in find(root, lambda n: has(n, "data-countdown")):
        ctx.hook(f'const cd = useCountdown("{get(n, "data-countdown")}");')
        ctx.use(W, "useCountdown")
        drop(n, "data-countdown")
        for m, _ in find(n, lambda m: any(has(m, f"data-{x}") for x in "dhms")):
            key = next(x for x in "dhms" if has(m, f"data-{x}"))
            drop(m, f"data-{key}")
            m.kids = [Raw(f"{{cd.{key}}}", True)]
    for n, h in find(root, lambda n: has(n, "data-youform-embed")):
        key = YOUFORM_KEYS[get(n, "data-form")]
        replace(h, n, Raw(f'<YouformEmbed form={{YOUFORM.{key}}} height={{{get(n, "data-height") or 700}}} />'))
        ctx.use(W, "YouformEmbed")
        ctx.use("@/wsa/config", "YOUFORM")

    # lecture ticket page and the guide "sent" page
    for n, _ in find(root, lambda n: has(n, "data-ticket")):
        drop(n, "data-ticket")
        ctx.hook("const reg = useRegistration();")
        ctx.use(W, "useRegistration")
    for attr, expr in (("data-reg-name", '{reg?.name || "Your name"}'), ("data-reg-first", '{reg?.first || "you"}'),
                       ("data-parent-name", '{reg?.parentFirst || "your parent"}')):
        for n, _ in find(root, lambda n, a=attr: has(n, a)):
            drop(n, attr)
            n.kids = [Raw(expr, True)]
    for n, _ in find(root, lambda n: has(n, "data-parent-ticket")):
        drop(n, "data-parent-ticket", "hidden")
        raw_attr(n, 'hidden={!reg || reg.parent === "no_invite"}')
    for n, _ in find(root, lambda n: has(n, "data-step-done")):
        drop(n, "data-step-done")
        raw_attr(n, "onClick={markDone}")
        ctx.hook('const markDone = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest(".stepcard")?.classList.add("done");', "type MouseEvent")
    for n, _ in find(root, lambda n: has(n, "data-guide-email")):
        drop(n, "data-guide-email")
        n.kids = [Raw("{guideEmail}", True)]
        ctx.hook("const guideEmail = useGuideEmail();")
        ctx.use(W, "useGuideEmail")

    # the Academy paywall and signed-in-only bits
    for attr, var in (("data-when", "signedIn"), ("data-access", "access")):
        for n, h in find(root, lambda n, a=attr: has(n, a)):
            v = get(n, attr)
            drop(n, attr, "hidden")
            ctx.viewer()
            replace(h, n, Cond(var if v in ("in", "yes") else "!" + var, n))
    links = page_links(page)
    for n, _ in find(root, lambda n: get(n, "href") in links):
        n.attrs = [(k, links[v] if k == "href" else v) for k, v in n.attrs]
    for n, _ in find(root, lambda n: has(n, "data-src")):  # guide PDF viewer: only rendered for Academy access
        n.attrs = [("src" if k == "data-src" else k, v) for k, v in n.attrs]
    for n, _ in find(root, lambda n: has(n, "data-home-link")):
        drop(n, "data-home-link")


def leftovers(root):
    return sorted({k for n, _ in walk(root) for k, _ in n.attrs if k.startswith("data-") and k != "data-page"})


# --------------------------------------------------------------------------- generated sections
def section(name, imports, body_top, jsx, doc):
    return f"""{imports}

/** {doc} Generated by export_frontend.py from the static build's markup. */
export function {name}() {{
{body_top}
  return (
{jsx}
  );
}}
"""


def make_library(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    drop(root_el, "data-resources", "data-access", "hidden")
    for n, _ in find(r, lambda n: has(n, "data-res-search")):
        drop(n, "data-res-search")
        raw_attr(n, "value={q} onChange={(e) => setQ(e.target.value)}")
    for n, _ in find(r, lambda n: has(n, "data-cat")):
        v = json.dumps(get(n, "data-cat"))
        drop(n, "data-cat", "aria-pressed")
        raw_attr(n, f"aria-pressed={{cat === {v}}} onClick={{() => setCat({v})}}")
    for n, _ in find(r, lambda n: has(n, "data-res-groups")):
        drop(n, "data-res-groups")
        n.kids = [Raw("{groups}")]
    assert not leftovers(r), leftovers(r)
    top = """  const { access } = useViewer();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const items = RESOURCES.filter((r) => r.listed);
  const term = q.trim().toLowerCase();
  const group = (title: string, rows: Resource[]) => (
    <section className="res-group" key={title}>
      <div className="res-group-head">
        <h2>{title}</h2>
        <span>
          {rows.length} {rows.length === 1 ? "guide" : "guides"}
        </span>
      </div>
      <div className="res-grid">
        {rows.map((x) => (
          <ResCard key={x.slug} r={x} locked={!access} />
        ))}
      </div>
    </section>
  );
  let groups: ReactNode;
  if (term) {
    const hits = items.filter(
      (x) => (cat === "All" || x.cat === cat) && `${x.title} ${x.desc} ${x.cat}`.toLowerCase().includes(term),
    );
    groups = hits.length ? (
      group(`Results for \\u201c${q.trim()}\\u201d`, hits)
    ) : (
      <div className="empty-state">No guides match that search. Try a broader word, like "networking" or "resume".</div>
    );
  } else {
    groups = CATS.filter((c) => cat === "All" || c === cat).map((c) => {
      const rows = items.filter((x) => x.cat === c);
      return rows.length ? group(c, rows) : null;
    });
  }"""
    imports = """import { useState, type ReactNode } from "react";

import { ResCard } from "../ResCard";
import { CATS, RESOURCES, type Resource } from "../resources";
import { useViewer } from "../viewer";"""
    return section("ResourceLibrary", imports, top, tree_jsx(r, 2), "The resource library: search, topic filter and one section per topic.")


def make_jobs(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    drop(root_el, "data-jobs", "data-access", "hidden")
    for key, setter in (("type", "setType"), ("vert", "setVert")):
        for n, _ in find(r, lambda n, a=f"data-{key}": has(n, a)):
            v = json.dumps(get(n, f"data-{key}"))
            drop(n, f"data-{key}", "aria-pressed")
            raw_attr(n, f"aria-pressed={{{key} === {v}}} onClick={{() => {setter}({v})}}")
            for s in n.kids:
                if isinstance(s, ex.El) and s.tag == "span":
                    s.kids = [Raw(f'{{count("{key}", {v})}}', True)]
    for n, _ in find(r, lambda n: has(n, "data-jobs-reset")):
        drop(n, "data-jobs-reset")
        raw_attr(n, "onClick={reset}")
    for n, _ in find(r, lambda n: has(n, "data-jobs-search")):
        drop(n, "data-jobs-search")
        raw_attr(n, "value={q} onChange={(e) => setQ(e.target.value)}")
    for n, _ in find(r, lambda n: has(n, "data-jobs-count")):
        drop(n, "data-jobs-count")
        n.kids = [Raw("{rows.length} of {JOBS.length} openings", True)]
    for n, _ in find(r, lambda n: has(n, "data-jobs-body")):
        drop(n, "data-jobs-body")
        n.kids = [Raw("""{rows.length ? (
  rows.map((j) => (
    <tr key={j.url + j.title}>
      <td>
        <a className="job-cell" href={j.url} target="_blank" rel="noopener">
          <span className="firm-mark">{mark(j.firm)}</span>
          <span>
            <span className="strong">{j.title}</span>
            <span className="sub-line">
              {j.firm} · {j.loc}
            </span>
          </span>
        </a>
      </td>
      <td>{j.vert}</td>
      <td>
        <span className={`pill ${PILL[j.type]}`}>{TYPE_LABEL[j.type]}</span>
      </td>
      <td className="faint num" style={{ whiteSpace: "nowrap" }}>
        {j.posted}
      </td>
    </tr>
  ))
) : (
  <tr>
    <td colSpan={4} className="empty">
      No openings match. Clear the search or pick another filter.
    </td>
  </tr>
)}""")]
    assert not leftovers(r), leftovers(r)
    top = """  const [type, setType] = useState("all");
  const [vert, setVert] = useState("all");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = JOBS.filter(
    (j) =>
      (type === "all" || j.type === type) &&
      (vert === "all" || j.vert === vert) &&
      (!term || `${j.title} ${j.firm} ${j.loc}`.toLowerCase().includes(term)),
  );
  const count = (key: "type" | "vert", val: string) =>
    JOBS.filter((j) =>
      key === "type"
        ? (val === "all" || j.type === val) && (vert === "all" || j.vert === vert)
        : (type === "all" || j.type === type) && (val === "all" || j.vert === val),
    ).length;
  const reset = () => {
    setType("all");
    setVert("all");
    setQ("");
  };"""
    imports = """import { useState } from "react";

import list from "../jobs.json";

type Job = { title: string; firm: string; loc: string; vert: string; type: "full_time" | "internship" | "program"; posted: string; url: string };
const JOBS = list as Job[];
const TYPE_LABEL = { full_time: "Full-time", internship: "Internship", program: "Insight & programs" };
const PILL = { full_time: "pill--plain", internship: "pill--info", program: "pill--warn" };
const mark = (firm: string) =>
  firm
    .split(/\\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();"""
    return section("JobBoard", imports, top, tree_jsx(r, 2), "The job board: role type and vertical filters, search, and the openings table.")


def err_node():
    return Raw('{err && (\n  <p className="status status--error" role="alert">\n    {err}\n  </p>\n)}')


def form_common(r, form_hook, err_hook):
    for n, _ in find(r, lambda n: has(n, form_hook)):
        drop(n, form_hook)
        raw_attr(n, "onSubmit={submit}")
    for n, h in find(r, lambda n: has(n, err_hook)):
        replace(h, n, err_node())
    for n, _ in find(r, lambda n: n.tag == "button" and get(n, "type") == "submit"):
        raw_attr(n, "disabled={busy}")
    for n, _ in find(r, lambda n: has(n, "data-google")):
        drop(n, "data-google")
        raw_attr(n, "onClick={google}")


def make_lecture_form(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    form_common(r, "data-webinar-form", "data-reg-error")
    for n, _ in find(r, lambda n: n.tag == "input" and get(n, "name") == "parent"):
        raw_attr(n, f'onChange={{() => setParent("{get(n, "value")}")}}')
    for n, _ in find(r, lambda n: has(n, "data-parent-fields")):
        drop(n, "data-parent-fields", "hidden")
        raw_attr(n, 'hidden={parent === "no_invite"}')
    assert not leftovers(r), leftovers(r)
    top = """  const [parent, setParent] = useState("no_invite");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = (id: string) => (f.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? "").trim();
    if (!v("rg-first") || !v("rg-email")) {
      setErr("Please fill in your name and email.");
      return;
    }
    if (!EMAIL.test(v("rg-email"))) {
      setErr("Please check your email address.");
      return;
    }
    const phone = v("rg-phone").replace(/\\D/g, "");
    if (phone && phone.length < 7) {
      setErr("Please enter a phone number with the correct country code.");
      return;
    }
    if (parent !== "no_invite" && (!v("rg-pfirst") || !EMAIL.test(v("rg-pemail")))) {
      setErr("Please add your parent or guardian's name and email.");
      return;
    }
    const reg: LectureRegistration = {
      first: v("rg-first"),
      last: v("rg-last"),
      email: v("rg-email"),
      phone: phone ? `${v("rg-cc").replace(/[^+\\d]/g, "")} ${phone}` : "",
      parent,
      parentFirst: v("rg-pfirst"),
      parentLast: v("rg-plast"),
      parentEmail: v("rg-pemail"),
    };
    setErr("");
    setBusy(true);
    const res = await registerForLecture(reg);
    if (res.error) {
      setBusy(false);
      setErr(res.error);
      return;
    }
    saveRegistration(reg);
    window.location.assign("/webinar-registered");
  };"""
    imports = """import { useState, type FormEvent } from "react";

import { EMAIL, registerForLecture, type LectureRegistration } from "../backend";
import { saveRegistration } from "../widgets";"""
    return section("LectureForm", imports, top, tree_jsx(r, 2), "Free lecture sign-up. Sends through registerForLecture() in backend.ts.")


def make_guide_form(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    form_common(r, "data-guide-form", "data-guide-error")
    assert not leftovers(r), leftovers(r)
    top = """  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const name = (f.querySelector<HTMLInputElement>("#tg-name")?.value ?? "").trim();
    const email = (f.querySelector<HTMLInputElement>("#tg-email")?.value ?? "").trim();
    if (!name) {
      setErr("Add your name so we know who to send it to.");
      return;
    }
    if (!EMAIL.test(email)) {
      setErr("Enter a valid email address, like you@university.edu.");
      return;
    }
    setErr("");
    setBusy(true);
    const res = await requestTechnicalsGuide({ name, email });
    if (res.error) {
      setBusy(false);
      setErr(res.error);
      return;
    }
    saveGuideEmail(email);
    window.location.assign("/technicalguide/sent");
  };"""
    imports = """import { useState, type FormEvent } from "react";

import { EMAIL, requestTechnicalsGuide } from "../backend";
import { saveGuideEmail } from "../widgets";"""
    return section("GuideForm", imports, top, tree_jsx(r, 2), "Technicals guide opt-in. Sends through requestTechnicalsGuide() in backend.ts.")


def make_join_form(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    form_common(r, "data-join", "data-join-error")
    for n, _ in find(r, lambda n: has(n, "data-free")):
        drop(n, "data-free")
    assert not leftovers(r), leftovers(r)
    top = """  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = (id: string) => (f.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? "").trim();
    const password = f.querySelector<HTMLInputElement>("#jn-pass")?.value ?? "";
    if (!v("jn-name")) {
      setErr("Add your full name.");
      return;
    }
    if (!EMAIL.test(v("jn-email"))) {
      setErr("Enter a valid email address, like you@university.edu.");
      return;
    }
    if (password.length < 8) {
      setErr("Use a password with at least 8 characters.");
      return;
    }
    setErr("");
    setBusy(true);
    const res = await createAccount({ name: v("jn-name"), email: v("jn-email"), password, school: v("jn-school"), classYear: v("jn-year") });
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    window.location.assign("/");
  };
  const google = async () => {
    const res = await signInWithGoogle();
    if (res.error) setErr(res.error);
  };"""
    imports = """import { useState, type FormEvent } from "react";

import { EMAIL, createAccount, signInWithGoogle } from "../backend";"""
    return section("JoinForm", imports, top, tree_jsx(r, 2), "Create-account form. Sends through createAccount() in backend.ts.")


def make_login(root_el):
    r = ex.El("#root", [])
    r.kids = [root_el]
    for n, h in find(r, lambda n: has(n, "data-sent-open")):
        remove(h, n)
    form_common(r, "data-login", "data-login-error")
    for n, _ in find(r, lambda n: n.tag == "form"):
        raw_attr(n, "hidden={sent !== null}")
    for attr, expr in (("data-login-title", "{TITLE[mode]}"), ("data-login-sub", "{SUB[mode]}"),
                       ("data-sent-what", "{sent?.what}"), ("data-sent-email", "{sent?.email}")):
        for n, _ in find(r, lambda n, a=attr: has(n, a)):
            drop(n, attr)
            n.kids = [Raw(expr, True)]
    for n, _ in find(r, lambda n: n.tag == "button" and get(n, "type") == "submit"):
        n.kids = [Raw("{SUBMIT[mode]}", True)]
    for n, _ in find(r, lambda n: has(n, "data-pw-field")):
        drop(n, "data-pw-field")
        raw_attr(n, 'hidden={mode !== "password"}')
    for n, _ in find(r, lambda n: has(n, "data-mode-link")):
        m = get(n, "data-mode-link")
        drop(n, "data-mode-link", "hidden")
        raw_attr(n, f'hidden={{mode === "{m}"}} onClick={{() => setMode("{m}")}}')
    for n, _ in find(r, lambda n: has(n, "data-login-sent")):
        drop(n, "data-login-sent", "hidden")
        raw_attr(n, "hidden={sent === null}")
    for n, _ in find(r, lambda n: has(n, "data-sent-back")):
        drop(n, "data-sent-back")
        raw_attr(n, "onClick={() => setSent(null)}")
    assert not leftovers(r), leftovers(r)
    top = """  const [mode, setModeState] = useState<Mode>("password");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; what: string } | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "link" || m === "forgot") setModeState(m);
  }, []);
  const setMode = (m: Mode) => {
    setErr("");
    setModeState(m);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const email = (f.querySelector<HTMLInputElement>("#li-email")?.value ?? "").trim();
    if (!EMAIL.test(email)) {
      setErr("Enter the email you signed up with.");
      return;
    }
    if (mode === "password") {
      const password = f.querySelector<HTMLInputElement>("#li-pass")?.value ?? "";
      if (!password) {
        setErr("Enter your password, or choose \\u201cEmail me a sign-in link instead\\u201d.");
        return;
      }
      setBusy(true);
      const res = await signInWithPassword(email, password);
      setBusy(false);
      if (res.error) {
        setErr(res.error);
        return;
      }
      window.location.assign("/");
      return;
    }
    setBusy(true);
    const res = mode === "forgot" ? await sendPasswordReset(email) : await sendSignInLink(email);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setErr("");
    setSent({ email, what: mode === "forgot" ? "a password link" : "a sign-in link" });
  };
  const google = async () => {
    const res = await signInWithGoogle();
    if (res.error) setErr(res.error);
  };"""
    imports = """import { useEffect, useState, type FormEvent } from "react";

import { EMAIL, sendPasswordReset, sendSignInLink, signInWithGoogle, signInWithPassword } from "../backend";

type Mode = "password" | "link" | "forgot";
const TITLE: Record<Mode, string> = { password: "Welcome back", link: "Sign in with a link", forgot: "Reset your password" };
const SUB: Record<Mode, string> = {
  password: "Sign in to your Wall Street Alpha account.",
  link: "We'll email you a secure link. No password needed.",
  forgot: "We'll email you a link to set a new password.",
};
const SUBMIT: Record<Mode, string> = { password: "Sign in", link: "Email me a sign-in link", forgot: "Email me a reset link" };"""
    return section("LoginPanel", imports, top, tree_jsx(r, 2), "Sign-in: password, email link, or password reset. Sends through backend.ts.")


# --------------------------------------------------------------------------- chrome
def chrome_tsx():
    hdr = parse(build.public_header(""))
    for n, h in find(hdr, lambda n: "usermenu" in classes(n)):
        remove(h, n)
    c = Ctx()
    for n, h in find(hdr, lambda n: has(n, "data-when")):
        v = get(n, "data-when")
        drop(n, "data-when", "hidden", "data-home-link")
        replace(h, n, Cond("signedIn" if v == "in" else "!signedIn", n))
    hdr_links = page_links("")
    for n, _ in find(hdr, lambda n: get(n, "href") in hdr_links):
        n.attrs = [(k, hdr_links[v] if k == "href" else v) for k, v in n.attrs]
    for n, _ in find(hdr, lambda n: "menu-btn" in classes(n)):
        drop(n, "aria-expanded")
        raw_attr(n, "aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}")
    for n, _ in find(hdr, lambda n: get(n, "id") == "mobile-panel"):
        drop(n, "class")
        raw_attr(n, 'className={`wrap mobile-panel${menuOpen ? " open" : ""}`}')
    for n, _ in find(hdr, lambda n: n.tag == "nav" and "nav" in classes(n)):
        for a in n.kids:
            if isinstance(a, ex.El) and a.tag == "a":
                raw_attr(a, f'aria-current={{active === "{get(a, "href")}" ? "page" : undefined}}')
    assert not leftovers(hdr), leftovers(hdr)
    foot = parse(build.footer())
    foot_links = page_links("")
    for n, _ in find(foot, lambda n: get(n, "href") in foot_links):
        n.attrs = [(k, foot_links[v] if k == "href" else v) for k, v in n.attrs]
    return f"""import {{ useState }} from "react";

import {{ useViewer }} from "./viewer";

// Header and footer for every page. Converted from the static build (build.py public_header/footer).
// Page links are plain <a> tags, relative to the site root (<base href="/"> in __root.tsx).

export function SiteHeader({{ active = "" }}: {{ active?: string }}) {{
  const {{ signedIn }} = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
{tree_jsx(hdr, 2)}
  );
}}

export function FunnelHeader() {{
  return (
{tree_jsx(parse(build.funnel_header()), 2)}
  );
}}

export function SiteFooter() {{
  return (
{tree_jsx(foot, 2)}
  );
}}

export function FunnelFooter() {{
  return (
{tree_jsx(parse(build.funnel_footer()), 2)}
  );
}}
"""


# --------------------------------------------------------------------------- fixed files
def site_js_block(name):
    return re.search(rf"var {name} = \[(.*?)\];", open(os.path.join(ROOT, "src", "site.js")).read(), re.S).group(1).strip()


WIDGETS = r'''import { useEffect, useRef, useState } from "react";

// Small interactive pieces shared by several pages. Data is inline, so they need no backend.

const L = "/wsa/logos/wins/";

/** The Dean's List: school, school logo, firm, firm logo, role, city */
export const WINS: [string, string, string, string, string, string][] = [
__WINS__
];

type Thread = { t: string; d: string; v: number; c: number; h: number; f: string };
/** Sample forum threads shown on the homepage and the community page */
export const THREADS: Thread[] = [
__THREADS__
];

// full-bleed brand marks fill their tile; white-on-black wordmarks sit on black
const FILL = new Set(["goldman-sachs.jpg", "northwestern.jpg"]);
const DARK = new Set(["blackstone.jpg"]);

function Logo({ file, name, big = false, lazy = false }: { file: string; name: string; big?: boolean; lazy?: boolean }) {
  const cls = ["lg", FILL.has(file) ? "lg--fill" : DARK.has(file) ? "lg--dark" : "", big ? "lg--lg" : ""].filter(Boolean).join(" ");
  return <img className={cls} src={L + file} alt={`${name} logo`} width="36" height="36" loading={lazy ? "lazy" : "eager"} />;
}

/** The Dean's List ticker: slow (26px a second), paused on hover by the stylesheet */
export function Ticker() {
  const belt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = belt.current;
    if (!b) return undefined;
    const setSpeed = () => {
      const w = b.scrollWidth / 2;
      if (w > 0) b.style.animationDuration = `${Math.round(w / 26)}s`;
    };
    setSpeed();
    const t = window.setTimeout(setSpeed, 800);
    return () => window.clearTimeout(t);
  }, []);
  const row = (copy: boolean) =>
    WINS.map(([school, schoolLogo, firm, firmLogo, role, city], i) => (
      <div className="win" key={`${copy ? "b" : "a"}${i}`} aria-hidden={copy || undefined}>
        <span className="win-logos">
          <Logo file={schoolLogo} name={school} />
          <Logo file={firmLogo} name={firm} />
        </span>
        <span className="win-text">
          <span className="win-line">
            <b>{school}</b>
            <span className="to" aria-label="to">
              →
            </span>
            <b>{firm}</b>
          </span>
          <span className="win-role">
            {role}
            {city ? ` · ${city}` : ""}
          </span>
        </span>
      </div>
    ));
  return (
    <div className="belt" ref={belt}>
      {row(false)}
      {row(true)}
    </div>
  );
}

/** Every placement as a card (/deans-list, /webinar123) */
export function WinsGrid() {
  return (
    <div className="wins-grid">
      {WINS.map(([school, schoolLogo, firm, firmLogo, role, city], i) => (
        <article className="wincard" key={i}>
          <div className="from">
            <Logo file={schoolLogo} name={school} lazy />
            <span>{school}</span>
          </div>
          <div className="to-firm">
            <Logo file={firmLogo} name={firm} big lazy />
            <b>{firm}</b>
          </div>
          <span className="role">
            {role}
            {city ? ` · ${city}` : ""}
          </span>
        </article>
      ))}
    </div>
  );
}

/** The first few placements, for side panels */
export function MiniWins({ n = 4 }: { n?: number }) {
  return (
    <div className="mini-wins">
      {WINS.slice(0, n).map(([school, , firm, firmLogo, role], i) => (
        <div key={i}>
          <Logo file={firmLogo} name={firm} />
          <b>{firm}</b>
          <span>
            {school} · {role}
          </span>
        </div>
      ))}
    </div>
  );
}

const ago = (h: number) => (h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`);

export function Threads({ sort, limit = THREADS.length }: { sort: "hot" | "new"; limit?: number }) {
  const rows = THREADS.slice()
    .sort((a, b) => (sort === "new" ? a.h - b.h : b.v - a.v))
    .slice(0, limit);
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
            <a className="t-title" href="community">
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

/** Rotating last line of the /vsl headline. The word is underlined, the full stop isn't. */
export function Rotator({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = window.setInterval(() => setI((x) => (x + 1) % words.length), 1900);
    return () => window.clearInterval(t);
  }, [words.length]);
  return (
    <span className="rotator">
      {words.map((w, k) => {
        const stop = /[.!?]$/.test(w) ? w.slice(-1) : "";
        return (
          <span key={w} className={k === i ? "on" : undefined}>
            <u>{stop ? w.slice(0, -1) : w}</u>
            {stop}
          </span>
        );
      })}
    </span>
  );
}

/** Days/hours/minutes/seconds until a date. Shows 00 until mounted, so the server and browser HTML match. */
export function useCountdown(iso: string) {
  const end = new Date(iso).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (now === null) return { d: "00", h: "00", m: "00", s: "00" };
  const s = Math.max(0, Math.floor((end - now) / 1000));
  return { d: pad(Math.floor(s / 86400)), h: pad(Math.floor((s % 86400) / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
}

// --- remembered on this device between the form and its confirmation page

function read<T>(key: string): T | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the confirmation page falls back to generic text */
  }
}

type SavedRegistration = { name: string; first: string; parent: string; parentFirst: string };

export function saveRegistration(r: { first: string; last: string; parent: string; parentFirst: string }) {
  write("wsa_registration", { name: [r.first, r.last].filter(Boolean).join(" "), first: r.first, parent: r.parent, parentFirst: r.parentFirst });
}

/** The lecture registration from this device (read after mount) */
export function useRegistration() {
  const [reg, setReg] = useState<SavedRegistration | null>(null);
  useEffect(() => setReg(read<SavedRegistration>("wsa_registration")), []);
  return reg;
}

export function saveGuideEmail(email: string) {
  write("wsa_guide", { email });
}

export function useGuideEmail() {
  const [email, setEmail] = useState("your inbox");
  useEffect(() => {
    const g = read<{ email?: string }>("wsa_guide");
    if (g?.email) setEmail(g.email);
  }, []);
  return email;
}

// --- Youform

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Campaign tags from this visit, else the ones remembered from the landing page */
function campaignTags() {
  const params = new URLSearchParams(window.location.search);
  const fresh = new URLSearchParams();
  UTM_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) fresh.set(k, v.slice(0, 200));
  });
  if ([...fresh.keys()].length) {
    write("wsa_utm", fresh.toString());
    return fresh.toString();
  }
  return read<string>("wsa_utm") ?? "";
}

/** A Youform form, embedded the way Youform documents it, with UTMs passed as hidden fields */
export function YouformEmbed({ form, height = 700 }: { form: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.setAttribute("data-params", campaignTags());
    const w = window as Window & { YouformEmbed?: { init?: () => void } };
    if (w.YouformEmbed?.init) {
      w.YouformEmbed.init();
      return undefined;
    }
    let s = document.querySelector<HTMLScriptElement>('script[src="https://app.youform.com/embed.js"]');
    if (!s) {
      s = document.createElement("script");
      s.src = "https://app.youform.com/embed.js";
      s.async = true;
      document.body.appendChild(s);
    }
    const script = s;
    const onLoad = () => w.YouformEmbed?.init?.();
    script.addEventListener("load", onLoad);
    return () => script.removeEventListener("load", onLoad);
  }, [form]);
  return (
    <div
      ref={ref}
      data-youform-embed=""
      data-form={form}
      data-base-url="https://app.youform.com"
      data-width="100%"
      data-height={String(height)}
      style={{ minHeight: `${height}px` }}
    />
  );
}
'''

VIEWER_TS = '''/**
 * Who is looking at the page.
 *
 * Front end only for now: everyone is a signed-out visitor, so the Academy paywall shows on the
 * resource library, the guides and the job board. Connect this to your auth (for example Supabase):
 *   signedIn: there is a session
 *   access:   the user is an Academy student (approved email)
 * The real paywall has to be enforced on the server too (private PDF storage, row-level security on jobs).
 */

/** Set to true to preview the Academy-only screens (job board, guide viewer) while designing. */
export const PREVIEW_ACADEMY_ACCESS = false;

export function useViewer() {
  return { signedIn: PREVIEW_ACADEMY_ACCESS, access: PREVIEW_ACADEMY_ACCESS };
}
'''

BACKEND_TS = '''/**
 * Every place the front end needs a backend. NOTHING HERE IS CONNECTED YET.
 *
 * - Sign-in and sign-up return an error, so visitors see "isn't connected yet".
 * - The lecture sign-up and the technicals guide opt-in return success and show their confirmation
 *   pages, but nothing is sent or stored anywhere. Connect them before this site takes real traffic.
 *   On Chase's live site the lecture sign-up posts to a Zapier hook and the Apple Wallet /claim endpoint.
 */

export type Result = { error?: string };

export const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

export type LectureRegistration = {
  first: string;
  last: string;
  email: string;
  phone: string;
  /** "under_21_invite" | "over_21_invite" | "no_invite" */
  parent: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
};

export async function signInWithPassword(email: string, password: string): Promise<Result> {
  return { error: "Sign-in isn't connected yet." };
}

export async function sendSignInLink(email: string): Promise<Result> {
  return { error: "Email sign-in isn't connected yet." };
}

export async function sendPasswordReset(email: string): Promise<Result> {
  return { error: "Password reset isn't connected yet." };
}

export async function signInWithGoogle(): Promise<Result> {
  return { error: "Google sign-in isn't connected yet." };
}

export async function createAccount(account: {
  name: string;
  email: string;
  password: string;
  school: string;
  classYear: string;
}): Promise<Result> {
  return { error: "Creating accounts isn't connected yet." };
}

/** NOT CONNECTED: shows the ticket page but the registration goes nowhere. */
export async function registerForLecture(registration: LectureRegistration): Promise<Result> {
  return {};
}

/** NOT CONNECTED: shows the "check your inbox" page but no email is sent. */
export async function requestTechnicalsGuide(request: { name: string; email: string }): Promise<Result> {
  return {};
}
'''

CONFIG_TS = '''/**
 * The application and CV forms are Youform forms embedded in /apply, /applydm and /booked.
 * These IDs are Chase's LIVE forms: submissions become real leads and fire his Zapier automations.
 * Swap in your own form IDs if this site isn't his.
 */
export const YOUFORM = {
  apply: "5hers03e",
  applyDm: "2icrdiql",
  cv: "juj0batp",
};
'''

RESCARD_TSX = '''import type { Resource } from "./resources";

/** Library card: the guide's real first page, title, one-line blurb and page count. */
export function ResCard({ r, locked = false }: { r: Resource; locked?: boolean }) {
  return (
    <a className="res" href={r.slug}>
      <span className="res-thumb">
        <img src={r.thumb} alt="" loading="lazy" width="480" height="621" />
        {locked && (
          <span className="res-lock" title="WSA Academy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Academy
          </span>
        )}
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
'''

RESOURCES_TS = '''import list from "./resources.json";

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

/** Library topics, in order */
export const CATS: string[] = __CATS__;

export const resourceBySlug = (slug: string) => RESOURCES.find((r) => r.slug === slug);
'''

PAGE_TSX = '''import type { ReactNode } from "react";

import { FunnelFooter, FunnelHeader, SiteFooter, SiteHeader } from "./chrome";

type Chrome = "public" | "funnel" | "bare";

/**
 * Wraps every page: header, content, footer.
 * data-page lets the stylesheet tune single pages (the homepage drops its demo widgets on phones);
 * display: contents keeps the wrapper out of the page layout.
 */
export function Page({ id = "", chrome = "public", active = "", children }: { id?: string; chrome?: Chrome; active?: string; children: ReactNode }) {
  return (
    <div data-page={id} style={{ display: "contents" }}>
      {chrome === "public" && <SiteHeader active={active} />}
      {chrome === "funnel" && <FunnelHeader />}
      {children}
      {chrome === "public" && <SiteFooter />}
      {chrome === "funnel" && <FunnelFooter />}
    </div>
  );
}
'''

HEAD_TS = '''// Per-page <head>. noindex keeps this copy out of search engines; remove it when the site goes live.
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
'''

README = '''# Wall Street Alpha: front end

The public site: the homepage and every page reachable from it (VSL, the free lecture, the technicals guide,
the resource library and its 55 guides, the job board, the Dean's List, about, the application,
sign-in, student sign-up, terms and privacy). The student and coach portals are not part of it. The community, free
membership and the separate Academy page are switched off for now (`COMMUNITY`, `FREE_MEMBERSHIP` and `ACADEMY_PAGE`
in `wsa-platform/build.py`).

| Where | What |
| --- | --- |
| `src/routes/*.tsx` | One route per page. Page markup is plain JSX inside `<Page>`. |
| `src/routes/$slug.tsx` | The 55 guide pages, from `src/wsa/resources.json` |
| `src/wsa/sections/` | The interactive sections: library, job board, lecture and guide forms, sign-in, sign-up |
| `src/wsa/widgets.tsx` | Dean's List ticker and grid, forum threads, countdown, rotating headline, Youform embed |
| `src/wsa/chrome.tsx` | Header and footer |
| `src/wsa/site.css` | The design system (tokens, components, layouts, light and dark) |
| `public/wsa/` | Images, logos, the guide PDFs and their covers |

## Connecting a backend

- `src/wsa/viewer.ts`: `useViewer()` says whether the visitor is signed in and has Academy access. Everyone is a signed-out
  visitor for now, so the paywall shows. `PREVIEW_ACADEMY_ACCESS = true` previews the Academy-only screens.
- `src/wsa/backend.ts`: sign-in, sign-up, the lecture sign-up and the guide opt-in. None of them is connected yet.
- `src/wsa/config.ts`: the Youform form IDs (Chase's live forms).
'''


def guide_route(resources):
    """The 55 guide pages share one dynamic route, built from a sentinel render of build.py's guide page."""
    S = {"slug": "__SLUG__", "title": "__TITLE__", "desc": "__DESC__", "cat": "__CAT__", "pdf": "__PDF__",
         "thumb": "__THUMB__", "pages": 7777, "size": "__SIZE__", "listed": False}
    before = len(ex.RECORDS)
    build.build_resources([S])
    rec = [r for r in ex.RECORDS[before:] if r["path"] == "__SLUG__"][0]
    del ex.RECORDS[before:]
    tree = parse(rec["body"])
    ctx = Ctx()
    transform(tree, ctx)
    assert not leftovers(tree), leftovers(tree)
    body = tree_jsx(tree, 3)
    field = {"__SLUG__": "r.slug", "__TITLE__": "r.title", "__DESC__": "r.desc", "__CAT__": "r.cat", "__PDF__": "r.pdf",
             "__THUMB__": "r.thumb", "__SIZE__": "r.size"}
    sent = re.compile("|".join(field))

    def attr_tpl(m):
        v = m.group(2)
        if sent.fullmatch(v):
            return m.group(1) + "{" + field[v] + "}"
        return m.group(1) + "{`" + sent.sub(lambda x: "${" + field[x.group(0)] + "}", v) + "`}"
    body = re.sub(r'(=)\{"([^"]*__[A-Z]+__[^"]*)"\}', attr_tpl, body)
    body = re.sub(r'(=)"([^"]*__[A-Z]+__[^"]*)"', attr_tpl, body)
    body = body.replace("7777 pages", "{pagesLabel}")
    body = sent.sub(lambda x: "{" + field[x.group(0)] + "}", body)
    assert not re.findall(r"__[A-Z]+__", body)
    marker = "</section>"
    i = body.index(marker) + len(marker)
    body = body[:i] + """
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
                    <ResCard key={x.slug} r={x} locked={!access} />
                  ))}
                </div>
              </div>
            </section>
          )}""" + body[i:]
    ctx.use("@/wsa/ResCard", "ResCard")
    ctx.use("@/wsa/resources", "RESOURCES", "resourceBySlug")
    ctx.use("@/wsa/Page", "Page")
    ctx.use("@/wsa/head", "wsaHead")
    ctx.viewer()
    imports = "\n".join(['import { createFileRoute, notFound } from "@tanstack/react-router";'] + ctx.import_lines())
    hooks = "\n".join("  " + h for h in ctx.hooks)
    return f"""{imports}

// The 55 guide pages (/coldoutreach, /IB31, ...). Data: src/wsa/resources.json.
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
{hooks}
  const pagesLabel = `${{r.pages}} ${{r.pages === 1 ? "page" : "pages"}}`;
  const related = RESOURCES.filter((x) => x.listed && x.cat === r.cat && x.slug !== r.slug && x.pdf !== r.pdf).slice(0, 4);
  return (
    <Page id="resource" active="resources">
{body}
    </Page>
  );
}}
"""


def main():
    build.page = ex.capture
    resources = build.build_pages()
    recs = {r["path"]: r for r in ex.RECORDS}
    files = {}
    parents = {p.rsplit("/", 1)[0] for p in PUBLIC if "/" in p}
    problems = {}
    for path in PUBLIC:
        r = recs[path]
        if r["redirect"]:  # switched-off page (build.COMMUNITY): keep the address, send it on
            REDIRECTS[path] = "" if r["redirect"] in ("./", "") else r["redirect"]
            continue
        tree = parse(r["body"])
        ctx = Ctx()
        transform(tree, ctx, path)
        left = leftovers(tree)
        if left:
            problems[path] = left
        ctx.use("@/wsa/Page", "Page")
        ctx.use("@/wsa/head", "wsaHead")
        fp, rid = ex.route_file(path, parents)
        comp = "HomePage" if path == "index" else "Page" + re.sub(r"[^A-Za-z0-9]", "", path.title())
        props = []
        if r["pid"]:
            props.append(f'id="{r["pid"]}"')
        if r["chrome"] != "public":
            props.append(f'chrome="{r["chrome"]}"')
        if r["active"]:
            props.append(f'active="{r["active"]}"')
        hooks = "".join("  " + h + "\n" for h in ctx.hooks)
        files[fp] = "\n".join(['import { createFileRoute } from "@tanstack/react-router";'] + ctx.import_lines()) + f"""

export const Route = createFileRoute("{rid}")({{
  head: () => wsaHead({ex.ts(r["title"])}, {ex.ts(r["desc"])}),
  component: {comp},
}});

function {comp}() {{
{hooks}  return (
    <Page{(" " + " ".join(props)) if props else ""}>
{tree_jsx(tree, 3)}
    </Page>
  );
}}
"""
    assert not problems, f"unconverted script hooks: {problems}"
    for src, dst in REDIRECTS.items():
        fp, rid = ex.route_file(src, parents)
        files[fp] = f"""import {{ createFileRoute, redirect }} from "@tanstack/react-router";

// {"Old link, kept so ads, DMs and emails still land somewhere." if src in OLD_LINKS else "Switched off for now (see the switches at the top of wsa-platform/build.py). The address stays and sends visitors on."}
export const Route = createFileRoute("{rid}")({{
  beforeLoad: ({{ location }}) => {{
    throw redirect({{ href: "/{dst}" + location.searchStr, statusCode: {301 if src in OLD_LINKS else 302} }});
  }},
}});
"""
    files["src/routes/$slug.tsx"] = guide_route(resources)
    for name, text in SECTIONS.items():
        files[f"src/wsa/sections/{name}.tsx"] = text
    files["src/wsa/chrome.tsx"] = chrome_tsx()
    files["src/wsa/widgets.tsx"] = WIDGETS.replace("__WINS__", site_js_block("WINS")).replace("__THREADS__", site_js_block("THREADS"))
    files["src/wsa/viewer.ts"] = VIEWER_TS
    files["src/wsa/backend.ts"] = BACKEND_TS
    files["src/wsa/config.ts"] = CONFIG_TS
    files["src/wsa/ResCard.tsx"] = RESCARD_TSX
    files["src/wsa/Page.tsx"] = PAGE_TSX
    files["src/wsa/head.ts"] = HEAD_TS
    cats = recs["resources"]["data"]["cats"]
    files["src/wsa/resources.ts"] = RESOURCES_TS.replace("__CATS__", json.dumps(cats))
    files["src/wsa/resources.json"] = json.dumps([{k: ex.wsa_paths(str(x[k])) if k in ("pdf", "thumb") else x[k]
                                                   for k in ("slug", "title", "desc", "cat", "pdf", "thumb", "pages", "size", "listed")}
                                                  for x in resources], ensure_ascii=False, indent=1) + "\n"
    files["src/wsa/jobs.json"] = json.dumps(recs["jobs"]["data"]["jobs"], ensure_ascii=False, indent=1) + "\n"
    files["src/wsa/site.css"] = ex.wsa_paths(open(os.path.join(ROOT, "src", "site.css")).read())
    files["src/styles.css"] = ex.STYLES_CSS
    root_tsx = ex.ROOT_TSX.replace("__FONTS__", build.FONTS)
    if not build.COMMUNITY:
        root_tsx = root_tsx.replace("Recruiting coaching, free resources and a community for students", "Recruiting coaching and free resources for students")
    files["src/routes/__root.tsx"] = root_tsx
    files["WSA-FRONTEND.md"] = README

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for rel, text in files.items():
        fp = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        open(fp, "w").write(text)
    src_assets = os.path.join(ROOT, "assets")
    for dp, _, fn in os.walk(src_assets):
        for f in fn:
            if f.startswith("."):
                continue
            s = os.path.join(dp, f)
            d = os.path.join(OUT, "public", "wsa", os.path.relpath(s, src_assets))
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copy2(s, d)
    routes = [k for k in files if k.startswith("src/routes/") and not k.endswith("__root.tsx")]
    print(f"{OUT}: {len(routes)} routes ({len(PUBLIC)} pages, {len(REDIRECTS)} redirects, 1 guide route), "
          f"{len(SECTIONS)} sections: {', '.join(sorted(SECTIONS))}")


if __name__ == "__main__":
    main()
