"""Sign-in flows, the student portal, the coach portal and lecture reporting.
Everything here renders sample data; the preview bar says so on every page."""
import json


def build(b, resources):
    e, svg, arrow, ticks, page = b.e, b.svg, b.arrow, b.ticks, b.page
    G = b.GOOGLE_G

    # ------------------------------------------------------------------ auth
    side = f"""<aside class="split-side"><img class="ghost" src="assets/wsa-bull.png" alt="">
  <div class="stack"><span class="label">Wall Street Alpha</span><h2>1:1 mentorship for careers in finance.</h2>
    <blockquote>"You get one shot per recruiting cycle. You shouldn't be guessing."</blockquote></div>
  <div class="stack"><span class="label">Recent offers</span><div class="mini-wins" data-mini-wins="4"></div></div>
</aside>"""

    login = f"""<main class="split">
  <div class="split-main"><div>
    <div class="stack-sm"><h1 class="h3" style="font-size:32px" data-login-title>Welcome back</h1><p class="muted" data-login-sub>Sign in to your Wall Street Alpha account.</p></div>
    <form class="stack" data-login novalidate>
      <button class="btn btn--ghost btn--block google" type="button" data-google>{G}Continue with Google</button>
      <div class="or">or with email</div>
      <label class="field" for="li-email">Email<input id="li-email" type="email" autocomplete="email" placeholder="you@school.edu"></label>
      <div class="field" data-pw-field><span class="row-wrap" style="justify-content:space-between"><label for="li-pass">Password</label><button class="link" type="button" style="font-size:13px" data-mode-link="forgot">Forgot password / set a password</button></span>
        <input id="li-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
      <p class="status" data-login-error role="alert" hidden></p>
      <button class="btn btn--solid btn--block" type="submit">Sign in</button>
      <div class="stack-sm" style="align-items:flex-start">
        <button class="link" type="button" data-mode-link="link">Email me a sign-in link instead</button>
        <button class="link" type="button" data-mode-link="password" hidden>Use a password instead</button>
      </div>
      <p class="fine">Joining the program? <a class="textlink" href="join">Create your account</a></p>
    </form>
    <div class="form-card" data-login-sent hidden>
      <span class="big-check">{svg('mail')}</span>
      <p>Check your inbox. We sent <span data-sent-what>a sign-in link</span> to <b data-sent-email></b>. Open it on this device to get straight in.</p>
      <a class="btn btn--solid btn--block" data-sent-open href="auth/callback">Open the link (preview) {arrow()}</a>
      <button class="link" type="button" data-sent-back>Use a different email</button>
    </div>
    <div class="demo-box"><span class="label">Preview accounts · one click</span>
      <button type="button" data-demo="student@wallstalpha.com"><b>Academy student</b><span>student@wallstalpha.com · portal, resources, jobs</span></button>
      {'<button type="button" data-demo="member@wallstalpha.com"><b>Free forum member</b><span>member@wallstalpha.com · community only, no 1:1</span></button>' if b.FREE_MEMBERSHIP else ""}
      <button type="button" data-demo="coach@wallstalpha.com"><b>Coach</b><span>coach@wallstalpha.com · assigned students only</span></button>
      <button type="button" data-demo="chase@wallstalpha.com"><b>Admin (Chase)</b><span>chase@wallstalpha.com · everything</span></button>
    </div>
  </div></div>
  {side}
</main>"""
    page("login", "Sign in · Wall Street Alpha", "Sign in to your Wall Street Alpha account.", login, pid="login", chrome="funnel")

    JOIN_NOTE = (f'''<div class="snapshot-note">{svg('user')}<span><b>Preview.</b> <b>new.student@wallstalpha.com</b> is on Chase's approved list (12-week program) and <b>new.coach@wallstalpha.com</b> is an approved coach. Any other email gets a free forum account: community and lectures, no portal, no 1:1.</span></div>''' if b.FREE_MEMBERSHIP else
                 f'''<div class="snapshot-note">{svg('user')}<span><b>Preview.</b> <b>new.student@wallstalpha.com</b> is on Chase's approved list (12-week program) and <b>new.coach@wallstalpha.com</b> is an approved coach. Other emails can't create an account until Chase approves them.</span></div>''')
    join = f"""<main class="split">
  <div class="split-main"><div>
    <div class="stack-sm"><h1 class="h3" style="font-size:32px">Create your account</h1>
      <p class="muted">{"A free account gets you the community and free lectures. Joining the Academy? Use the email your mentor approved and the library, job board and student portal unlock automatically." if b.FREE_MEMBERSHIP else 'For WSA Academy students. Use the email your mentor approved and the library, job board and student portal unlock automatically. Not a student yet? <a class="textlink" href="apply">Apply to the Academy</a>.'}</p></div>
    {JOIN_NOTE}
    <form class="stack" data-join data-free="{1 if b.FREE_MEMBERSHIP else 0}" novalidate>
      <button class="btn btn--ghost btn--block google" type="button" data-google>{G}Sign up with Google</button>
      <div class="or">or with email</div>
      <label class="field" for="jn-name">Full name<input id="jn-name" autocomplete="name" placeholder="Alex Teng"></label>
      <label class="field" for="jn-email">Email<input id="jn-email" type="email" autocomplete="email" placeholder="you@school.edu"></label>
      <label class="field" for="jn-pass">Password<input id="jn-pass" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label>
      <div class="fields-2"><label class="field" for="jn-school">School<input id="jn-school" autocomplete="organization" placeholder="e.g. Indiana"></label>
        <label class="field" for="jn-year">Class of<select id="jn-year"><option>2027</option><option selected>2028</option><option>2029</option><option>2030</option><option>Graduated</option></select></label></div>
      <p class="status" data-join-error role="alert" hidden></p>
      <button class="btn btn--solid btn--block" type="submit">Create account {arrow()}</button>
      <p class="fine">Have an account? <a class="textlink" href="login">Sign in</a>. By joining you agree to the <a class="textlink" href="terms">Terms</a> and <a class="textlink" href="privacy">Privacy Policy</a>.</p>
    </form>
  </div></div>
  {side}
</main>"""
    page("join", "Create your account · Wall Street Alpha", "Create a free Wall Street Alpha account.", join, pid="join", chrome="funnel")

    reset = f"""<main class="center-page"><div>
  <h1 class="h3" style="font-size:32px">Set a new password</h1>
  <p class="muted">Choose a password you'll use to sign in from now on.</p>
  <form class="form-card" data-reset novalidate style="width:100%">
    <label class="field" for="rp-new">New password<input id="rp-new" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label>
    <label class="field" for="rp-confirm">Confirm password<input id="rp-confirm" type="password" autocomplete="new-password"></label>
    <p class="status" data-reset-error role="alert" hidden></p>
    <button class="btn btn--solid btn--block" type="submit">Save password</button>
  </form>
  <p class="fine">Remembered it? Go back to the <a class="textlink" href="login">sign-in page</a>.</p>
</div></main>"""
    page("reset-password", "Set a new password · Wall Street Alpha", "Set a new password.", reset, pid="reset", chrome="funnel")

    cb = """<main class="center-page"><div style="align-items:center;text-align:center">
  <span class="spinner" style="width:28px;height:28px"></span>
  <h1 class="h3" data-callback-msg>Signing you in…</h1>
  <div class="stack-sm" data-callback-fail hidden><p class="muted">Could not complete sign-in. The link may have expired.</p><a class="btn btn--solid btn--sm" href="login">Back to sign in</a></div>
</div></main>"""
    page("auth/callback", "Signing you in · Wall Street Alpha", "Signing you in.", cb, pid="auth-callback", chrome="bare")

    go = """<main class="center-page"><div style="align-items:center;text-align:center">
  <span class="spinner" style="width:28px;height:28px"></span>
  <h1 class="h3">Connecting Google Calendar…</h1>
  <p class="muted">Calls on your calendar will show up in the coach portal.</p>
  <a class="link" href="coach/calendar">Back to dashboard</a>
</div></main>"""
    page("google-oauth", "Connecting Google Calendar · Wall Street Alpha", "Connecting Google Calendar.", go, pid="google-oauth", chrome="bare", require="staff")

    roles = ["Investment Banking", "Sales & Trading", "Equity Research", "Private Equity", "Private Credit", "Hedge Funds", "Asset Management", "Wealth Management", "Still deciding"]
    opts = "".join(f"<option>{e(r)}</option>" for r in roles)
    onb = f"""<main class="section"><div class="wrap" style="max-width:760px">
  <form class="form-card" data-onboarding novalidate>
    <div class="stack-sm"><span class="label">Welcome to Wall Street Alpha</span><h1 class="h3" style="font-size:32px">Set up your profile</h1>
      <p class="muted">Your coach reads this before your first call. You can change any of it later from your profile.</p></div>
    <div class="fields-2"><label class="field" for="ob-name">Full name<input id="ob-name" autocomplete="name" placeholder="Jordan Alvarez"></label>
      <label class="field" for="ob-school">School<input id="ob-school" placeholder="e.g. NYU Stern"></label></div>
    <div class="fields-2"><label class="field" for="ob-gpa">GPA<input id="ob-gpa" inputmode="decimal" placeholder="3.75"></label>
      <label class="field" for="ob-linkedin">LinkedIn URL<input id="ob-linkedin" type="url" placeholder="https://www.linkedin.com/in/…"></label></div>
    <label class="field" for="ob-tracker"><span>Tracker sheet link <span class="opt">(optional)</span></span><input id="ob-tracker" type="url" placeholder="https://docs.google.com/spreadsheets/d/…"><span class="hint">The Google Sheet where you track your recruiting, shared as "Anyone with the link" so your coach can open it.</span></label>
    <div class="fields-2"><label class="field" for="ob-role">Target role<select id="ob-role"><option value="">Select…</option>{opts}</select></label>
      <label class="field" for="ob-role2"><span>Secondary role <span class="opt">(optional)</span></span><select id="ob-role2"><option value="">Select…</option>{opts}</select></label></div>
    <label class="field" for="ob-photo">Headshot<input id="ob-photo" type="file" accept="image/*"></label>
    <label class="field" for="ob-cv">Resume<input id="ob-cv" type="file" accept=".pdf,.doc,.docx"><span class="hint">PDF or Word doc, up to 10 MB. Your coach reads it before your first call. You can add or swap it any time from your profile.</span></label>
    <label class="field" for="ob-net">Networking tracker<input id="ob-net" type="file" accept=".xlsx,.csv"><span class="hint">Excel or CSV, up to 10 MB. Upload your current networking tracker so your coach can see who you've already reached out to. It's saved to your Networking contacts folder.</span></label>
    <p class="fine">In this preview the three uploads are optional. At launch, headshot, resume and tracker are required.</p>
    <p class="status" data-ob-error role="alert" hidden></p>
    <button class="btn btn--solid btn--block" type="submit">Save and continue {arrow()}</button>
  </form>
</div></main>"""
    page("onboarding", "Set up your profile · Wall Street Alpha", "Set up your Wall Street Alpha profile.", onb, pid="onboarding", chrome="funnel", require="student")

    if b.FREE_MEMBERSHIP:
        mem = f"""<main>
    <section class="page-hero"><div class="wrap">
      <div class="notice" data-welcome hidden style="background:var(--gain-bg);color:var(--gain)">{svg('check')}<span><b>Your free account is ready.</b> Start with the community or the free live lecture.</span></div>
      <span class="label">Membership</span>
      <h1 class="h1">Free account or the <span class="mark">Academy.</span></h1>
      <p class="sub">Your free account covers the community and the free lectures. The resource library, the job board and the student portal come with the WSA Academy.</p>
    </div></section>
    <section class="section--tight"><div class="wrap paths">
      <article class="path"><span class="label">Your plan</span><h3>Free account</h3><p class="price">$0 <small data-user-email></small></p>
        {ticks(["Community forums for every desk", "Free live lectures with Chase", "Chase's Placement Playbook: Technicals Guide"])}
        <div class="ctas"><a class="btn btn--ghost" href="community">Go to the community</a></div></article>
      <article class="path path--academy"><span class="label">By application</span><h3>The WSA Academy</h3><p class="price">Coached by Chase <small>limited seats per cycle</small></p>
        {ticks(["The full resource library: 50+ guides, scripts and playbooks", "The live job board, refreshed daily", "1:1 coaching, mock interviews and mock superdays", "The student portal: program, modules, deadlines and contacts"])}
        <div class="ctas"><a class="btn btn--solid" href="apply">Apply now {arrow()}</a></div></article>
    </div></section>
    <section class="section--tight"><div class="wrap"><p class="fine">Already an Academy student? Log out and log back in with the email your mentor approved, and everything unlocks.</p></div></section>
    <div style="height:48px"></div>
    </main>"""
        page("membership", "Membership · Wall Street Alpha", "What your free account includes and what the WSA Academy adds.", mem, pid="membership")
    else:
        page("membership", "WSA Academy · Wall Street Alpha", "The WSA Academy.", f'<main class="center-page"><div><span class="spinner"></span><p class="muted">Taking you to <a class="textlink" href="{"academy" if b.ACADEMY_PAGE else "vsl"}">the WSA Academy</a>…</p></div></main>',
             pid="redirect", chrome="bare", redirect="academy" if b.ACADEMY_PAGE else "vsl")

    # ------------------------------------------------------------------ app shell
    # Navigation copied from DashboardApp.tsx: students get ten tabs, staff get the coach side.
    # Programs, Modules and Coaches are admin-only; the Deal Desk is Chase's account only.
    STUDENT_NAV = [("dashboard", "Pipeline", "pipeline"), ("dashboard/program", "Program", "calendar"), ("dashboard/modules", "Modules", "layers"),
                   ("dashboard/events", "Events", "users"), ("dashboard/deadlines", "Deadlines", "flag"), ("dashboard/assessments", "Assessments", "chart"),
                   ("dashboard/contacts", "Contacts", "phone"), ("dashboard/files", "Files", "folder"), ("dashboard/resources", "Resources", "book"),
                   ("dashboard/profile", "Profile", "user")]
    STAFF_NAV = [("coach", "Today", "home", ""), ("coach/students", "Students", "users", ""), ("coach/calls", "Calls", "phone", ""),
                 ("coach/contacts", "Contacts", "chat", ""), ("coach/events", "Events", "calendar", ""), ("coach/opportunities", "Opportunities", "flag", ""),
                 ("coach/calendar", "Calendar", "clock", ""), ("coach/programs", "Programs", "layers", "owner"), ("coach/modules", "Modules", "book", "owner"),
                 ("coach/resources", "Resources", "file", ""), ("coach/coaches", "Coaches", "user", "owner"), ("coach/deal-desk", "Deal Desk", "dollar", "dealdesk"),
                 ("webinar-data", "Lecture data", "chart", "owner")]
    RES = [{k: r[k] for k in ("slug", "title", "desc", "cat", "listed", "thumb", "pages")} for r in resources]

    def shell(kind, active, title, view):
        nav = [(h, t, i, "") for h, t, i in STUDENT_NAV] if kind == "student" else STAFF_NAV
        gate = {"owner": " data-owner-only", "dealdesk": " data-dealdesk-only", "": ""}
        cur = lambda h: ' aria-current="page"' if h == active else ""
        links = "".join(f'<a href="{h}"{gate[g]}{cur(h)}>{svg(ic)}{t}</a>' for h, t, ic, g in nav)
        tabs = "".join(f'<a href="{h}"{gate[g]}{cur(h)}>{t}</a>' for h, t, _, g in nav)
        label = "Student portal" if kind == "student" else "Coach portal"
        return f"""<div class="app">
  <aside class="sidebar">
    <a class="brand" href="./" aria-label="Wall Street Alpha home"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="137" height="42"></a>
    <span class="role-badge" data-role-label>{"Student" if kind == "student" else "Coach"}</span>
    <nav class="side-nav" aria-label="{label}">{links}</nav>
    <div class="side-foot">
      <div class="who-mini"><span class="avatar" data-user-initials></span><div><b data-user-name></b><span data-user-email></span></div></div>
      <button class="side-btn" type="button" data-logout>Sign out</button>
      <a href="./">Back to the website</a>
      <button class="link side-reset" type="button" data-reset-demo>Reset demo data</button>
    </div>
  </aside>
  <div class="app-main">
    <div class="topbar"><div class="inner">
      <a class="mobile-brand brand" href="./" aria-label="Wall Street Alpha home"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="124" height="38"></a>
      <h1 class="topbar-title">{title}</h1>
      <span class="tag" style="margin-left:auto">Sample data</span>
      {b.user_menu()}
    </div></div>
    <nav class="tabs-mobile" aria-label="{label}">{tabs}</nav>
    <main class="app-content"><div data-view="{view}" class="stack" style="gap:20px"><p class="muted">Loading…</p></div></main>
  </div>
</div>"""

    def spage(path, title, view, require="student", res=False):
        page(path, f"{title} · Student portal · Wall Street Alpha", f"{title} in the Wall Street Alpha student portal.",
             shell("student", path, title, view), pid="app", chrome="app", require=require, app=True,
             inline_js=("window.WSA_RESOURCES=" + json.dumps(RES) + ";") if res else "")

    def cpage(path, title, view, require="staff", res=False):
        page(path, f"{title} · Coach portal · Wall Street Alpha", f"{title} in the Wall Street Alpha coach portal.",
             shell("staff", path, title, view), pid="app", chrome="app", require=require, app=True,
             inline_js=("window.WSA_RESOURCES=" + json.dumps(RES) + ";") if res else "")

    for path, title, view in [("dashboard", "Pipeline", "pipeline"), ("dashboard/program", "Program", "program"), ("dashboard/modules", "Modules", "modules"),
                              ("dashboard/events", "Events", "events"), ("dashboard/deadlines", "Deadlines", "deadlines"), ("dashboard/assessments", "Assessments", "assessments"),
                              ("dashboard/contacts", "Contacts", "contacts"), ("dashboard/calls", "Calls", "calls"), ("dashboard/files", "Files", "files"),
                              ("dashboard/profile", "Profile", "profile")]:
        spage(path, title, view)
    spage("dashboard/resources", "Resources", "resources", res=True)
    spage("dashboard/module", "Module", "module", require="academy")

    for path, title, view, req in [("coach", "Today", "today", "staff"), ("coach/queue", "Full queue", "queue", "staff"), ("coach/students", "Students", "students", "staff"),
                                   ("coach/student", "Student record", "student", "staff"), ("coach/calls", "Calls", "s-calls", "staff"), ("coach/contacts", "Contacts", "s-contacts", "staff"),
                                   ("coach/events", "Events", "s-events", "staff"), ("coach/opportunities", "Opportunities", "opportunities", "staff"),
                                   ("coach/calendar", "Calendar", "calendar", "staff"), ("coach/programs", "Programs", "programs", "owner"),
                                   ("coach/modules", "Modules", "s-modules", "owner"), ("coach/coaches", "Coaches", "coaches", "owner"),
                                   ("coach/deal-desk", "Deal Desk", "dealdesk", "dealdesk")]:
        cpage(path, title, view, require=req)
    cpage("coach/resources", "Resources", "s-resources", res=True)

    def table(heads, rows):
        return ('<div class="table-wrap"><table class="t"><thead><tr>' + "".join(f"<th>{h}</th>" for h in heads) + "</tr></thead><tbody>" +
                "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table></div>")

    pill = lambda t, k="plain": f'<span class="pill pill--{k}">{t}</span>'

    # ------------------------------------------------------------------ lecture reporting (admin)
    adm = f"""<main class="center-page"><div>
  <span class="label">Webinar data</span><h1 class="h3" style="font-size:30px">Admin sign in</h1>
  <form class="form-card" data-admin-login novalidate style="width:100%">
    <label class="field" for="ad-email">Email<input id="ad-email" type="email" autocomplete="email" placeholder="you@wallstalpha.com"></label>
    <label class="field" for="ad-pass">Password<input id="ad-pass" type="password" autocomplete="current-password"></label>
    <p class="status" data-admin-error role="alert" hidden></p>
    <button class="btn btn--solid btn--block" type="submit">Sign in</button>
    <a class="link" href="login?mode=link" style="font-size:13.5px">Forgot password or use a sign-in link</a>
  </form>
  <p class="fine">Preview: any email and password works.</p>
</div></main>"""
    page("webinar-data-login", "Webinar Data sign in · Wall Street Alpha", "Private admin sign-in for lecture reporting.", adm, pid="admin-login", chrome="funnel")

    daily = [12, 18, 9, 24, 31, 28, 40, 36, 22, 45, 51, 38, 47, 60]
    mx = max(daily)
    bars = "".join(f'<rect x="{i * 40 + 8}" y="{150 - v / mx * 130:.1f}" width="26" height="{v / mx * 130:.1f}" rx="4" fill="var(--accent)"/><text x="{i * 40 + 21}" y="168" text-anchor="middle" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono, monospace">{i + 1}</text>' for i, v in enumerate(daily))
    src = [("Meta ads", 168), ("Instagram", 104), ("Email", 61), ("DM links", 47), ("Direct", 32)]
    smax = max(v for _, v in src)
    srcrows = "".join(f'<div class="meter" style="grid-template-columns:90px minmax(0,1fr) 40px">{n}<span class="track"><i style="width:{v / smax * 100:.0f}%"></i></span><b>{v}</b></div>' for n, v in src)
    regs = [("Alex T.", "Indiana · 2028", "Meta ads", "Yes", "Added"), ("Priya S.", "Michigan · 2028", "Instagram", "No", "Added"), ("Noah P.", "Rutgers · 2027", "DM links", "Yes", "—"),
            ("Grace L.", "BU · 2028", "Email", "No", "Added"), ("Lucas M.", "Texas · 2027", "Meta ads", "Yes", "—"), ("Mia R.", "Tulane · 2028", "Instagram", "No", "Added")]
    rep = f"""<div class="app-main" style="min-height:100vh">
  <div class="topbar"><div class="inner"><a class="brand" href="./"><img class="lockup" src="assets/wsa-lockup.png" alt="Wall Street Alpha" width="124" height="38" style="height:38px"></a>
    <span class="tag" style="margin-left:8px">Webinar data</span><div class="row-wrap" style="margin-left:auto"><a class="link" href="coach">Coach portal</a><button class="btn btn--ghost btn--xs" type="button" data-admin-logout>Sign out</button></div></div></div>
  <main class="app-content" style="margin-inline:auto">
    <div class="app-head"><div><h1>Chase's Placement Playbook: Live Lecture</h1><p>Saturday, October 24 · 2:00 PM ET · Zoom</p></div><span class="tag">Sample data</span></div>
    <div class="stats">
      <div class="stat"><span class="label">Registrations</span><b>412</b><small>+60 yesterday</small></div>
      <div class="stat"><span class="label">Parent tickets</span><b>63</b><small>15% of registrants</small></div>
      <div class="stat"><span class="label">Apple Wallet adds</span><b>188</b><small>46% of registrants</small></div>
      <div class="stat"><span class="label">Calendar adds</span><b>241</b><small>Google 61% · Outlook 27%</small></div>
    </div>
    <div class="cols-2">
      <div class="panel"><div class="panel-head"><h2>Registrations per day</h2><span class="faint" style="font-size:13px">Last 14 days</span></div><div class="panel-body" style="overflow-x:auto">
        <svg viewBox="0 0 560 176" width="100%" style="min-width:420px" role="img" aria-label="Daily registrations over the last 14 days, rising from 12 to 60">{bars}</svg></div></div>
      <div class="panel"><div class="panel-head"><h2>By source</h2></div><div class="panel-body">{srcrows}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><h2>Latest registrants</h2></div>
      {table(["Name", "School", "Source", "Parent ticket", "Wallet"], [[f"<span class=strong>{n}</span>", s, so, p, pill(w, "gain") if w == "Added" else w] for n, s, so, p, w in regs])}</div>
  </main>
</div>"""
    page("webinar-data", "Webinar data · Wall Street Alpha", "Lecture registration reporting.", rep, pid="admin", chrome="app", require="webinar-admin")
