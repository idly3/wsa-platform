#!/usr/bin/env python3
"""Build the Wall Street Alpha preview site into dist/.

    python3 build.py --base /wsa-preview-d45eb9/

Every page is a plain .html file. Links are relative and resolve through <base href>, so the
site works under any path prefix. The host must map /slug to slug.html (Caddy: try_files
{path} {path}.html {path}/index.html; Vercel: cleanUrls; Netlify does it by default).
"""
import html
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
BASE = "/"
if "--base" in sys.argv:
    BASE = sys.argv[sys.argv.index("--base") + 1]
    if not BASE.endswith("/"):
        BASE += "/"

LECTURE_ISO = "2026-10-24T18:00:00Z"  # Sat 24 Oct 2026, 2:00 pm New York
LECTURE_WHEN = "Saturday, October 24 · 2:00 PM ET"
WALLET_PAGE = "https://wallet.withfulcrum.tech/e/yJxqVNl4ayGx"
INSTAGRAM = "https://www.instagram.com/channel/5bm5aIinlRcnvCoi/"
WISTIA_VSL = "https://fast.wistia.net/embed/iframe/gm87jdzq26"
CAL_GOOGLE = "https://us05web.zoom.us/webinar/tZwkcOyvqzkrH9AALN6RTMnx3zKC3-mjYFIj/calendar/google/add"
CAL_OUTLOOK = "https://us05web.zoom.us/webinar/88975752154#:~:text=Outlook%20Calendar%20(.ics)"
CAL_YAHOO = ("https://calendar.yahoo.com/?v=60&VIEW=d&TITLE=Chase%27s%20Placement%20Playbook%3A%20Live%20Lecture"
             "&in_loc=https%3A%2F%2Fus06web.zoom.us%2Fs%2F88975752154&URL=https%3A%2F%2Fus06web.zoom.us%2Fs%2F88975752154"
             "&ST=20261024T180000Z&DUR=0115&DESC=Live%20lecture%20with%20Chase%20Enloe.%20Join%3A%20https%3A%2F%2Fus06web.zoom.us%2Fs%2F88975752154")
CONTACT = "Chase@wallstalpha.com"
PLACED = "250+"

e = html.escape
PAGES = []  # (path, html)


# --------------------------------------------------------------------------- icons
def svg(name, cls=""):
    p = {
        "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
        "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
        "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        "pipeline": '<path d="M4 6h16M4 12h10M4 18h6"/>',
        "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        "book": '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
        "layers": '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
        "flag": '<path d="M5 21V4h11l-2 4 2 4H5"/>',
        "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
        "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        "file": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
        "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        "home": '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
        "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
        "dollar": '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        "briefcase": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        "chat": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
        "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        "play": '<path d="M7 4v16l13-8z" fill="currentColor"/>',
        "up": '<path d="M12 5l8 11H4z" fill="currentColor" stroke="none"/>',
        "x": '<path d="M6 6l12 12M18 6 6 18"/>',
        "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
        "download": '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    }[name]
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p}</svg>')


GOOGLE_G = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/>'
            '<path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/>'
            '<path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/>'
            '<path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>')
WALLET_ICON = ('<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" fill="#fff"/>'
               '<rect x="4" y="7" width="16" height="3" rx="1" fill="#2D9BF0"/><rect x="4" y="10" width="16" height="3" rx="1" fill="#F5B826"/>'
               '<rect x="4" y="13" width="16" height="3" rx="1" fill="#E5484D"/></svg>')


def paywall(next_slug, what="The resource library", what_in="the resource library"):
    """Shown to anyone without Academy access: signed out, or signed in on a free account."""
    return f"""<div class="gate" data-access="no">
  <span class="lock">{svg('lock')}</span>
  <div class="stack-sm"><b>For WSA Academy students</b>
    <span class="muted" data-when="out">{what} is for WSA Academy students. Students log in with the email their mentor approved.</span>
    <span class="muted" data-when="in" hidden>Your {"free " if FREE_MEMBERSHIP else ""}account doesn't include {what_in}. It comes with the WSA Academy.</span></div>
  <div class="row-wrap"><a class="btn btn--solid btn--sm" href="apply">Apply now {arrow()}</a>
    <a class="btn btn--ghost btn--sm" href="login?next={next_slug}" data-when="out">Student log in</a>
    <a class="btn btn--ghost btn--sm" href="{"membership" if FREE_MEMBERSHIP else "academy" if ACADEMY_PAGE else "apply"}" data-when="in" hidden>{"What the Academy adds" if FREE_MEMBERSHIP or ACADEMY_PAGE else "Apply now"}</a></div>
</div>"""


def ticks(items):
    return '<ul class="ticks">' + "".join(f"<li>{svg('check')}<span>{i}</span></li>" for i in items) + "</ul>"


def arrow():
    return '<span class="arr" aria-hidden="true">→</span>'


# --------------------------------------------------------------------------- chrome
FONTS = ("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600"
         "&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap")

# Switched off for now. Turning one back on restores its pages, menu items and copy.
COMMUNITY = False        # the forum: /community, its menu item and the homepage section
FREE_MEMBERSHIP = False  # free accounts: "Join free" buttons, the free tier, /membership
ACADEMY_PAGE = False     # the /academy "Find out more" page; off means every route into the program is Apply now

NAV = ([("academy", "Academy")] if ACADEMY_PAGE else []) + [("resources", "Resources"), ("jobs", "Jobs")] + ([("community", "Community")] if COMMUNITY else []) + [("webinar123", "Free Lecture")]


def head(title, desc):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="{BASE}">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="assets/wsa-bull.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="assets/site.css">
</head>"""


def preview_bar():
    return ('<div class="preview-bar"><div class="wrap"><b>Preview</b><span>Review build. Sign-ins and lecture sign-ups are simulated. '
            'The application and CV forms are the live Youform forms, so anything submitted there is real.</span><button type="button">Hide</button></div></div>')


def user_menu(extra=""):
    return f"""<div class="usermenu" data-when="in" hidden>
  <button type="button" aria-expanded="false" aria-label="Account menu"><span class="avatar" data-user-initials></span></button>
  <div class="menu" hidden>
    <div class="who"><b data-user-name></b><span data-user-email></span></div>
    <a data-home-link href="dashboard">My dashboard</a>{extra}
    <a href="dashboard/profile">Profile</a>
    <button type="button" data-logout>Log out</button>
  </div>
</div>"""


def public_header(active=""):
    links = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == active else ""}>{t}</a>' for h, t in NAV)
    mlinks = "".join(f'<a href="{h}">{t}</a>' for h, t in NAV + [("deans-list", "Dean's List")])
    return f"""<header class="header">
  <div class="wrap bar">
    <a class="brand" href="./" aria-label="Wall Street Alpha home"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="156" height="48"></a>
    <nav class="nav" aria-label="Main">{links}</nav>
    <div class="bar-right">
      <a class="link" href="login" data-when="out">Log in</a>
      {'<a class="btn btn--solid btn--sm" href="join" data-when="out">Join free</a>' if FREE_MEMBERSHIP else '<a class="btn btn--solid btn--sm" href="apply" data-when="out">Apply now</a>'}
      <a class="btn btn--ghost btn--sm" data-home-link href="dashboard" data-when="in" hidden>Dashboard</a>
      {user_menu()}
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-panel" aria-label="Open menu">{svg('menu')}</button>
    </div>
  </div>
  <div class="wrap mobile-panel" id="mobile-panel">{mlinks}</div>
</header>"""


def funnel_header():
    return """<header class="header"><div class="wrap bar" style="height:68px">
  <a class="brand" href="./" aria-label="Wall Street Alpha home"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="156" height="48"></a>
</div></header>"""


DISCLAIMER = ("Disclaimer: Wall Street Alpha provides recruiting coaching and preparation. It does not guarantee employment, "
              "interviews, or offers. Founder credentials describe prior individual experience and imply no affiliation with "
              "or endorsement by any named firm.")


def footer():
    cols = [
        ("Program", ([("academy", "WSA Academy"), ("apply", "Apply"), ("vsl", "Book a strategy call")] if ACADEMY_PAGE else [("apply", "Apply now")]) + [("deans-list", "Dean's List"), ("about", "About Chase")]),
        ("Free", [("webinar123", "Live lecture"), ("technicalguide", "Technicals guide"), ("resources", "Resource library"), ("jobs", "Job board")]),
        ("Members", ([("community", "Community")] if COMMUNITY else []) + [("login", "Log in")] + ([("join", "Create account")] if FREE_MEMBERSHIP else []) + [("dashboard", "Student portal"), ("coach", "Coach portal")]),
        ("Legal", [("terms", "Terms of Service"), ("privacy", "Privacy Policy"), (f"mailto:{CONTACT}", "Contact")]),
    ]
    c = "".join('<div class="foot-col"><span class="label">' + t + "</span>" + "".join(f'<a href="{h}">{n}</a>' for h, n in ls) + "</div>" for t, ls in cols)
    return f"""<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div><a class="brand" href="./" aria-label="Wall Street Alpha home"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="156" height="48"></a>
        <p>{"Recruiting coaching, free resources and a community for students" if COMMUNITY else "Recruiting coaching and free resources for students"} breaking into investment banking, markets and the buy side.</p></div>
      {c}
    </div>
    <p class="disclaimer">{DISCLAIMER}</p>
    <div class="legal"><span>© 2026 Wall Street Alpha, LLC. All rights reserved.</span><span>{CONTACT}</span></div>
  </div>
</footer>"""


def funnel_footer():
    return f"""<footer><div class="wrap">
  <p class="disclaimer" style="margin-top:0">{DISCLAIMER}</p>
  <div class="legal"><span>© 2026 Wall Street Alpha, LLC.</span><span><a class="textlink" href="privacy">Privacy</a> · <a class="textlink" href="terms">Terms</a> · {CONTACT}</span></div>
</div></footer>"""


# Every "Apply" button sends people to the VSL page first. The VSL page is the only one that links straight to the form.
APPLY_VIA_VSL = True
APPLY_DIRECT = {"vsl"}


def apply_links(path, html):
    if APPLY_VIA_VSL and path not in APPLY_DIRECT:
        return html.replace('href="apply"', 'href="vsl"')
    return html


def page(path, title, desc, body, *, pid="", active="", chrome="public", require=None, data=None, redirect=None, app=False, inline_js=""):
    attrs = f' data-page="{pid}"' if pid else ""
    if require:
        attrs += f' data-require="{require}"'
    if redirect:
        attrs += f' data-redirect="{redirect}"'
    top = {"public": preview_bar() + public_header(active), "funnel": preview_bar() + funnel_header(),
           "bare": preview_bar(), "app": preview_bar()}[chrome]
    bottom = {"public": footer(), "funnel": funnel_footer(), "bare": "", "app": ""}[chrome]
    dat = f'<script type="application/json" id="wsa-data">{json.dumps(data, ensure_ascii=False)}</script>' if data else ""
    refresh = f'<meta http-equiv="refresh" content="1;url={redirect}">' if redirect else ""
    scripts = ('<script src="assets/db.js" defer></script>\n'
               + (f"<script>{inline_js}</script>\n" if inline_js else "")
               + '<script src="assets/site.js" defer></script>\n'
               + ('<script src="assets/app.js" defer></script>\n' if app else ""))
    if not redirect:
        top, body, bottom = apply_links(path, top), apply_links(path, body), apply_links(path, bottom)
    doc = (head(title, desc).replace("</head>", refresh + "</head>") + f"\n<body{attrs}>\n{top}\n{body}\n{bottom}\n{dat}"
           + scripts + "</body>\n</html>\n")
    PAGES.append((path, doc))


def band(h2, p, ctas):
    return f"""<section class="band closing"><div class="wrap closing-inner">
  <div><h2>{h2}</h2><p>{p}</p></div>
  <div class="ctas">{ctas}</div>
</div></section>"""


def page_hero(label, h1, sub, extra="", crumbs=None):
    cr = ""
    if crumbs:
        cr = '<nav class="crumbs" aria-label="Breadcrumb">' + ' <span aria-hidden="true">/</span> '.join(
            f'<a href="{h}">{t}</a>' if h else f"<span>{t}</span>" for h, t in crumbs) + "</nav>"
    return f"""<section class="page-hero"><div class="wrap">{cr}
  <span class="label">{label}</span>
  <h1 class="h1">{h1}</h1>
  <p class="sub">{sub}</p>{extra}
</div></section>"""


# --------------------------------------------------------------------------- shared blocks
def ticker(head_label="The Dean's List"):
    return f"""<section class="ticker" aria-label="{head_label}">
  <div class="wrap ticker-head"><span class="label">{head_label}</span><a href="deans-list">See the full list →</a></div>
  <div class="belt" data-belt></div>
</section>"""


CAREER = [("northwestern", "Northwestern", "B.A. Economics"), ("deutsche-bank", "Deutsche Bank", "Investment Banking"),
          ("magnetar", "Magnetar", "Portfolio Mgmt"), ("morgan-stanley", "Morgan Stanley", "Sales &amp; Trading"),
          ("bayview", "Bayview", "Private Credit"), ("chicago-booth", "Chicago Booth", "MBA")]


def career_row():
    return '<ol class="career" aria-label="Career journey">' + "".join(
        f'<li><span class="logo-tile"><img src="assets/logos/{f}.png" alt=""></span><b>{n}<small>{r}</small></b></li>' for f, n, r in CAREER) + "</ol>"


def coach_section(link=True):
    more = '<a class="btn btn--ghost btn--sm" href="about">More about Chase ' + arrow() + "</a>" if link else ""
    return f"""<section class="section section--sunk"><div class="wrap coach-grid">
  <figure class="portrait"><img src="assets/chase-skyline.jpg" alt="Chase Enloe in a dark suit in front of a city skyline" loading="lazy">
    <figcaption><b>Chase Enloe</b>Founder, Wall Street Alpha · CFA</figcaption></figure>
  <div class="coach-copy">
    <span class="label">Your coach</span>
    <h2 class="h2" style="font-size:clamp(28px,3.6vw,42px)">I've been the kid with no connections, and the guy in the room deciding.</h2>
    <p>I grew up far from Wall Street, without a family connection or a target-school pipeline, and had to learn exactly how the door opened. That led to Deutsche Bank, Magnetar, Morgan Stanley, private credit, a Chicago Booth MBA and the CFA charter.</p>
    <blockquote>"You get one shot per recruiting cycle. You shouldn't be guessing."</blockquote>
    {career_row()}
    <div class="ctas">{more}</div>
  </div>
</div></section>"""


def cover(size=""):
    return f"""<div class="cover{' cover--' + size if size else ''}" role="img" aria-label="Cover of Chase's Placement Playbook: Technicals Guide">
  <img class="ghost" src="assets/wsa-bull.png" alt="">
  <span class="kicker">Wall Street Alpha</span>
  <h4>Chase's Placement Playbook <em>Technicals Guide</em></h4>
  <span class="rule"></span>
  <span class="by">By Chase Enloe, CFA</span>
</div>"""


def board():
    return """<aside class="board" aria-label="Example recruiting board">
  <div class="board-top"><h3>Recruiting board</h3><span class="tag">Summer 2028</span><span class="tag">Example</span></div>
  <ul class="rows">
    <li class="row"><span class="firm">Guggenheim</span><span class="pill pill--gain">Offer</span><span class="next">Signed Sep 14</span></li>
    <li class="row"><span class="firm">Moelis &amp; Co.</span><span class="pill pill--info">Superday</span><span class="next">Mock with Chase, Thu</span></li>
    <li class="row"><span class="firm">Centerview</span><span class="pill pill--info">First round</span><span class="next">Drill M&amp;A questions</span></li>
    <li class="row"><span class="firm">J.P. Morgan</span><span class="pill pill--warn">HireVue</span><span class="next">Submitted Oct 2</span></li>
    <li class="row"><span class="firm">PJT Partners</span><span class="pill pill--plain">Coffee chat</span><span class="next">Follow-up due Fri</span></li>
  </ul>
  <div class="board-split">
    <div><span class="label">Technicals</span>
      <div class="meter">Accounting<span class="track"><i style="width:92%"></i></span><b>92</b></div>
      <div class="meter">Valuation<span class="track"><i style="width:81%"></i></span><b>81</b></div>
      <div class="meter">DCF<span class="track"><i style="width:68%"></i></span><b>68</b></div>
      <div class="meter">LBO<span class="track"><i style="width:44%"></i></span><b>44</b></div>
      <div class="meter">M&amp;A<span class="track"><i style="width:57%"></i></span><b>57</b></div></div>
    <div><span class="label">Outreach · Oct</span>
      <div class="funnel"><div>Emails sent <b>48</b></div><div>Replies <b>19</b></div><div>Calls booked <b>11</b></div></div></div>
  </div>
  <div class="next-up"><i class="dot" aria-hidden="true"></i><span>Next:</span><strong>Mock superday · Thu 7:00 pm ET</strong></div>
</aside>"""


def events_card():
    return f"""<div class="side-card">
  <span class="label">Live this month</span>
  <div class="event"><div class="cal"><span>Sat</span><b>24</b></div><div><strong>Live lecture: Chase's Placement Playbook, with guest lecturer Chase Enloe</strong><small>2:00 pm ET · Free · <a class="textlink" href="webinar123">Get a ticket</a></small></div></div>
  <div class="event"><div class="cal"><span>Thu</span><b>29</b></div><div><strong>Mock superday</strong><small>7:00 pm ET · Academy members</small></div></div>
  <div class="event"><div class="cal"><span>Sun</span><b>1</b></div><div><strong>Resume teardown, live</strong><small>6:00 pm ET · Open to members</small></div></div>
</div>"""


PILLARS = f"""<div class="pillars">
  <article class="pillar">
    <span class="step">01 · NETWORK</span>
    <h3>Get in front of the people who pass your name along.</h3>
    <p>Alumni lists by school and firm, cold emails that get answered, and a log that tells you who to follow up with this week.</p>
    <div class="widget" aria-label="Example outreach log">
      <div class="widget-title"><span>Outreach log</span><span>This week</span></div>
      <div class="log"><span>Moelis analyst, Indiana '24</span><span class="pill pill--gain">Replied</span></div>
      <div class="log"><span>PJT associate, Babson '21</span><span class="pill pill--info">Call booked</span></div>
      <div class="log"><span>Evercore analyst, UNC '23</span><span class="pill pill--warn">Follow up</span></div>
    </div>
    <a class="textlink" href="coldoutreach">Get the cold outreach script →</a>
  </article>
  <article class="pillar">
    <span class="step">02 · TECHNICALS</span>
    <h3>Answer out loud, under pressure.</h3>
    <p>Technicals across accounting, valuation, DCF, LBO and M&amp;A, with study plans that tell you what to drill tonight.</p>
    <div class="widget">
      <div class="widget-title"><span>Accounting</span><span>Practice question</span></div>
      <p class="q">Depreciation goes up by $10. Walk me through the three statements.</p>
      <button class="reveal" type="button" aria-expanded="false" data-reveal="ans-dep">Show answer</button>
      <p class="answer" id="ans-dep" hidden>Operating income falls $10; at a 25% tax rate net income falls $7.50. On the cash flow statement you add back the $10, so cash rises $2.50. PP&amp;E is down $10 and cash up $2.50, so assets fall $7.50, matched by retained earnings.</p>
    </div>
    <a class="textlink" href="technicalguide">Get the free technicals guide →</a>
  </article>
  <article class="pillar">
    <span class="step">03 · PRESENTATION</span>
    <h3>Be the person they want to sit next to.</h3>
    <p>Live mock interviews and mock superdays with people who have run real ones, plus line-by-line feedback on your story.</p>
    <div class="widget" aria-label="Example mock interview scorecard">
      <div class="widget-title"><span>Mock scorecard</span><span>"Why banking?"</span></div>
      <div class="score">Story<span class="pips"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span></div>
      <div class="score">Delivery<span class="pips"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span></div>
      <div class="score">Technicals<span class="pips"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span></div>
      <p class="note">Cut the first 40 seconds. Open with the deal you followed.</p>
    </div>
    {'<a class="textlink" href="academy">See how coaching works →</a>' if ACADEMY_PAGE else '<a class="textlink" href="apply">Apply now →</a>'}
  </article>
</div>"""


# --------------------------------------------------------------------------- data
RESOURCE_CATS = {
    "Recruiting playbooks": ["IB31", "ibresource31", "sophomore", "offer", "freshmanperoadmap", "privatecredit", "learnprivatecredit",
                             "securitized", "securitization", "quant", "remotework", "target", "31stock", "ten", "freelist"],
    "Networking & outreach": ["coldoutreach", "stieremails", "four", "outreach", "coworknetwork", "networking", "networkingcall", "scrape"],
    "Interviews & technicals": ["IB12", "interviewprep", "gs", "testguide", "6models", "6excel", "indicator", "stockfind", "mindset"],
    "Resumes & applications": ["resume", "resumetips", "blackstone", "essay", "certificate", "aicerts"],
    "Firms, pay & roles": ["banks", "gsvsms", "payscale", "tiers", "analystbudget", "role", "hourly", "alpha", "tradingdesks", "job", "saturdays"],
    "Reading & videos": ["elitebooks", "msbooks", "jpbooks", "ibvids", "crackedvideos", "triage"],
}
TITLE_FIX = {"resume": "Example Finance Resume", "four": "Four Outreach Messages", "outreach": "Four Outreach Messages",
             "job": "The Trading Floor", "alpha": "Comp vs. Hours", "freelist": "The Free Resource List",
             "certificate": "Ten Finance Certificates", "triage": "Book Triage Guide",
             "role": "Front-Office Role Breakdown", "hourly": "Front-Office Role Breakdown",
             "networkingcall": "Networking Call Guide (Long Version)", "essay": "Blackstone Early Insights Essay (Example 2)"}
# Same PDF as another slug (four/outreach, role/hourly) or an earlier draft of one (alpha, job):
# the page stays for old links, the library lists it once.
HIDE_FROM_LIBRARY = {"outreach", "hourly", "alpha", "job"}
BLURB_FIX = {
    "aicerts": "Five free certificates for breaking into finance in the age of AI.",
    "alpha": "What each seat actually pays you per hour once you count the hours.",
    "certificate": "Ten certificates worth adding to your resume, from Bloomberg ESG to the Forage banking job simulations.",
    "essay": "A second real example essay from the Blackstone Early Insights application.",
    "freelist": "The free recruiting resources worth using, and what each one is for.",
    "gs": "The Goldman Sachs interview process, how to prepare, and the questions that come up most.",
    "hourly": "All-in first-year comp against real weekly hours for five front-office seats, and what you're buying with them.",
    "job": "What each desk on the trading floor actually owns.",
    "learnprivatecredit": "The fundamentals, market mechanics and career paths in private credit.",
    "payscale": "Banks grouped into pay tiers, so you know what each offer is worth.",
    "resume": "An example investment banking resume that gets interviews.",
    "role": "All-in first-year comp against real weekly hours for five front-office seats, and what you're buying with them.",
    "saturdays": "Five seats ranked by the weekends they cost you.",
    "scrape": "How to set up your alumni tracker so every contact and follow-up lives in one place.",
    "stockfind": "A step-by-step process for finding undervalued stocks.",
    "triage": "Understand a book without reading all of it: three questions for a 30-minute pass.",
}


def clean_blurb(slug, d):
    """Drop the 'Download the Wall Street Alpha X PDF:' lead-in every live description starts with."""
    if slug in BLURB_FIX:
        return BLURB_FIX[slug]
    m = re.match(r"^(?:Download|View|Read|Watch)\b[^:]*:\s*(.+)$", d)
    if not m:
        return d
    t = m.group(1).strip()
    return t[0].upper() + t[1:]


def pdf_pages(fp):
    b = open(fp, "rb").read()
    counts = [int(x) for x in re.findall(rb"/Type\s*/Pages\b[^>]*?/Count\s+(\d+)", b)] + \
             [int(x) for x in re.findall(rb"/Count\s+(\d+)[^>]*?/Type\s*/Pages\b", b)]
    return max(counts) if counts else len(re.findall(rb"/Type\s*/Page[^s]", b))


def load_resources():
    raw = json.load(open(os.path.join(ROOT, "data", "resources.json")))
    cat_of = {s: c for c, ss in RESOURCE_CATS.items() for s in ss}
    out = []
    for slug, r in raw.items():
        fp = os.path.join(ROOT, "assets", "resources", slug + ".pdf")
        out.append({"slug": slug, "title": TITLE_FIX.get(slug, r["title"]), "desc": clean_blurb(slug, r["desc"]),
                    "pdf": f"assets/resources/{slug}.pdf", "thumb": f"assets/resources/thumbs/{slug}.jpg",
                    "pages": pdf_pages(fp), "size": f"{max(1, round(os.path.getsize(fp) / 1024))} KB" if os.path.getsize(fp) < 1024 * 1024 else f"{os.path.getsize(fp) / 1048576:.1f} MB",
                    "cat": cat_of[slug], "listed": slug not in HIDE_FROM_LIBRARY})
    order = {c: i for i, c in enumerate(RESOURCE_CATS)}
    out.sort(key=lambda r: (order[r["cat"]], RESOURCE_CATS[r["cat"]].index(r["slug"])))
    return out


MS = "https://ms.wd5.myworkdayjobs.com/en-US/External/job/"
P72 = "https://boards.greenhouse.io/point72/jobs/"
JOBS = [
    # title, firm, location, vertical, type, posted, url
    ("Research, Equity Research – Business Services", "Morgan Stanley", "London", "Research", "full_time", "Today", MS + "London-United-Kingdom/Research--Equity-Research---Business-Services_JR041816"),
    ("Equity Capital Markets, Analyst / Sr Analyst, Investment Banking Division", "Morgan Stanley", "Mumbai", "Investment Banking", "full_time", "Today", MS + "Mumbai-India/Equity-Capital-Market-Analyst-Sr-Analyst--Investment-Banking-Division_JR037789-1"),
    ("Analyst / Senior Analyst, Debt Capital Markets", "Morgan Stanley", "Mumbai", "Investment Banking", "full_time", "Today", MS + "Mumbai-India/Analyst--Senior-Analyst---Debt-Capital-Market---GCM_JR037788-1"),
    ("Munis Sales Trading, Associate, Fixed Income Division", "Morgan Stanley", "Mumbai", "Sales & Trading", "full_time", "Today", MS + "Mumbai-India/Munis-Sales-Trading--Associate-Senior-Associate--Fixed-Income-Division_JR041683"),
    ("Munis Desk Credit Analyst, Fixed Income Division", "Morgan Stanley", "Mumbai", "Credit", "full_time", "Today", MS + "Mumbai-India/Munis-Desk-Credit-Analyst--Associate--Fixed-Income-Division_JR041678"),
    ("PhD Quantitative Strat, Institutional Equity, Vice President", "Morgan Stanley", "New York", "Quant", "full_time", "2 days ago", MS + "New-York-New-York-United-States-of-America/PhD-Quantitative-Strat---Institutional-Equity---Vice-President_JR041783"),
    ("Investment Analyst, Parametric", "Morgan Stanley", "Minneapolis", "Asset Management", "full_time", "2 days ago", MS + "Minneapolis-Minnesota-United-States-of-America/Investment-Analyst---Parametric_PT-JR041606-1"),
    ("Real Estate Investment Group, Financial Analyst", "Morgan Stanley", "Boston", "Asset Management", "full_time", "2 days ago", MS + "Boston-Massachusetts-United-States-of-America/Real-Estate-Investment-Group---Financial-Analyst_JR041580"),
    ("Analyst Assistant, FIG Coverage, Investment Banking Division", "Morgan Stanley", "Tokyo", "Investment Banking", "full_time", "2 days ago", MS + "Tokyo-Japan/Analyst-Assistant--FIG-Coverage--Investment-Banking-Division_JR041742"),
    ("Investment Banking Associate, Investment Banking Division", "Morgan Stanley", "Mumbai", "Investment Banking", "full_time", "2 days ago", MS + "Mumbai-India/Investment-Banking--Associate----Investment-Banking-Division_JR037785"),
    ("OCIO Endowments & Foundations Portfolio Manager, Vice President", "Morgan Stanley", "New York", "Asset Management", "full_time", "2 days ago", MS + "New-York-New-York-United-States-of-America/Global-Investment-Office--OCIO-UHNW-Portfolio-Manager--Vice-President_PT-JR039516"),
    ("Private Market Sales, Wealth Clients, Associate", "Morgan Stanley", "London", "Asset Management", "full_time", "2 days ago", MS + "London-United-Kingdom/Investment-Management---Private-Market-Sales-Professional---Wealth-Clients---Associate_JR040678"),
    ("Associate, Capital Planning (CCAR)", "Morgan Stanley", "New York", "General Finance", "full_time", "2 days ago", MS + "New-York-New-York-United-States-of-America/Associate--Capital-Planning--CCAR-_PT-JR041418-1"),
    ("Macro Research, FX Strategist, Analyst / Associate", "Morgan Stanley", "New York", "Research", "full_time", "5 days ago", MS + "New-York-New-York-United-States-of-America/Macro-Research--FX-Strategist---Analyst-Associate_JR041637-2"),
    ("FID UK Inflation Trader", "Morgan Stanley", "London", "Sales & Trading", "full_time", "5 days ago", MS + "London-United-Kingdom/FID---UK-Inflation-Trader-LN_JR041630"),
    ("MSIM Municipal Research, Analyst", "Morgan Stanley", "Boston", "Research", "full_time", "5 days ago", MS + "Boston-Massachusetts-United-States-of-America/MSIM---Municipal-Research---Analyst_JR041420"),
    ("Vice President, Credit Review", "Morgan Stanley", "New York", "Credit", "full_time", "5 days ago", MS + "New-York-New-York-United-States-of-America/Vice-President--Credit-Review_PT-JR041527-1"),
    ("Point72 Academy Investment Analyst Program, Upcoming Graduates (2027, US)", "Point72", "Chicago, Florida, New York, San Francisco", "Hedge Funds", "program", "May 8", P72 + "8541241002?gh_jid=8541241002"),
    ("Point72 Academy Investment Analyst Program, Upcoming Graduates (2027, UK)", "Point72", "London", "Hedge Funds", "program", "May 14", P72 + "8549734002?gh_jid=8549734002"),
    ("Point72 Academy Investment Analyst Program, Experienced Professionals (US)", "Point72", "Chicago, Florida, New York, San Francisco", "Hedge Funds", "program", "Apr 9", P72 + "8499113002?gh_jid=8499113002"),
    ("2027 Point72 Academy Investment Analyst Summer Internship, Hong Kong", "Point72", "Hong Kong", "Hedge Funds", "internship", "Apr 2", P72 + "8491055002?gh_jid=8491055002"),
    ("Summer 2027 Quantitative Research Internship", "Point72", "New York", "Quant", "internship", "Aug 15", P72 + "7297642002?gh_jid=7297642002"),
    ("Quantitative Researcher Intern", "Point72", "New York", "Quant", "internship", "Aug 15", P72 + "7586061002?gh_jid=7586061002"),
    ("Quantitative Developer Intern", "Point72", "New York", "Quant", "internship", "Aug 23", P72 + "7609197002?gh_jid=7609197002"),
    ("Machine Learning Researcher, Intern", "Point72", "New York", "Quant", "internship", "Aug 15", P72 + "7302611002?gh_jid=7302611002"),
    ("Corporate Access, Off-Cycle Internship (6 months), Japanese speaking", "Point72", "Hong Kong", "Hedge Funds", "internship", "Jun 24", P72 + "8603979002?gh_jid=8603979002"),
    ("2026 Operational Risk Internship", "Schonfeld", "São Paulo", "General Finance", "internship", "Jul 2", "https://job-boards.greenhouse.io/schonfeld/jobs/8044346"),
    ("Quantitative Research / Developer, Intern", "Schonfeld", "Hong Kong", "Quant", "internship", "Aug 22", "https://job-boards.greenhouse.io/schonfeld/jobs/7185553"),
    ("2027 Real Estate Finance, Off-Cycle Intern (January to June)", "Blackstone", "Singapore", "Private Equity", "internship", "Recently", "https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Campus_Careers/job/Singapore/XMLNAME-2027-Real-Estate-Finance--Off-Cycle-Intern--January-to-June---Singapore_44173"),
    ("2027 Transaction Finance, Off-Cycle Intern (January to June)", "Blackstone", "Hong Kong", "Private Equity", "internship", "Recently", "https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Campus_Careers/job/Hong-Kong/XMLNAME-2027-Transaction-Finance-Off-cycle-Intern--January-to-June--Hong-Kong_44171"),
    ("Intern, Wealth Management", "Morgan Stanley", "Newport, Rhode Island", "Wealth Management", "internship", "7 days ago", MS + "Newport-Rhode-Island-United-States-of-America/Intern_JR040738"),
]

# --------------------------------------------------------------------------- public pages
def build_home():
    HERO_SUB = ("1:1 coaching, a library of recruiting guides, a live job board and a community of students and analysts in the same cycle as you."
                if COMMUNITY else "1:1 coaching, a library of recruiting guides and a live job board, built for students in the same cycle as you.") + \
        " Built by Chase Enloe, who has sat on both sides of the superday."
    HERO_CTAS = (f'<a class="btn btn--solid" href="join">Join free {arrow()}</a><a class="btn btn--ghost" href="apply">Apply to the WSA Academy</a>' if FREE_MEMBERSHIP
                 else f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a>' + ('<a class="btn btn--ghost" href="academy">Find out more</a>' if ACADEMY_PAGE else ""))
    COMMUNITY_SECTION = f"""<section class="section"><div class="wrap">
  <div class="section-head section-head--row"><div><span class="label">Community</span><h2 class="h2">Ask the people one step ahead of you.</h2></div>
    <a class="btn btn--ghost btn--sm" href="community">See all discussions {arrow()}</a></div>
  <div class="community-grid">
    <div class="threads"><div class="threads-top"><span class="filter-note">Latest from the forums</span>
      <div class="seg" role="group" aria-label="Sort threads"><button type="button" data-sort="hot" aria-pressed="true">Trending</button><button type="button" data-sort="new" aria-pressed="false">Newest</button></div></div>
      <ul class="thread-list" data-threads="6" data-thread-link="community"></ul></div>
    <aside class="side">{events_card()}
      <div class="side-card"><h3>Got a question about a firm?</h3><p>Post it anonymously. Analysts and students who just went through the process answer most threads the same day.</p><a class="btn btn--solid btn--sm" href="join">Ask the community</a></div></aside>
  </div>
</div></section>""" if COMMUNITY else ""
    ACADEMY_CARD = f"""    <article class="path path--academy"><span class="label">By application</span><h3>The WSA Academy</h3><p class="price">Coached by Chase <small>limited seats per cycle</small></p>
      {ticks(["A plan for your cycle, built on a 1:1 strategy call", "The full resource library and the live job board", "Question banks, guided study plans and live technicals prep", "Mock interviews and mock superdays before the real ones"])}
      <div class="ctas"><a class="btn btn--solid" href="apply">Apply now {arrow()}</a>{f'<a class="btn btn--ghost" href="academy">Find out more {arrow()}</a>' if ACADEMY_PAGE else ""}</div></article>"""
    MEMBERSHIP_SECTION = (f"""<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><span class="label">Membership</span><h2 class="h2">Two ways in.</h2>
    <p class="sub">Start free with the community and the free lectures, or apply to work with Chase directly and unlock the library, the job board and the student portal.</p></div>
  <div class="paths">
    <article class="path"><span class="label">Member</span><h3>Free membership</h3><p class="price">$0 <small>no card needed</small></p>
      {ticks(["Community forums for every desk, anonymous if you want", "Free live lectures with Chase", "Chase's Placement Playbook: Technicals Guide"])}
      <div class="ctas"><a class="btn btn--solid" href="join">Join free {arrow()}</a></div></article>
{ACADEMY_CARD}
  </div>
</div></section>""" if FREE_MEMBERSHIP else f"""<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><span class="label">The WSA Academy</span><h2 class="h2">Work with Chase directly.</h2>
    <p class="sub">Apply and get a free 1:1 strategy call. If it's a fit, you get a plan for your cycle, the full library, the job board and the student portal.</p></div>
  <div class="paths paths--single">
{ACADEMY_CARD}
  </div>
</div></section>""")
    CLOSING = (band("One shot per cycle. <em>Make it count.</em>", "Join free and ask your first question in the community tonight, or apply to the Academy for the full library, the job board and coaching with Chase.",
                    f'<a class="btn btn--solid" href="join">Join free {arrow()}</a><a class="btn btn--ghost" href="login">Log in</a>') if FREE_MEMBERSHIP else
               band("One shot per cycle. <em>Make it count.</em>", "Apply to the Academy for the full library, the job board and coaching with Chase, or start with the free live lecture.",
                    f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a><a class="btn btn--ghost" href="webinar123">Free live lecture</a>'))
    body = f"""<main>
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">
    <span class="label">Investment banking · Private equity · Private credit</span>
    <h1>Break into Wall&nbsp;Street on your <span class="mark">first cycle.</span></h1>
    <p class="sub">{HERO_SUB}</p>
    <div class="ctas">{HERO_CTAS}</div>
    <div class="proof"><strong>{PLACED}</strong><span>students placed at Goldman Sachs, Centerview, Moelis, PJT, Blackstone and Ares</span></div>
  </div>
  {board()}
</div></section>
{ticker()}
<section class="section"><div class="wrap">
  <div class="section-head"><span class="label">The process</span><h2 class="h2">Three things decide every offer.</h2>
    <p class="sub">Every tool on the platform is built around one of them, in the order recruiting actually happens.</p></div>
  {PILLARS}
</div></section>
<section class="section--tight"><div class="wrap"><div class="grid-3">
  <a class="card card--link" href="webinar123"><span class="kicker">FREE LIVE LECTURE · SAT 24 OCT</span><h3>Chase's Placement Playbook, live on Zoom</h3><p>75 minutes on how {PLACED} students landed $180k+ roles, plus open Q&amp;A. Parents welcome.</p><span class="more">Get a free ticket →</span></a>
  <a class="card card--link" href="resources"><span class="kicker">ACADEMY · RESOURCE LIBRARY</span><h3>Every guide Chase hands his students</h3><p>Cold outreach scripts, the GS vs MS breakdown, analyst budgets, target school lists and 40+ more.</p><span class="more">See what's inside →</span></a>
  <a class="card card--link" href="jobs"><span class="kicker">ACADEMY · JOB BOARD</span><h3>Live Wall Street openings</h3><p>Full-time roles, internships and early-insight programs pulled from firms' career boards every day.</p><span class="more">See the job board →</span></a>
</div></div></section>
{COMMUNITY_SECTION}
{MEMBERSHIP_SECTION}
{coach_section()}
<section class="section"><div class="wrap guide">
  <div class="cover-stage">{cover()}</div>
  <div class="guide-copy"><span class="label">Free guide</span><h2 class="h2">The technicals guide, free.</h2>
    <p class="sub">The questions students were asked at Evercore, PJT, Goldman Sachs and Blackstone, with a four-phase plan to answer them like you've done it before.</p>
    <ul class="contents"><li><span>The exact questions, straight from the interview room</span><span>17 pages</span></li><li><span>The four-phase prep plan</span><span>Plan</span></li><li><span>The 20 essentials: accounting, valuation, LBO</span><span>Concepts</span></li><li><span>Turning a correct answer into a conversation</span><span>Delivery</span></li></ul>
    <div class="ctas"><a class="btn btn--solid" href="technicalguide">Get the free guide {arrow()}</a></div></div>
</div></section>
{CLOSING}
</main>"""
    page("index", "Wall Street Alpha", f"Recruiting coaching, free guides{', a live job board and a community' if COMMUNITY else ' and a live job board'} for students breaking into investment banking, markets and the buy side.", body, pid="home")


def build_vsl():
    words = ["experience.", "a target school.", "connections.", "a finance degree.", "perfect grades.", "an internship.", "family on Wall Street.", "prestige."]
    rot = '<span class="rotator" data-rotator>' + "".join(f"<span><u>{w.rstrip('.')}</u>.</span>" for w in words) + "</span>"
    body = f"""<main>
<section class="hero" style="padding-bottom:clamp(28px,4vw,48px)"><div class="wrap" style="display:flex;flex-direction:column;align-items:center;gap:28px;text-align:center">
  <h1 class="h1-3line"><span class="ln">Land a <span class="mark">$180k+</span></span><span class="ln">investment banking role without</span><span class="ln">{rot}</span></h1>
  <div class="video-frame" style="width:100%;max-width:920px"><iframe src="{WISTIA_VSL}" title="Wall Street Alpha training" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>
  <a class="btn btn--solid" href="apply" style="height:54px;padding-inline:30px;font-size:16px">Apply to the WSA Academy {arrow()}</a>
</div></section>
{ticker("Where students land")}
<section class="section"><div class="wrap">
  <div class="section-head"><span class="label">The process</span><h2 class="h2">Three things decide every offer.</h2></div>
  <div class="grid-3">
    <article class="card"><span class="kicker">STEP 01</span><h3>Network effectively</h3><p>Get access to the network, connections, outreach systems and coffee chats that turn cold introductions into real interview opportunities.</p></article>
    <article class="card"><span class="kicker">STEP 02</span><h3>Master the technicals</h3><p>Use a comprehensive library of resources, guided study plans and live technical preparation so your answers hold up under pressure.</p></article>
    <article class="card"><span class="kicker">STEP 03</span><h3>Present with conviction</h3><p>Practice interviews, sharpen your story and learn to speak with the clarity and confidence that makes interviewers trust you in the room.</p></article>
  </div>
</div></section>
{coach_section(link=False)}
{band("You get one shot per recruiting cycle.", "Apply in about two minutes. If it's a fit, you'll pick a time for a free 1:1 strategy call.",
      f'<a class="btn btn--solid" href="apply">Apply to the WSA Academy {arrow()}</a>')}
</main>"""
    page("vsl", "Book a 1:1 Wall Street strategy call · Wall Street Alpha",
         "Watch the short training, then book a free 1:1 strategy call to map your route into a $180k+ investment banking role.", body, pid="vsl", chrome="funnel")


ACADEMY_FAQ = [
    ("Who should apply?", "Anyone serious about a competitive front-office finance role, freshmen through professionals. If you're aiming at investment banking, markets, research, asset management, credit or a buy-side seat, you're in the right place."),
    ("Do I need previous finance experience?", "No. A meaningful share of successful candidates start with zero finance background. The work is translating what you do have into a credible finance story, and that's a core part of the program."),
    ("Is Wall Street Alpha only for investment banking?", "No. IB is one lane. We also coach sales & trading, research, asset management, private credit and hedge funds, so you target the seat that actually fits you."),
    ("Does the program guarantee an offer?", "No, and be skeptical of anyone who says otherwise, since offers depend on your effort, timing and market conditions. What we guarantee is the roadmap, the coaching, the accountability and honest feedback at every step."),
    ("What happens after I apply?", "We review your application individually. If it looks like a fit, we'll invite you to a strategy call to map your target roles, your timeline, and whether the program can move the needle for you."),
    ("Who will coach me, and will I have direct access to the founder?", "Coaching is led directly by Chase. Members work with him throughout their recruiting cycle across dedicated sessions, group calls and program channels."),
    ("How much does it cost?", "We'll cover pricing on the strategy call once we confirm fit."),
    ("I'm a parent evaluating this for my student. Is that okay?", "Absolutely. You're welcome on the strategy call. We'll walk through exactly what your student gets, how coaching works, and whether it's the right investment for their goals."),
]


def faq(items):
    return '<div class="faq">' + "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in items) + "</div>"


def build_academy():
    if not ACADEMY_PAGE:
        body = '<main class="center-page"><div><span class="spinner"></span><p class="muted">Taking you to <a class="textlink" href="vsl">Apply</a>…</p></div></main>'
        page("academy", "Apply · Wall Street Alpha", "Apply to the WSA Academy.", body, pid="redirect", chrome="bare", redirect="vsl")
        return
    who = [("Students breaking in", "Freshmen through juniors preparing for their first internship."),
           ("Non-target candidates", "Great students at schools banks don't visit, who need a sharper networking edge."),
           ("No finance experience", "Applicants translating unrelated experience into a credible finance story."),
           ("Markets & investing candidates", "S&T, research, asset management, credit and hedge fund hopefuls."),
           ("International students", "Candidates navigating visa timelines and sponsorship at firms that hire globally."),
           ("MBA candidates", "Graduate students recruiting at the associate level.")]
    path = [("Choose the right lane", "Pinpoint the roles where your strengths actually win, so you stop spreading yourself thin across jobs you'll never land."),
            ("Build your positioning", "A credible resume, a story that sticks, and a networking plan, engineered for the exact seat you're targeting."),
            ("Master the process", "Technicals, behaviorals and live market discussions, drilled until they're second nature."),
            ("Execute with accountability", "A personalized roadmap, real deadlines, coaching and mock interviews, so preparation actually happens.")]
    body = f"""<main>
{page_hero("The WSA Academy", "1:1 mentorship to land your first Wall Street offer.",
           "Coached directly by Chase Enloe: Deutsche Bank, Magnetar, Morgan Stanley and four years in private credit on the buy side. CFA charterholder, Chicago Booth MBA.",
           f'<div class="ctas"><a class="btn btn--solid" href="apply">Apply now {arrow()}</a><a class="btn btn--ghost" href="vsl">Watch the training</a></div>')}
<section class="section--tight"><div class="wrap"><div class="stats">
  <div class="stat"><span class="label">Placed</span><b>{PLACED}</b><small>students into high finance</small></div>
  <div class="stat"><span class="label">Coverage</span><b>2 lanes</b><small>banking and markets &amp; investing</small></div>
  <div class="stat"><span class="label">Coach</span><b>CFA</b><small>charterholder, Booth MBA</small></div>
  <div class="stat"><span class="label">Format</span><b>1:1</b><small>plus group calls and channels</small></div>
</div></div></section>
<section class="section" style="padding-top:clamp(24px,3vw,40px)"><div class="wrap">
  <div class="section-head"><span class="label">Two-lane support</span><h2 class="h2">Investment banking or markets. Your choice.</h2>
    <p class="sub">Most programs pick one lane. We cover both, taught by someone who's actually worked the sell side and the buy side, so you can compete for the offer that fits you.</p></div>
  <div class="grid-2">
    <article class="card"><span class="kicker">LANE ONE</span><h3>Investment Banking</h3><p>M&amp;A, capital markets and coverage. The most recognized path on Wall Street, and the most competitive to land. We prepare you for every stage of the process.</p></article>
    <article class="card"><span class="kicker">LANE TWO</span><h3>Markets &amp; Investing</h3><p>Sales &amp; trading, hedge funds and private credit. The high-upside roles most programs overlook. We prepare you to target the right one and compete like an insider.</p></article>
  </div>
</div></section>
<section class="section section--sunk"><div class="wrap coach-grid">
  <div class="coach-copy"><span class="label">The problem</span><h2 class="h2">Recruiting rewards preparation, not potential.</h2>
    <p>The most talented students lose offers to less talented ones every year, not because they weren't good enough, but because nobody handed them the roadmap. The rules of Wall Street recruiting are real, specific and almost never written down.</p>
    <blockquote>"You only have one chance in each recruiting cycle. You shouldn't be guessing."</blockquote>
    <p>Wall Street Alpha gives ambitious candidates the strategy, coaching and accountability most talented students never get.</p></div>
  <figure class="portrait"><img src="assets/chase-library-navy-suit.jpg" alt="Chase Enloe in a navy suit in a library" loading="lazy" style="object-position:50% 35%"></figure>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><span class="label">Who it's for</span><h2 class="h2">Built for ambitious candidates at every starting point.</h2></div>
  <div class="grid-3">{"".join(f'<article class="card"><h3>{t}</h3><p>{d}</p></article>' for t, d in who)}</div>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><span class="label">The method</span><h2 class="h2">The 4-step Alpha Path to a competitive offer.</h2></div>
  <ol class="learn">{"".join(f'<li><span class="n">0{i}</span><div class="stack-sm"><b>{t}</b><span class="muted">{d}</span></div></li>' for i, (t, d) in enumerate(path, 1))}</ol>
</div></section>
<section class="section section--sunk"><div class="wrap cols-2">
  <div class="stack"><span class="label">What's included</span><h2 class="h2">Everything you need, through the whole cycle.</h2>
    {ticks(["A 1:1 strategy call and a written plan for your cycle", "Dedicated coaching sessions with Chase, plus group calls and program channels", "The full question bank, guided study plans and live technicals prep", "Outreach systems, email scripts and alumni lists", "The full resource library and the live job board", "Mock interviews and mock superdays before the real ones", "A student portal with your program, modules, deadlines and contacts in one place"])}</div>
  <div class="panel"><div class="panel-head"><h2>How to join</h2></div>
    <ol class="list" style="list-style:none">
      <li><span class="pill pill--info">1</span><div class="grow"><b>Apply</b><span>About two minutes, a few questions about where you are.</span></div></li>
      <li><span class="pill pill--info">2</span><div class="grow"><b>Strategy call</b><span>30 minutes to map target roles and timeline. Parents welcome.</span></div></li>
      <li><span class="pill pill--info">3</span><div class="grow"><b>Your plan</b><span>If it's a fit, you get a plan and an invite to the portal.</span></div></li>
      <li><span class="pill pill--info">4</span><div class="grow"><b>Start</b><span>Weekly sessions and accountability until recruiting season is done.</span></div></li>
    </ol>
    <div class="panel-body"><a class="btn btn--solid btn--block" href="apply">Start your application {arrow()}</a></div></div>
</div></section>
<section class="section"><div class="wrap wrap--narrow" style="padding-inline:0">
  <div class="section-head"><span class="label">FAQ</span><h2 class="h2">Common questions before applying.</h2></div>
  {faq(ACADEMY_FAQ)}
</div></section>
{band("Ready to build your offer pathway?", "Apply now and get a free strategy call to map your recruiting plan.", f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a>')}
</main>"""
    page("academy", "WSA Academy · Wall Street Alpha", "1:1 mentorship to land your first Wall Street offer, coached directly by Chase Enloe.", body, pid="academy", active="academy")


YOUFORM_APPLY, YOUFORM_APPLY_DM, YOUFORM_CV = "5hers03e", "2icrdiql", "juj0batp"


def youform(form_id, height=700, label="Open the form"):
    """The live Youform form, embedded the way the Lovable site does it (site.js loads embed.js and passes UTMs),
    so the partial-submission webhook, the Zaps on submissions and the Calendly step keep working untouched."""
    return f"""<div class="yf-frame"><div data-youform-embed data-form="{form_id}" data-base-url="https://app.youform.com" data-width="100%" data-height="{height}" style="min-height:{height}px"></div></div>
<p class="fine yf-fallback">Form not showing? <a class="textlink" href="https://app.youform.com/forms/{form_id}" target="_blank" rel="noopener">{label}</a></p>"""


def build_apply(dm=False):
    head = (f'<span class="label">{"Referred by Chase" if dm else "Application"}</span><h1 class="h2">Apply to the WSA Academy</h1>')
    side = f"""<aside class="split-side"><img class="ghost" src="assets/wsa-bull.png" alt="">
  <div class="stack"><span class="label">What happens next</span><h2>A free 1:1 strategy call with the admissions team.</h2>
    {ticks(["About two minutes, a few questions about where you are", "Pick a time for your call at the end", "You leave with a recruiting plan, whether or not you join", "Parents and guardians are welcome on the call"])}</div>
  <div class="stack"><span class="label">Recent offers</span><div class="mini-wins" data-mini-wins="4"></div></div>
</aside>"""
    body = f"""<main class="split split--form">
  <div class="split-main"><div class="yf-wrap">
    <div class="stack-sm">{head}</div>
    {youform(YOUFORM_APPLY_DM if dm else YOUFORM_APPLY, 700, "Open the application")}
  </div></div>
  {side}
</main>"""
    if dm:
        page("applydm", "Apply · Referred by Chase · Wall Street Alpha", "Apply to the WSA Academy after a referral from Chase.", body, pid="apply", chrome="funnel")
    else:
        page("apply", "Apply to the WSA Academy · Wall Street Alpha", "Apply to Wall Street Alpha and get a free strategy call to map your recruiting plan.", body, pid="apply", chrome="funnel")


def build_booked():
    body = f"""<main class="section--tight"><div class="wrap wrap--mid stack" style="gap:24px">
  <div class="stack-sm" style="text-align:center;align-items:center">
    <span class="label" style="color:var(--gain)">Congratulations on your interview!</span>
    <h1 class="h1" style="font-size:clamp(34px,4.4vw,52px)">Upload your CV.</h1>
    <p class="sub" style="max-width:52ch">Our admissions officer looks at it before your strategy call, so the time goes on your plan, not your background.</p>
  </div>
  {youform(YOUFORM_CV, 640, "Open the CV upload")}
</div></main>"""
    page("booked", "Upload your CV · Wall Street Alpha", "Upload your CV so Wall Street Alpha can review your background before your strategy call.", body, pid="booked", chrome="funnel")


def build_lecture():
    learn = ["Breaking common myths about getting into high finance", "Why banks don't screen for the smartest candidate",
             "The real reason your cold emails get ignored", "The timeline math keeping non-targets stuck", "Open Q&amp;A: ask me anything live"]
    timeline = [("deutsche-bank", "Deutsche Bank", "Sophomore Investment Banking Summer Analyst", "Jun 2017 – Jul 2017"),
                ("magnetar", "Magnetar Capital", "Portfolio Management Intern", "Feb 2018 – Mar 2019"),
                ("morgan-stanley", "Morgan Stanley", "Sales &amp; Trading Analyst", "Jul 2019 – Apr 2021"),
                ("bayview", "Bayview Asset Management", "Senior Associate, Private Credit", "May 2021 – Jan 2025"),
                ("chicago-booth", "Chicago Booth", "MBA", "")]
    tl = "".join(f'<li><span class="logo-tile"><img src="assets/logos/{f}.png" alt=""></span><div><b>{o}</b><span>{r}</span></div><time>{y}</time></li>' for f, o, r, y in timeline)
    countdown = f"""<div class="countdown" data-countdown="{LECTURE_ISO}" aria-label="Time until the lecture">
  <div><b data-d>00</b><span>Days</span></div><div><b data-h>00</b><span>Hrs</span></div><div><b data-m>00</b><span>Min</span></div><div><b data-s>00</b><span>Sec</span></div></div>"""
    body = f"""<main>
<section class="lecture-hero"><img class="ghost" src="assets/wsa-bull.png" alt="">
  <div class="wrap lecture-grid">
    <div class="stack" style="gap:22px">
      <span class="live"><i></i>Live Zoom lecture</span>
      <h1>I'm giving away the exact system that has landed <em>{PLACED} students</em> into $180k+ roles in high finance.</h1>
      <p class="sub">With firms like J.P. Morgan and Goldman Sachs. 100% free, live with Chase Enloe as your guest lecturer, plus open Q&amp;A.</p>
      <p class="when">{LECTURE_WHEN} · Zoom</p>
      <div class="ctas"><a class="btn btn--solid" href="webinar123/register" style="height:54px;padding-inline:28px">Get my free ticket {arrow()}</a></div>
      <div class="stack-sm"><span class="label" style="color:var(--band-muted)">Registrations close in</span>{countdown}</div>
    </div>
    <figure class="portrait" style="max-width:420px;justify-self:end"><img src="assets/chase-desk-monitors-black-suit.jpg" alt="Chase Enloe, guest lecturer" style="object-position:50% 25%"></figure>
  </div>
</section>
<section class="section"><div class="wrap wrap--mid">
  <div class="section-head"><span class="label">What you'll learn</span><h2 class="h2">On the free live lecture, you'll discover…</h2></div>
  <ol class="learn">{"".join(f'<li><span class="n">0{i}</span><b>{t}</b></li>' for i, t in enumerate(learn, 1))}</ol>
</div></section>
<section class="section section--sunk"><div class="wrap cols-even">
  <div class="stack"><span class="label">Your guest lecturer</span><h2 class="h2">Meet Chase Enloe, CFA.</h2>
    <blockquote>"I was never the nepo baby and didn't go to an Ivy. My system is what got me an offer."</blockquote>
    <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="stat"><b>{PLACED}</b><small>students helped into high finance</small></div><div class="stat"><b>CFA</b><small>charterholder</small></div><div class="stat"><b>MBA</b><small>Chicago Booth</small></div></div></div>
  <div class="panel"><ol class="timeline" style="padding:6px 18px">{tl}</ol></div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><span class="label">The Dean's List</span><h2 class="h2">Where students land.</h2></div>
  <div class="wins-grid" data-wins-grid></div>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap wrap--narrow" style="padding-inline:0">
  <div class="section-head"><span class="label">Common questions</span><h2 class="h2">Before you register.</h2></div>
  {faq([("How long is the session?", "75 minutes plus live Q&amp;A. The Q&amp;A regularly runs longer."),
        ("Do I need to turn my camera on?", "No. You can sit quietly and take notes, or submit questions in the chat."),
        ("What if I can't make it live?", "Register anyway and you'll get the details. But the teardowns and Q&amp;A only happen live, so come if you possibly can."),
        ("Can my parents come?", "Yes. If you're under 21 we'll give you a free extra ticket for a parent or guardian, so they can learn how to help you pursue a career in high finance.")])}
</div></section>
{band("Free seat. Live Q&amp;A. <em>Limited spots.</em>", f"{LECTURE_WHEN} on Zoom, plus the prep sheet for everyone who shows up.", f'<a class="btn btn--solid" href="webinar123/register">Claim your spot {arrow()}</a>')}
</main>"""
    page("webinar123", "Free live lecture · Chase's Placement Playbook · Wall Street Alpha",
         f"A free live lecture with Chase Enloe: the system that has helped {PLACED} students into $180k+ roles in high finance, plus open Q&A.", body, pid="lecture", chrome="funnel")

    reg = f"""<main class="split">
  <div class="split-main"><div>
    <form class="form-card" data-webinar-form novalidate>
      <span class="label">Reserve your free ticket</span>
      <h1 class="h3" style="font-size:28px">Save your free seat.</h1>
      <div class="fields-2"><label class="field" for="rg-first">First name<input id="rg-first" autocomplete="given-name" placeholder="Alex"></label>
        <label class="field" for="rg-last">Last name<input id="rg-last" autocomplete="family-name" placeholder="Teng"></label></div>
      <label class="field" for="rg-email">Email address<input id="rg-email" type="email" autocomplete="email" placeholder="you@university.edu"></label>
      <div class="field"><label for="rg-phone">Phone number <span class="opt">(for a reminder text)</span></label><div class="phone"><select id="rg-cc" aria-label="Country code"><option>US +1</option><option>CA +1</option><option>UK +44</option><option>IN +91</option><option>CN +86</option><option>SG +65</option><option>HK +852</option></select><input id="rg-phone" type="tel" autocomplete="tel-national" placeholder="555 000 0000"></div></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="margin-bottom:8px">If you're under 21, we love inviting your parents to learn how they can help you pursue a career in high finance.</legend>
        <div class="choice-list">
          <label class="choice"><input type="radio" name="parent" value="under_21_invite"><span class="key">A</span>Yes, I want an extra ticket for them!</label>
          <label class="choice"><input type="radio" name="parent" value="over_21_invite"><span class="key">B</span>I'm over 21, I'd still like to invite my parents</label>
          <label class="choice"><input type="radio" name="parent" value="no_invite" checked><span class="key">C</span>No, I don't want an extra ticket</label>
        </div></fieldset>
      <div class="stack" data-parent-fields hidden>
        <div class="fields-2"><label class="field" for="rg-pfirst">Parent first name<input id="rg-pfirst" placeholder="Jordan"></label><label class="field" for="rg-plast">Parent last name<input id="rg-plast" placeholder="Teng"></label></div>
        <label class="field" for="rg-pemail">Parent or guardian's email<input id="rg-pemail" type="email" placeholder="parent@email.com"></label>
      </div>
      <p class="status" data-reg-error role="alert" hidden></p>
      <button class="btn btn--solid btn--block" type="submit">Save my free seat {arrow()}</button>
      <p class="fine">We'll email your ticket and a reminder before it starts. See our <a class="textlink" href="privacy">Privacy Policy</a>.</p>
    </form>
  </div></div>
  <aside class="split-side"><img class="ghost" src="assets/wsa-bull.png" alt="">
    <div class="stack"><span class="live"><i></i>Live on Zoom</span><h2>Chase's Placement Playbook: Live Lecture</h2><p class="when">{LECTURE_WHEN}</p>
      {ticks(["75 minutes plus live Q&amp;A", "The prep sheet for everyone who shows up", "Free extra ticket for a parent or guardian"])}</div>
    <div class="stack-sm"><span class="label">Registrations close in</span>{countdown}</div>
  </aside>
</main>"""
    page("webinar123/register", "Reserve your free ticket · Wall Street Alpha", "Reserve a free seat for the live lecture with Chase Enloe.", reg, pid="lecture-register", chrome="funnel")

    tick = f"""<main class="section"><div class="wrap ticket-wrap">
  <div class="stack" data-ticket style="gap:22px">
    <div class="stack-sm"><span class="label">80% complete</span><div class="meter-bar" aria-hidden="true"><i style="width:80%"></i></div></div>
    <h1 class="h1" style="font-size:clamp(32px,4vw,48px)">Congrats <span data-reg-first>you</span>, you're registered for Chase's Placement Playbook.</h1>
    <div class="video-ph"><span class="play">{svg('play')}</span><b style="font-family:var(--display);font-size:22px">A message from Chase</b><small>Video coming soon · about 3 minutes</small></div>
    <span class="label">Steps to complete</span>
    <div class="steps">
      <div class="stepcard"><span class="n">1</span><div><h3>Join the Instagram community</h3><p>Get Chase's Placement Playbook, free resources, updates and Q&amp;A.</p>
        <div class="row-wrap"><a class="btn btn--solid btn--sm" href="{INSTAGRAM}" target="_blank" rel="noopener" data-step-done>Join the community</a></div></div></div>
      <div class="stepcard"><span class="n">2</span><div><h3>Save your ticket to Apple Wallet</h3><p>Your ticket, one tap away on the day, with a reminder before it starts.</p>
        <div class="row-wrap"><a class="wallet-btn" href="{WALLET_PAGE}" target="_blank" rel="noopener" data-step-done>{WALLET_ICON}Add to Apple Wallet</a></div></div></div>
      <div class="stepcard"><span class="n">3</span><div><h3>Add the lecture to your calendar</h3><p>So you never miss the session.</p>
        <div class="row-wrap"><a class="btn btn--ghost btn--sm" href="{CAL_GOOGLE}" target="_blank" rel="noopener" data-step-done>Google Calendar</a><a class="btn btn--ghost btn--sm" href="{CAL_OUTLOOK}" target="_blank" rel="noopener" data-step-done>Outlook</a><a class="btn btn--ghost btn--sm" href="{e(CAL_YAHOO)}" target="_blank" rel="noopener" data-step-done>Yahoo</a></div></div></div>
    </div>
  </div>
  <aside class="stack" style="position:sticky;top:96px">
    <div class="ticket">
      <div class="ticket-top"><span class="label">Live lecture · Admit one</span><h3>Chase's Placement Playbook</h3><span style="color:var(--band-muted)">with guest lecturer Chase Enloe</span></div>
      <div class="ticket-perf"></div>
      <div class="ticket-body"><div><span>Date</span><b>Sat, Oct 24</b></div><div><span>Time</span><b>2:00 PM ET</b></div><div><span>Where</span><b>Zoom</b></div><div><span>Name</span><b data-reg-name>Your name</b></div></div>
    </div>
    <div class="notice" data-parent-ticket hidden>We've sent a free extra ticket to <b data-parent-name>your parent</b>.</div>
    <div class="side-card"><h3>While you wait</h3><p>Get the free technicals guide, or browse every resource Chase hands his students.</p><div class="row-wrap"><a class="btn btn--solid btn--sm" href="technicalguide">Technicals guide</a><a class="btn btn--ghost btn--sm" href="resources">Resources</a></div></div>
  </aside>
</div></main>"""
    page("webinar-registered", "Your lecture ticket · Wall Street Alpha", "Your free seat for the live lecture with Chase Enloe is confirmed.", tick, pid="ticket", chrome="funnel")


def build_guide():
    inside = [("The exact questions", "Real technicals students were asked at Evercore, PJT, Goldman Sachs, Blackstone and more, straight from the interview room."),
              ("The four-phase prep plan", "Learn the material, memorize the frameworks, then drill until the answers come out fluent, not robotic."),
              ("The 20 essentials", "The accounting, valuation and LBO concepts that show up in every superday, explained in plain English."),
              ("What comes next", "How to turn a correct answer into a conversation, and how to carry that momentum through the rest of your interviews.")]
    samples = ["Walk me through an LBO", "Why is enterprise value important?", "Walk me through the three statements", "What is the fulcrum security?", "How do you calculate unlevered free cash flow?"]
    body = f"""<main>
<section class="section"><div class="wrap doc-hero">
  <div class="stack" style="gap:20px"><span class="label">Free technical interview guide</span>
    <h1 class="h1">Walk into your interview and answer the technicals cold.</h1>
    <p class="sub">The exact technical questions students have been asked at Evercore, PJT, Goldman Sachs, Blackstone and many more, with a four-phase plan to answer them like you've done it before.</p>
    {ticks(["17 pages of real questions", "Four-phase prep plan", "Free, no strings attached"])}
  </div>
  <form class="form-card" data-guide-form novalidate>
    <div class="row-wrap" style="gap:16px;align-items:flex-start"><div style="flex:0 0 96px">{cover(size='xs')}</div>
      <div class="stack-sm" style="flex:1;min-width:180px"><h2 class="h3">Get the free Technicals Guide</h2><p class="muted">Enter your details and the PDF will be emailed to you instantly.</p></div></div>
    <label class="field" for="tg-name">Name<input id="tg-name" autocomplete="name" placeholder="Alex Teng"></label>
    <label class="field" for="tg-email">Email<input id="tg-email" type="email" autocomplete="email" placeholder="you@example.com"></label>
    <label class="field" for="tg-phone"><span>Phone number <span class="opt">(optional)</span></span><input id="tg-phone" type="tel" autocomplete="tel" placeholder="(555) 555-5555"></label>
    <p class="status" data-guide-error role="alert" hidden></p>
    <button class="btn btn--solid btn--block" type="submit">Get the free guide {arrow()}</button>
    <p class="fine">We'll only use your details to send the guide. See our <a class="textlink" href="privacy">Privacy Policy</a>.</p>
  </form>
</div></section>
<section class="section section--sunk"><div class="wrap">
  <div class="section-head"><span class="label">What's inside</span><h2 class="h2">Everything you need to stop freezing on the technicals.</h2></div>
  <div class="grid-4">{"".join(f'<article class="card"><h3 style="font-size:20px">{t}</h3><p>{d}</p></article>' for t, d in inside)}</div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><span class="label">A taste of what you'll be asked</span><h2 class="h2">The kinds of questions the guide breaks down.</h2>
    <p class="sub">With the answers interviewers actually want to hear. From a former Morgan Stanley analyst, hedge fund investor and CFA charterholder.</p></div>
  <div class="filters">{"".join(f'<span class="chip" style="cursor:default">{q}</span>' for q in samples)}</div>
</div></section>
</main>"""
    page("technicalguide", "Free Technicals Guide · Wall Street Alpha", "Get the free Wall Street Alpha Technicals Guide: real interview questions plus a four-phase prep plan.", body, pid="guide")
    sent = f"""<main class="center-page"><div style="max-width:520px">
  <span class="big-check">{svg('mail')}</span>
  <h1 class="h1" style="font-size:clamp(32px,4vw,46px)">Check your inbox.</h1>
  <p class="sub">We've sent the Technicals Guide to <b data-guide-email>your inbox</b>. It can take a minute to arrive, so check Promotions if you don't see it.</p>
  <div class="row-wrap"><a class="btn btn--solid" href="assets/pdfs/technicals-guide.pdf" target="_blank" rel="noopener">Open the guide now {arrow()}</a></div>
  <div class="side-card" style="width:100%"><span class="label">Next step</span><h3>Come to the free live lecture</h3><p>{LECTURE_WHEN} on Zoom. Chase walks through the full system and takes questions live.</p><a class="btn btn--ghost btn--sm" href="webinar123">Get a free ticket</a></div>
</div></main>"""
    page("technicalguide/sent", "Check your inbox · Wall Street Alpha", "The Technicals Guide is on its way.", sent, pid="guide-sent")


def res_card(r, related=False):
    """Library card: the guide's real first page, title, one-line blurb, page count. Same markup as site.js resCard()."""
    pages = f'{r["pages"]} page{"s" if r["pages"] != 1 else ""}'
    return (f'<a class="res" href="{r["slug"]}"><span class="res-thumb"><img src="{r["thumb"]}" alt="" loading="lazy" width="480" height="621"></span>'
            f'<div class="res-body"><h3>{e(r["title"])}</h3><p>{e(r["desc"])}</p><span class="res-meta">{pages} · PDF</span></div></a>')


def build_resources(resources):
    listed = [r for r in resources if r["listed"]]
    cats = [c for c in RESOURCE_CATS if any(r["cat"] == c for r in listed)]
    chips = "".join(f'<button class="chip" type="button" data-cat="{e(c)}" aria-pressed="{"true" if c == "All" else "false"}">{e(c)}</button>' for c in ["All"] + cats)
    body = f"""<main>
{page_hero("Resource library", "Every guide Chase hands his students.", f"{len(listed)} guides on outreach, interviews, firms, pay and reading, for WSA Academy students. Every link you've been sent in a DM still works once you're logged in.",
           '<div data-access="no">' + paywall("resources", "The resource library", "the resource library") + '</div>')}
<section class="section--tight" data-resources><div class="wrap stack" style="gap:28px">
  <div class="res-toolbar"><div class="search-box">{svg('search')}<input type="search" data-res-search placeholder="Search {len(listed)} guides" aria-label="Search guides"></div><div class="chip-row" role="group" aria-label="Filter by topic">{chips}</div></div>
  <div class="stack" style="gap:44px" data-res-groups></div>
</div></section>
<div style="height:40px"></div>
{band("Want help using all of this?", "Come to the free live lecture, or apply to work with Chase directly.", f'<a class="btn btn--solid" href="webinar123">Free live lecture {arrow()}</a><a class="btn btn--ghost" href="apply">Apply now</a>')}
</main>"""
    page("resources", "Resource library · Wall Street Alpha", "Guides from Wall Street Alpha: outreach scripts, firm comparisons, budgets, reading lists and recruiting playbooks.", body,
         pid="resources", active="resources", data={"cats": cats, "resources": [{k: r[k] for k in ("slug", "title", "desc", "cat", "thumb", "pages")} for r in listed]})

    for r in resources:
        related = [x for x in listed if x["cat"] == r["cat"] and x["slug"] != r["slug"] and x["pdf"] != r["pdf"]][:4]
        pages = f'{r["pages"]} page{"s" if r["pages"] != 1 else ""}'
        body = f"""<main>
<section class="section--tight res-page"><div class="wrap stack" style="gap:26px">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="resources">Resources</a><span aria-hidden="true">/</span><span>{e(r["cat"])}</span></nav>
  <div class="res-head">
    <div class="stack" style="gap:14px;min-width:0">
      <span class="label">{e(r["cat"])}</span>
      <h1 class="h1">{e(r["title"])}</h1>
      <p class="sub">{e(r["desc"])}</p>
      <p class="res-facts"><span>{pages}</span><span>PDF</span><span>{r["size"]}</span></p>
    </div>
    <div class="res-actions" data-access="yes" hidden><a class="btn btn--solid" href="{r["pdf"]}" download="{e(r["title"])}.pdf">{svg('download')}Download</a><a class="btn btn--ghost" href="{r["pdf"]}" target="_blank" rel="noopener">Open full screen</a></div>
  </div>
  <div class="pdf-view" data-access="yes" hidden>
    <iframe data-src="{r["pdf"]}#view=FitH" title="{e(r["title"])}, PDF" ></iframe>
    <a class="pdf-tap" href="{r["pdf"]}" target="_blank" rel="noopener"><img src="{r["thumb"]}" alt="First page of {e(r["title"])}"><span class="btn btn--solid">Open the PDF {arrow()}</span></a>
  </div>
  <div class="res-locked" data-access="no">
    <div class="res-peek" aria-hidden="true"><img src="{r["thumb"]}" alt=""></div>
    {paywall(r["slug"], "This guide", "this guide or the rest of the library")}
  </div>
</div></section>
{f'<section class="section" style="padding-top:clamp(20px,3vw,36px)"><div class="wrap"><div class="section-head section-head--row"><div><span class="label">More in {e(r["cat"])}</span></div><a class="btn btn--ghost btn--sm" href="resources">All resources {arrow()}</a></div><div class="res-grid">{"".join(res_card(x) for x in related)}</div></div></section>' if related else ''}
{band("Get the system behind the guides.", f"Join the free live lecture on {LECTURE_WHEN}, or apply to work with Chase.", f'<a class="btn btn--solid" href="webinar123">Free live lecture {arrow()}</a><a class="btn btn--ghost" href="apply">Apply now</a>')}
</main>"""
        page(r["slug"], f'{r["title"]} · Wall Street Alpha', r["desc"], body, pid="resource", active="resources")


def build_jobs():
    verts = sorted({j[3] for j in JOBS})
    data = [{"title": t, "firm": f, "loc": l, "vert": v, "type": ty, "posted": p, "url": u} for t, f, l, v, ty, p, u in JOBS]
    body = f"""<main>
{page_hero("Job board", "Live Wall Street openings.", "Full-time roles, internships and early-insight programs, pulled directly from firms' career boards and refreshed daily. For WSA Academy students.")}
<section class="section--tight" data-access="no"><div class="wrap">
  <div class="paywall">
    <div class="paywall-preview" aria-hidden="true">{"".join(f'<div class="pw-row"><span class="firm-mark">{f[:2].upper()}</span><span><b>{t}</b><small>{f} · {l}</small></span><span class="pill">{v}</span></div>' for t, f, l, v, *_ in JOBS[:7])}</div>
    <div class="paywall-card">{paywall("jobs", "The live job board", "the live job board")}</div>
  </div>
</div></section>
<section class="section--tight" data-jobs data-access="yes" hidden><div class="wrap stack" style="gap:20px">
  <div class="snapshot-note">{svg('clock')}<span><b>Preview data.</b> A snapshot of the live board taken 9 October 2026. Internships and programs here only list real internships and programs; the live board currently files roles like "Internal Audit Director" under internships.</span></div>
  <div class="jobs-layout">
    <aside class="jobs-side">
      <div class="facet"><span class="label" style="padding:0 10px 6px">Role type</span>
        <button type="button" data-type="all" aria-pressed="true">All roles <span></span></button>
        <button type="button" data-type="full_time" aria-pressed="false">Full-time <span></span></button>
        <button type="button" data-type="internship" aria-pressed="false">Internships <span></span></button>
        <button type="button" data-type="program" aria-pressed="false">Insight &amp; programs <span></span></button></div>
      <div class="facet"><span class="label" style="padding:0 10px 6px">Vertical</span>
        <button type="button" data-vert="all" aria-pressed="true">All verticals <span></span></button>
        {"".join(f'<button type="button" data-vert="{e(v)}" aria-pressed="false">{e(v)} <span></span></button>' for v in verts)}</div>
      <button class="link" type="button" data-jobs-reset style="padding-left:10px;text-align:left">Reset filters</button>
    </aside>
    <div class="stack" style="gap:14px;min-width:0">
      <div class="row-wrap" style="justify-content:space-between"><div class="search-box">{svg('search')}<input type="search" data-jobs-search placeholder="Search title, firm or city" aria-label="Search jobs"></div><span class="faint" style="font-size:13.5px" data-jobs-count></span></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Role</th><th>Vertical</th><th>Type</th><th>Posted</th></tr></thead><tbody data-jobs-body></tbody></table></div>
    </div>
  </div>
</div></section>
<div style="height:40px"></div>
<div data-access="no">{band("Want the full board?", "Academy students see every opening, track their applications in the portal and prep each interview with Chase.", f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a><a class="btn btn--ghost" href="webinar123">Free live lecture</a>')}</div>
<div data-access="yes" hidden>{band("Found a role? Get the interview.", "Track the application in your portal and prep the interview with Chase.", f'<a class="btn btn--solid" href="dashboard">Open your portal {arrow()}</a>')}</div>
</main>"""
    page("jobs", "Job board · Wall Street Alpha", "Live investment banking, sales & trading, research, asset management, private credit and buy-side openings.", body, pid="jobs", active="jobs", data={"jobs": data})


def build_community():
    if not COMMUNITY:
        body = '<main class="center-page"><div><span class="spinner"></span><p class="muted">Taking you to <a class="textlink" href="./">Wall Street Alpha</a>…</p></div></main>'
        page("community", "Wall Street Alpha", "Wall Street Alpha", body, pid="redirect", chrome="bare", redirect="./")
        return
    body = f"""<main>
{page_hero("Community", "Ask the people one step ahead of you.", "Students and analysts who just went through the process, answering questions about firms, interviews and recruiting timelines. Post anonymously if you want.",
           f'<div class="ctas"><a class="btn btn--solid" href="join">Start a discussion {arrow()}</a></div>')}
<section class="section--tight"><div class="wrap community-grid">
  <div class="threads"><div class="threads-top"><span class="filter-note">All discussions</span>
    <div class="seg" role="group" aria-label="Sort threads"><button type="button" data-sort="hot" aria-pressed="true">Trending</button><button type="button" data-sort="new" aria-pressed="false">Newest</button></div></div>
    <ul class="thread-list" data-threads="12" data-thread-link="join"></ul></div>
  <aside class="side">{events_card()}
    <div class="side-card"><h3>House rules</h3><ul class="ticks" style="font-size:14px"><li>{svg('check')}<span>No firm-bashing or leaked interview materials</span></li><li>{svg('check')}<span>Share what you were asked, not who asked it</span></li><li>{svg('check')}<span>Be specific: school, year, target, timeline</span></li></ul></div>
    <div class="side-card"><h3>Read a full thread</h3><p>Threads and replies are for members. It's free and takes a minute.</p><a class="btn btn--solid btn--sm" href="join">Join free</a></div>
  </aside>
</div></section>
<div style="height:56px"></div>
</main>"""
    page("community", "Community · Wall Street Alpha", "Ask questions about firms, interviews and recruiting timelines.", body, pid="community", active="community")


def build_wins():
    body = f"""<main>
{page_hero("The Dean's List", "Where our students landed.", f"{PLACED} students placed across investment banking, private equity and private credit. A selection of recent offers.")}
<section class="section--tight"><div class="wrap"><div class="wins-grid" data-wins-grid></div></div></section>
{ticker("Recent offers")}
{band("Your name could be next.", "Apply in about two minutes and get a free 1:1 strategy call.", f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a><a class="btn btn--ghost" href="webinar123">Free live lecture</a>')}
</main>"""
    page("deans-list", "The Dean's List · Wall Street Alpha", f"{PLACED} students placed across banking, private equity and private credit.", body, pid="wins")


def build_about():
    tl = [("deutsche-bank", "Deutsche Bank", "Sophomore Investment Banking Summer Analyst", "Jun 2017 – Jul 2017"),
          ("magnetar", "Magnetar Capital", "Portfolio Management Intern", "Feb 2018 – Mar 2019"),
          ("morgan-stanley", "Morgan Stanley", "Sales &amp; Trading Analyst", "Jul 2019 – Apr 2021"),
          ("bayview", "Bayview Asset Management", "Senior Associate, Private Credit", "May 2021 – Jan 2025")]
    edu = [("chicago-booth", "The University of Chicago Booth School of Business", "MBA, full-ride scholarship", ""),
           ("northwestern", "Northwestern University", "B.A. Economics, full-ride scholarship", ""),
           (None, "CFA Institute", "CFA charterholder, passed each level on the first attempt", "")]
    row = lambda f, o, r, y: (f'<li><span class="logo-tile">{"<img src=\"assets/logos/" + f + ".png\" alt=\"\">" if f else "<b style=\"font-family:var(--mono);font-size:10px;color:#12284B\">CFA</b>"}</span>'
                              f'<div><b>{o}</b><span>{r}</span></div><time>{y}</time></li>')
    body = f"""<main>
<section class="section"><div class="wrap coach-grid">
  <figure class="portrait"><img src="assets/chase-street-navy-suit-duffel.jpg" alt="Chase Enloe walking in a navy suit" style="object-position:50% 30%"></figure>
  <div class="coach-copy">
    <span class="label">About the founder</span>
    <h1 class="h1">Chase Enloe, CFA</h1>
    <p class="sub" style="color:var(--muted)">Sell side to buy side. CFA charterholder. Chicago Booth MBA.</p>
    <p>I grew up in Portland, Oregon, about as far from Wall Street as you can get. No parent at a bank, no family friend to call, no target-school pipeline.</p>
    <p>So I stopped waiting for a connection I didn't have and worked out what nobody tells you: breaking in is a process. Before I graduated, that process landed me internships at Deutsche Bank, Magnetar Capital and Morgan Stanley, on both the sell side and the buy side.</p>
    <p>It became a career across both sides of Wall Street. Now it's the system I teach, so you don't have to figure it out alone the way I did.</p>
    <blockquote>"Wall Street Alpha is the playbook I wish I'd had on my first day of college."</blockquote>
  </div>
</div></section>
<section class="section section--sunk"><div class="wrap cols-even">
  <div class="stack"><span class="label">Experience</span><h2 class="h3">Sell-side markets, banking, private credit and hedge fund investing.</h2><div class="panel"><ol class="timeline" style="padding:6px 18px">{"".join(row(*x) for x in tl)}</ol></div></div>
  <div class="stack"><span class="label">Education &amp; credentials</span><h2 class="h3">Two full-ride scholarships and the CFA charter.</h2><div class="panel"><ol class="timeline" style="padding:6px 18px">{"".join(row(*x) for x in edu)}</ol></div></div>
</div></section>
<section class="section"><div class="wrap grid-3">
  <figure class="portrait" style="aspect-ratio:4/5"><img src="assets/chase-library-navy-suit.jpg" alt="Chase Enloe in a library" loading="lazy"></figure>
  <figure class="portrait" style="aspect-ratio:4/5"><img src="assets/chase-desk-monitors-black-suit.jpg" alt="Chase Enloe at a trading desk" loading="lazy"></figure>
  <figure class="portrait" style="aspect-ratio:4/5"><img src="assets/chase-booth-sign-close.jpg" alt="Chase Enloe at Chicago Booth" loading="lazy"></figure>
</div></section>
{band("Learn the process from someone who's run it.", "Come to the free live lecture, or apply to work with Chase directly.", f'<a class="btn btn--solid" href="apply">Apply now {arrow()}</a><a class="btn btn--ghost" href="webinar123">Free live lecture</a>')}
</main>"""
    page("about", "About Chase Enloe · Wall Street Alpha", "Chase Enloe, CFA: Deutsche Bank, Magnetar, Morgan Stanley, private credit, Chicago Booth MBA.", body, pid="about")


def legal_html(path):
    lines = [l.rstrip("\n") for l in open(path)]
    # join lines that were split around links
    merged = []
    for l in lines:
        if merged and merged[-1].endswith(" "):
            merged[-1] = merged[-1] + l
        else:
            merged.append(l)
    out, items, started = [], [], False
    updated = ""
    def flush():
        if items:
            out.append("<ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>")
            items.clear()
    for l in merged:
        s = l.strip()
        if not s or s.startswith("©") or s in ("Back to home", "Legal", "Terms of Service", "Privacy Policy") or s.endswith("| Wall Street Alpha"):
            continue
        if s.startswith("Last updated"):
            updated = s; started = True; continue
        if not started:
            continue
        s = e(s)
        s = re.sub(r"(https?://[^\s)]+)", r'<a href="\1" target="_blank" rel="noopener">\1</a>', s)
        s = s.replace(e(CONTACT), f'<a href="mailto:{CONTACT}">{CONTACT}</a>')
        if re.match(r"^\d+\. ", l.strip()):
            flush(); out.append(f"<h2>{s}</h2>")
        elif not re.search(r"[.:]$", l.strip()) and len(l.strip()) < 200 and not l.strip().startswith("Wall Street Alpha, LLC"):
            items.append(s)
        else:
            flush(); out.append(f"<p>{s}</p>")
    flush()
    return updated, "\n".join(out)


def build_legal():
    for slug, title, src in [("terms", "Terms of Service", "terms.txt"), ("privacy", "Privacy Policy", "privacy.txt")]:
        updated, prose = legal_html(os.path.join(ROOT, "data", src))
        body = f"""<main>
{page_hero("Legal", title, updated)}
<section class="section--tight"><div class="wrap"><article class="prose">{prose}</article></div></section>
<div style="height:56px"></div>
</main>"""
        page(slug, f"{title} · Wall Street Alpha", f"Wall Street Alpha {title}.", body, pid=slug)


def build_redirects():
    for src, dst, t in [("apply2", "apply", "Apply"), ("apply3", "apply", "Apply"), ("home-original", "vsl", "Wall Street Alpha"), ("lecture", "webinar123", "Free live lecture"), ("wins", "deans-list", "The Dean's List")]:
        body = f'<main class="center-page"><div><span class="spinner"></span><p class="muted">Taking you to <a class="textlink" href="{dst}">{t}</a>…</p></div></main>'
        page(src, f"{t} · Wall Street Alpha", t, body, pid="redirect", chrome="bare", redirect=dst)


# --------------------------------------------------------------------------- run
def build_pages():
    """Fill PAGES with every page; returns the resource records. Also used by export_lovable.py."""
    import pages_app
    resources = load_resources()
    build_home(); build_vsl(); build_academy(); build_apply(); build_apply(dm=True); build_booked(); build_lecture(); build_guide()
    build_resources(resources); build_jobs(); build_community(); build_wins(); build_about(); build_legal(); build_redirects()
    pages_app.build(sys.modules[__name__], resources)
    return resources


def main():
    build_pages()
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(DIST, "assets"))
    shutil.copy(os.path.join(ROOT, "src", "site.css"), os.path.join(DIST, "assets", "site.css"))
    shutil.copy(os.path.join(ROOT, "src", "site.js"), os.path.join(DIST, "assets", "site.js"))
    shutil.copy(os.path.join(ROOT, "src", "app.js"), os.path.join(DIST, "assets", "app.js"))
    modules = json.load(open(os.path.join(ROOT, "data", "modules.json")))
    dbjs = open(os.path.join(ROOT, "src", "db.js")).read()
    assert "/*__MODULES__*/[]" in dbjs
    open(os.path.join(DIST, "assets", "db.js"), "w").write(dbjs.replace("/*__MODULES__*/[]", json.dumps(modules, ensure_ascii=False)))
    seen = set()
    for path, doc in PAGES:
        assert path not in seen, f"duplicate page {path}"
        seen.add(path)
        fp = os.path.join(DIST, path + ".html")
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        with open(fp, "w") as f:
            f.write(doc)
    print(f"Built {len(PAGES)} pages into dist/ with base {BASE}")


if __name__ == "__main__":
    main()
