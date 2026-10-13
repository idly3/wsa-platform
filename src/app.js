/* Wall Street Alpha portal (preview build): renders every student and staff screen from the mock
   database in db.js. Screens and rules follow the Lovable app (DashboardApp.tsx, CoachToday,
   OpportunitiesView, CoachesView and friends). Every change saves to this browser only. */
(function () {
  "use strict";
  var DB = window.WSA_DB;
  var root = document.querySelector("[data-view]");
  if (!DB || !root || window.WSA_REDIRECTING) return;
  var me = window.WSA_ME;
  if (!me) return;
  var view = root.getAttribute("data-view");
  var db = DB.load();
  var params = new URLSearchParams(window.location.search);

  /* ------------------------------------------------------------------ helpers */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var url = function (p) { return new URL(p, document.baseURI).href; };
  var go = function (p) { window.location.href = url(p); };
  var toast = function (m) { if (window.wsaToast) window.wsaToast(m); };
  var save = function (msg) { DB.save(); if (msg) toast(msg); render(); };
  var d0 = function (s) { return s ? new Date(s.length === 10 ? s + "T12:00:00" : s) : null; };
  var fmtDate = function (s) { var d = d0(s); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""; };
  var fmtLong = function (s) { var d = d0(s); return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""; };
  var fmtTime = function (s) { var d = d0(s); return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase() : ""; };
  var today = DB.iso(Date.now());
  var dayDiff = function (s) { var a = d0(s), b = d0(today); return Math.round((a - b) / DB.DAY); };
  var relDay = function (s) { var n = dayDiff(s); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 0 ? "in " + n + " days" : -n + " days ago"; };
  var money = function (c) { return "$" + Math.round((c || 0) / 100).toLocaleString("en-US"); };
  var initials = function (n) { var p = String(n || "?").trim().split(/[\s@._-]+/).filter(Boolean); return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase(); };
  var first = function (n) { return String(n || "").trim().split(/\s+/)[0] || "there"; };
  var pill = function (t, k) { return '<span class="pill pill--' + (k || "plain") + '">' + esc(t) + "</span>"; };
  var student = function (id) { return DB.profile(id); };
  var isStaff = DB.isStaff(me), isAdmin = DB.isAdmin(me);
  var students = function (opts) { return DB.visibleStudents(me, opts); };
  var sids = function () { return students({ includeArchived: true }).map(function (s) { return s.id; }); };
  var mine = function (rows) { var ok = isStaff ? sids() : [me.id]; return rows.filter(function (r) { return ok.indexOf(r.student_id) > -1; }); };
  var coachOf = function (sid) { var l = db.coach_students.filter(function (x) { return x.student_id === sid; })[0]; return l ? student(l.coach_id) : null; };
  var ASSESS = { mock_interview: ["Mock interview", 10], modeling: ["Modeling test", 100], dcf: ["DCF", 100], lbo: ["LBO", 100] };
  var EVENT_KIND = { info_session: "Info session", coffee_chat: "Coffee chat", career_fair: "Career fair", networking: "Networking event", deadline: "Deadline", other: "Other" };
  var ROLE_TYPE = { internship: "Internship", full_time: "Full-time", early_insight: "Early insight", event: "Event", other: "Other" };

  function table(heads, rows, empty) {
    if (!rows.length) return '<p class="empty">' + (empty || "Nothing here yet.") + "</p>";
    return '<div class="table-wrap" style="border:0;border-radius:0"><table class="t"><thead><tr>' + heads.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.map(function (r) { return r.raw ? r.raw : "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function panel(title, right, body, cls) { return '<section class="panel ' + (cls || "") + '"><div class="panel-head"><h2>' + title + "</h2>" + (right || "") + "</div>" + body + "</section>"; }
  function stat(label, value, sub, tone) { return '<div class="stat"><span class="label">' + label + "</span><b" + (tone ? ' style="color:var(--' + tone + ')"' : "") + ">" + value + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>"; }
  function bar(done, total, label) { var pct = total ? Math.min(100, Math.round(done / total * 100)) : 0; return '<div class="stack-sm"><div class="row-wrap" style="justify-content:space-between"><span class="faint" style="font-size:13px">' + label + '</span><b class="mono" style="font-size:13px">' + done + " of " + total + '</b></div><div class="meter-bar"><i style="width:' + pct + '%;background:var(--accent)"></i></div></div>'; }

  /* simple dialog builder for add/log forms */
  function dialog(title, fieldsHtml, submitLabel, onSubmit) {
    var dl = document.createElement("dialog");
    dl.className = "app-dialog";
    dl.innerHTML = '<form class="stack" method="dialog" novalidate><div class="row-wrap" style="justify-content:space-between"><h2 class="h3" style="font-size:22px">' + title +
      '</h2><button class="x" type="button" data-close aria-label="Close">×</button></div>' + fieldsHtml + '<p class="status" data-derr hidden></p><div class="row-wrap" style="justify-content:flex-end"><button class="btn btn--ghost btn--sm" type="button" data-close>Cancel</button><button class="btn btn--solid btn--sm" type="submit">' + submitLabel + "</button></div></form>";
    document.body.appendChild(dl);
    var close = function () { dl.close(); dl.remove(); };
    dl.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });
    dl.addEventListener("cancel", function () { dl.remove(); });
    dl.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var vals = {}; dl.querySelectorAll("[name]").forEach(function (el) { vals[el.name] = el.type === "checkbox" ? el.checked : el.type === "file" ? el.files : el.value.trim(); });
      var err = onSubmit(vals);
      if (err) { var p = dl.querySelector("[data-derr]"); p.textContent = err; p.className = "status status--error"; p.hidden = false; return; }
      close();
    });
    dl.showModal();
    var f = dl.querySelector("input,select,textarea"); if (f) f.focus();
  }
  var fld = function (name, label, type, ph, opts) {
    opts = opts || {};
    if (type === "select") return '<label class="field">' + label + '<select name="' + name + '">' + opts.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === opts.value ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
    if (type === "textarea") return '<label class="field">' + label + '<textarea name="' + name + '" placeholder="' + esc(ph || "") + '" rows="' + (opts.rows || 4) + '">' + esc(opts.value || "") + "</textarea></label>";
    return '<label class="field">' + label + '<input name="' + name + '" type="' + (type || "text") + '" placeholder="' + esc(ph || "") + '" value="' + esc(opts.value || "") + '"' + (opts.accept ? ' accept="' + opts.accept + '"' : "") + "></label>";
  };

  /* ------------------------------------------------------------------ shared mutations */
  function addContact(sid, v, callId) {
    db.contacts.unshift({ id: DB.uid("k"), student_id: sid, name: v.name, bank: v.bank || null, group_name: v.group || null, title: v.title || null, email: v.email || null, linkedin_url: v.linkedin || null, personal_notes: v.notes || null, call_id: callId || null, event_id: null, created_at: today });
  }
  function logCall(sid) {
    dialog("Log a networking call", fld("date", "Date", "date", "", { value: today }) + fld("name", "Who did you speak with? <span class=\"opt\">(optional)</span>", "text", "Priya Raman") +
      '<div class="fields-2">' + fld("bank", "Firm", "text", "Morgan Stanley") + fld("group", "Group", "text", "Equity Research") + "</div>" +
      fld("notes", "Your notes", "textarea", "What you talked about, what they offered, what you promised to send.", { rows: 5 }) +
      '<p class="fine">Notes come first. The AI writes up how it went and who you spoke with, the same way the live portal does.</p>', "Log call", function (v) {
        if (!v.notes) return "Add a few lines of notes so the AI has something to read.";
        var id = DB.uid("c");
        db.calls.unshift({ id: id, student_id: sid, call_date: v.date || today, status: "uploaded", ai_summary: null, improvement_notes: null, student_notes: v.notes });
        if (v.name) addContact(sid, { name: v.name, bank: v.bank, group: v.group, notes: "From the call on " + fmtDate(v.date || today) + "." }, id);
        save("Call logged. The AI is reading it…");
        setTimeout(function () {
          var c = db.calls.filter(function (x) { return x.id === id; })[0]; if (!c) return;
          var who = v.name ? v.name + (v.bank ? " at " + v.bank : "") : "your contact";
          c.status = "parsed";
          c.ai_summary = "You spoke with " + who + ". " + v.notes.replace(/\s+/g, " ").slice(0, 220) + (v.notes.length > 220 ? "…" : "");
          c.improvement_notes = /send|deck|pitch|resume/i.test(v.notes) ? "Send what you promised within 48 hours while the conversation is warm." : "Close with one specific ask next time, like an intro to someone on their team.";
          save("AI read ready");
        }, 1600);
      });
  }
  function addContactDialog(sid) {
    dialog("Add contact", fld("name", "Name *", "text", "Full name") + '<div class="fields-2">' + fld("bank", "Firm", "text", "Evercore") + fld("group", "Group", "text", "M&A") + "</div>" +
      '<div class="fields-2">' + fld("title", "Role", "text", "Associate") + fld("email", "Email", "email", "name@firm.com") + "</div>" + fld("linkedin", "LinkedIn", "url", "https://www.linkedin.com/in/…") + fld("notes", "Notes", "textarea", "Where you met, what they said, what's next.", { rows: 3 }), "Save contact", function (v) {
        if (!v.name) return "Add their name.";
        addContact(sid, v); save("Contact saved");
      });
  }
  function eventDialog(sid, ev) {
    ev = ev || {};
    dialog(ev.id ? "Edit event" : "Log event", fld("kind", "Type", "select", "", { value: ev.kind || "coffee_chat", options: Object.keys(EVENT_KIND).map(function (k) { return [k, EVENT_KIND[k]]; }) }) +
      fld("title", "Event", "text", "Coffee with an Evercore associate", { value: ev.title }) + '<div class="fields-2">' + fld("company", "Firm", "text", "Evercore", { value: ev.company }) + fld("date", "Date", "date", "", { value: ev.event_date || today }) + "</div>" +
      fld("location", "Location", "text", "Midtown", { value: ev.location }) + fld("notes", "Notes (the recap)", "textarea", "Who you met and what's next.", { value: ev.notes, rows: 3 }), ev.id ? "Save changes" : "Log event", function (v) {
        if (!v.title) return "Give the event a name.";
        var row = ev.id ? ev : { id: DB.uid("ev"), student_id: sid };
        Object.assign(row, { kind: v.kind, title: v.title, company: v.company || null, event_date: v.date || null, location: v.location || null, notes: v.notes || null });
        if (!ev.id) db.events.unshift(row);
        save(ev.id ? "Event updated" : "Event logged");
      });
  }
  function icsFor(ev) {
    var dt = (ev.event_date || today).replace(/-/g, "");
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wall Street Alpha//Preview//EN", "BEGIN:VEVENT", "UID:" + ev.id + "@wallstalpha", "DTSTAMP:" + dt + "T090000Z", "DTSTART;VALUE=DATE:" + dt, "SUMMARY:" + (ev.title || "").replace(/[,;]/g, " "), "LOCATION:" + (ev.location || ""), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  }
  function gcalUrl(ev) { var dt = (ev.event_date || today).replace(/-/g, ""); var nx = DB.iso(d0(ev.event_date || today).getTime() + DB.DAY).replace(/-/g, ""); return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.title) + "&dates=" + dt + "/" + nx + "&location=" + encodeURIComponent(ev.location || ""); }
  function callDetail(c) {
    var linked = db.contacts.filter(function (k) { return k.call_id === c.id; });
    dialog("Call · " + fmtDate(c.call_date), '<div class="stack-sm"><span class="label">Who</span><p>' + (linked.length ? esc(linked.map(function (k) { return k.name + (k.bank ? " · " + k.bank : ""); }).join(", ")) : '<span style="color:var(--warn)">Needs contact</span>') + "</p></div>" +
      (c.ai_summary ? '<div class="stack-sm"><span class="label">AI read</span><p>' + esc(c.ai_summary) + "</p></div>" : "") +
      (c.improvement_notes ? '<div class="note" style="font-size:14px">' + esc(c.improvement_notes) + "</div>" : "") +
      (c.student_notes ? '<div class="stack-sm"><span class="label">Your notes</span><p class="muted">' + esc(c.student_notes) + "</p></div>" : "") +
      (c.status === "failed" ? '<p class="status status--error">The AI couldn\'t read this one. Re-log it with typed notes.</p>' : ""), "Done", function () { return null; });
  }
  function callStatus(c) {
    var linked = db.contacts.filter(function (k) { return k.call_id === c.id; });
    if (c.status === "uploaded") return '<span style="color:var(--warn);font-weight:600">Parsing…</span>';
    if (c.status === "failed") return '<span style="color:var(--bad);font-weight:600">Parsing failed</span>';
    if (!linked.length) return '<span style="color:var(--warn);font-weight:600">Needs contact</span>';
    return '<b>' + esc(linked.map(function (k) { return k.name; }).join(", ")) + '</b><span class="sub-line">' + esc([linked[0].bank, linked[0].group_name].filter(Boolean).join(" · ")) + "</span>";
  }

  /* ------------------------------------------------------------------ coaching model (Today, roster, queue) */
  function model(s) {
    var en = DB.enrollmentFor(s.id), prog = en ? DB.program(en.program_id) : null;
    var met = DB.weeksMet(en).length, total = prog ? prog.duration_weeks : 0;
    var now = Date.now();
    var nextCall = db.calendar_events.filter(function (e) { return e.student_id === s.id && new Date(e.starts_at).getTime() > now - 3600000; }).sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); })[0] || null;
    var hasPlan = db.session_plans.some(function (p) { return p.student_id === s.id; });
    var overdue = db.payments.filter(function (p) { return p.student_id === s.id && !p.paid_on && p.due_on < today; });
    var alerts = [];
    if (overdue.length) alerts.push({ tier: "urgent", msg: "Payment overdue " + money(overdue.reduce(function (a, p) { return a + p.amount_cents; }, 0)), sub: s.full_name + " · " + overdue[0].label + ", " + -dayDiff(overdue[0].due_on) + " days late", act: "Remind" });
    if (nextCall && !hasPlan) {
      var hrs = (new Date(nextCall.starts_at) - now) / 3600000;
      if (hrs <= 24) alerts.push({ tier: "urgent", msg: "Call within 24h and no plan prepared", sub: s.full_name + " · " + fmtLong(nextCall.starts_at) + " " + fmtTime(nextCall.starts_at), act: "Prep" });
      else alerts.push({ tier: "action", msg: "Upcoming call has no next-session plan", sub: s.full_name + " · " + fmtLong(nextCall.starts_at), act: "Prep" });
    }
    if (!nextCall && en && en.status === "active") alerts.push({ tier: "action", msg: "No coaching session scheduled", sub: s.full_name + " · week " + DB.currentWeek(en) + " of " + total, act: "Book" });
    var lastNote = db.call_notes.filter(function (nn) { return nn.student_id === s.id; }).sort(function (a, b) { return a.session_date < b.session_date ? 1 : -1; })[0];
    if (en && en.status === "active" && met > 0 && (!lastNote || dayDiff(lastNote.session_date) < -10)) alerts.push({ tier: "action", msg: "Last session has no summary", sub: s.full_name + " · add the call notes", act: "Open" });
    if (total && total - met === 1) alerts.push({ tier: "info", msg: "One weekly check-in left", sub: s.full_name + " · week " + met + " of " + total, act: "Renew" });
    var tier = alerts.some(function (a) { return a.tier === "urgent"; }) ? "urgent" : alerts.some(function (a) { return a.tier === "action"; }) ? "action" : "none";
    var flag = alerts[0] ? alerts[0].msg : nextCall ? "Next call " + fmtLong(nextCall.starts_at) + " " + fmtTime(nextCall.starts_at) : "All done for now";
    return { s: s, en: en, prog: prog, met: met, total: total, week: DB.currentWeek(en), nextCall: nextCall, hasPlan: hasPlan, alerts: alerts, tier: tier, flag: flag, overdue: overdue };
  }
  var TIER = { urgent: "var(--bad)", action: "var(--warn)", none: "var(--line-strong)", info: "var(--info)" };

  /* ================================================================== STUDENT VIEWS */
  var V = {};

  V.pipeline = function () {
    var calls = mine(db.calls).sort(function (a, b) { return a.call_date < b.call_date ? 1 : -1; });
    var contacts = mine(db.contacts), banks = contacts.map(function (k) { return k.bank; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var thisWeek = calls.filter(function (c) { return dayDiff(c.call_date) > -7; }).length, lastWeek = calls.filter(function (c) { var d = dayDiff(c.call_date); return d <= -7 && d > -14; }).length;
    var delta = thisWeek - lastWeek;
    var en = DB.enrollmentFor(me.id), prog = en ? DB.program(en.program_id) : null, wk = DB.currentWeek(en);
    var tasks = DB.tasksFor(en, wk);
    var weekTitle = en ? (db.program_weeks.filter(function (w) { return w.program_id === en.program_id && w.week_number === wk; })[0] || {}).title : "";
    var req = DB.requiredModuleIds(me.id), reqDone = req.filter(function (m) { return DB.moduleStatus(me.id, m) === "completed"; }).length;
    var coach = coachOf(me.id);
    var A = mine(db.assessments).sort(function (a, b) { return a.assessed_on < b.assessed_on ? 1 : -1; });
    var latest = function (k) { return A.filter(function (a) { return a.kind === k; })[0]; };
    var h = new Date().getHours();
    var welcome = !calls.length && !contacts.length;
    return '<div class="app-greet"><div><div class="faint" style="font-size:13px">' + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + "</div>" +
      '<h1 class="h3" style="font-size:30px;margin-top:6px">' + (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + ", " + esc(first(me.full_name)) + '.</h1><p class="muted" style="margin-top:6px">' +
      (thisWeek ? thisWeek + " call" + (thisWeek === 1 ? "" : "s") + " logged this week. Keep the momentum going." : "No calls logged this week yet, a good week to reach out.") + '</p></div><div class="row-wrap"><button class="btn btn--ghost btn--sm" data-a="add-contact">Add contact</button><button class="btn btn--solid btn--sm" data-a="log-call">Log a call</button></div></div>' +
      '<div class="stats">' + stat("Calls logged", calls.length, calls.length ? "Since " + fmtDate(calls[calls.length - 1].call_date) : "") + stat("This week", thisWeek, calls.length ? (delta > 0 ? delta + " more than last week" : delta < 0 ? -delta + " fewer than last week" : "Same as last week") : "", delta > 0 ? "gain" : "") +
      stat("Contacts", contacts.length, banks.length ? "Across " + banks.length + " bank" + (banks.length === 1 ? "" : "s") : "", "accent") + stat("Banks reached", banks.length, banks.slice(0, 4).join(", ")) + "</div>" +
      '<div class="cols-2"><div class="stack" style="gap:20px;min-width:0">' +
      (welcome ? panel("Welcome to Wall Street Alpha", "", '<div class="panel-body"><p class="muted">A few things to get you started.</p><div class="grid-2" style="gap:8px"><a class="btn btn--ghost btn--sm" href="dashboard/profile">Complete your profile</a>' + (en ? '<a class="btn btn--ghost btn--sm" href="dashboard/program">Open your Week 1 plan</a>' : "") + '<a class="btn btn--ghost btn--sm" href="dashboard/modules">Browse the 400 Question Guide</a><button class="btn btn--ghost btn--sm" data-a="log-call">Log your first networking call</button></div></div>') : "") +
      (en ? panel("This week · Week " + wk + " of " + prog.duration_weeks + (weekTitle ? ", " + esc(weekTitle) : ""), '<a href="dashboard/program">Program</a>', '<ul class="check-list panel-body">' + tasks.map(function (t) {
        return '<li><button type="button" class="box' + (t.completed ? " on" : "") + '" data-a="tick" data-id="' + t.id + '" aria-pressed="' + t.completed + '" aria-label="Mark done">' + (t.completed ? "✓" : "") + '</button><div class="grow"><b style="font-weight:600' + (t.completed ? ";text-decoration:line-through;opacity:.6" : "") + '">' + esc(t.title) + '</b><span class="muted" style="display:block;font-size:13px">' + esc(t.description || "") + "</span></div>" + pill(t.track === "technical" ? "Technical" : "Soft skills", t.track === "technical" ? "info" : "plain") + "</li>";
      }).join("") + "</ul>") : "") +
      panel("Recent calls", '<a href="dashboard/calls">View all ' + calls.length + "</a>", calls.length ? '<ul class="list">' + calls.slice(0, 5).map(function (c) {
        return '<li style="cursor:pointer" data-a="call" data-id="' + c.id + '"><span class="mono faint" style="width:56px;font-size:12px">' + fmtDate(c.call_date) + '</span><div class="call-who">' + callStatus(c) + '</div><div class="grow call-sum"><span class="muted" style="font-size:13.5px">' + esc((c.ai_summary || c.student_notes || "").slice(0, 160)) + "</span></div></li>";
      }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Log a networking call and the AI writes up how it went and who you spoke with. It\'ll show up here.</p><button class="link" data-a="log-call" style="color:var(--accent)">Log your first call</button></div>') +
      '</div><div class="stack" style="gap:20px">' +
      '<section class="panel" style="background:var(--band);color:var(--band-ink);border:0"><div class="panel-body" style="flex-direction:row;align-items:center;gap:12px"><span class="avatar" style="background:#2A4F8E;width:42px;height:42px">' + initials(coach ? coach.full_name : "Chase") + '</span><div><b>' + esc(coach ? coach.full_name : "Chase Enloe") + '</b><span style="display:block;font-size:12.5px;color:var(--band-muted)">Your coach · online</span></div></div></section>' +
      (en ? panel("Progress", "", '<div class="panel-body">' + bar(DB.weeksMet(en).length, prog.duration_weeks, "Weekly check-ins") + bar(reqDone, req.length, "Required modules") + "</div>") : "") +
      panel("Coach's read", "", calls.filter(function (c) { return c.improvement_notes; }).length ? '<ul class="list">' + calls.filter(function (c) { return c.improvement_notes; }).slice(0, 4).map(function (c) { var w = db.contacts.filter(function (k) { return k.call_id === c.id; }).map(function (k) { return k.name; }).join(", "); return '<li style="display:block"><p style="font-size:14px">' + esc(c.improvement_notes) + '</p><span class="faint" style="font-size:12px">' + esc(w) + (w ? " · " : "") + fmtDate(c.call_date) + "</span></li>"; }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Chase\'s notes on where to sharpen up show here after you log your calls.</p></div>') +
      panel("Scores", '<a href="dashboard/assessments">History</a>', '<div class="panel-body">' + [["mock_interview", "Mock interview"], ["dcf", "DCF"], ["lbo", "LBO"]].map(function (k) { var a = latest(k[0]), max = ASSESS[k[0]][1]; return '<div class="stack-sm"><div class="row-wrap" style="justify-content:space-between"><span class="muted" style="font-size:13px">' + k[1] + '</span><b style="font-family:var(--display);font-size:20px">' + (a ? a.score + '<small class="faint" style="font-size:12px">/' + max + "</small>" : "—") + '</b></div><div class="meter-bar"><i style="width:' + (a ? Math.round(a.score / max * 100) : 0) + '%;background:var(--accent)"></i></div></div>'; }).join("") + "</div>") +
      "</div></div>";
  };

  V.program = function () {
    var en = DB.enrollmentFor(me.id);
    if (!en) return '<div class="empty-state"><b>No program yet</b><p>Chase adds you to a program after your strategy call. Your weekly plan shows up here.</p></div>';
    var prog = DB.program(en.program_id), wk = DB.currentWeek(en), met = DB.weeksMet(en);
    var req = DB.requiredModuleIds(me.id), reqDone = req.filter(function (m) { return DB.moduleStatus(me.id, m) === "completed"; }).length;
    var weeks = db.program_weeks.filter(function (w) { return w.program_id === en.program_id; }).sort(function (a, b) { return a.week_number - b.week_number; });
    return '<div class="grid-2">' + panel(esc(prog.name), pill("Week " + wk + " of " + prog.duration_weeks, "info"), '<div class="panel-body">' + bar(met.length, prog.duration_weeks, "Weekly check-ins (ticked by your coach after each session)") + "</div>") +
      panel("Required modules", '<a href="dashboard/modules">Modules</a>', '<div class="panel-body">' + bar(reqDone, req.length, "Completed of the modules your program requires") + "</div>") + "</div>" +
      '<div class="weeks-acc">' + weeks.map(function (w) {
        var t = DB.tasksFor(en, w.week_number), done = t.filter(function (x) { return x.completed; }).length;
        var mt = met.filter(function (m) { return m.week_number === w.week_number; })[0];
        var tracks = ["technical", "soft_skills"].map(function (tr) {
          var rows = t.filter(function (x) { return x.track === tr; }); if (!rows.length) return "";
          return '<div class="stack-sm"><span class="label">' + (tr === "technical" ? "Technical" : "Soft skills") + '</span><ul class="check-list">' + rows.map(function (x) {
            return '<li><button type="button" class="box' + (x.completed ? " on" : "") + '" data-a="tick" data-id="' + x.id + '" aria-pressed="' + x.completed + '" aria-label="Mark done">' + (x.completed ? "✓" : "") + '</button><div class="grow"><b style="font-weight:600">' + esc(x.title) + '</b><span class="muted" style="display:block;font-size:13px">' + esc(x.description || "") + "</span></div></li>";
          }).join("") + "</ul></div>";
        }).join("");
        return '<details class="week"' + (w.week_number === wk ? " open" : "") + '><summary><span class="mono faint">W' + w.week_number + "</span><b>" + esc(w.title || "Week " + w.week_number) + '</b><span class="grow"></span>' + (mt ? pill("Met " + fmtDate(mt.met_on), "gain") : w.week_number < wk ? pill("Not met yet", "warn") : "") + pill(done + "/" + t.length + " done", w.week_number === wk ? "info" : "plain") + '</summary><div class="week-body">' + tracks + "</div></details>";
      }).join("") + "</div>";
  };

  V.modules = function () {
    var bank = params.get("company") || "", stage = params.get("stage") || "", onlyReq = params.get("required") === "1";
    var req = DB.requiredModuleIds(me.id);
    var list = db.modules.filter(function (m) { return m.published && (!bank || m.bank === bank) && (!stage || m.stage === stage) && (!onlyReq || req.indexOf(m.id) > -1); });
    var banks = db.modules.map(function (m) { return m.bank; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    var stages = ["Phone screen", "First round", "Superday", "Technicals", "Question bank", "Overview"];
    var upNext = req.map(function (id) { return db.modules.filter(function (m) { return m.id === id; })[0]; }).filter(function (m) { return m && DB.moduleStatus(me.id, m.id) !== "completed"; })[0];
    var q = function (k, v) { var p = new URLSearchParams(window.location.search); if (v) p.set(k, v); else p.delete(k); var s = p.toString(); return "dashboard/modules" + (s ? "?" + s : ""); };
    return (upNext ? '<section class="panel" style="background:var(--band);color:var(--band-ink);border:0"><div class="panel-body" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:16px"><div class="grow" style="min-width:200px"><span class="label" style="color:var(--band-muted)">Up next · required</span><b style="display:block;font-family:var(--display);font-size:22px;margin-top:4px">' + esc(upNext.title) + '</b></div><a class="btn btn--solid btn--sm" href="dashboard/module?id=' + upNext.id + '">' + (DB.moduleStatus(me.id, upNext.id) === "in_progress" ? "Continue" : "Start") + "</a></div></section>" : "") +
      '<div class="filters"><label class="field" style="flex-direction:row;align-items:center;gap:8px">Company <select data-a="filter-company">' + '<option value="">All companies</option>' + banks.map(function (b) { return '<option' + (b === bank ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + "</select></label>" +
      stages.map(function (s) { return '<a class="chip" href="' + q("stage", s === stage ? "" : s) + '" aria-pressed="' + (s === stage) + '">' + s + "</a>"; }).join("") + '<a class="chip" href="' + q("required", onlyReq ? "" : "1") + '" aria-pressed="' + onlyReq + '">Required</a>' + (bank || stage || onlyReq ? '<a class="link" href="dashboard/modules">Clear filters</a>' : "") + "</div>" +
      (list.length ? '<div class="res-grid">' + list.map(function (m) {
        var st = DB.moduleStatus(me.id, m.id);
        return '<a class="res" href="dashboard/module?id=' + m.id + '"><div class="top"><span class="tag">' + esc(m.stage) + "</span>" + (req.indexOf(m.id) > -1 ? pill("Required", "warn") : "") + "</div><h3>" + esc(m.title) + '</h3><p>' + esc(m.bank) + " · " + m.sections.length + " section" + (m.sections.length === 1 ? "" : "s") + '</p><span class="slug">' + (st === "completed" ? pill("Completed", "gain") : st === "in_progress" ? pill("In progress", "info") : pill("Not started")) + "</span></a>";
      }).join("") + "</div>" : '<div class="empty-state">No modules match these filters. <a class="link" href="dashboard/modules">Clear filters</a></div>');
  };

  V.module = function () {
    var m = db.modules.filter(function (x) { return x.id === params.get("id"); })[0];
    if (!m) return '<div class="empty-state">That module isn\'t in your library. <a class="link" href="dashboard/modules">Back to modules</a></div>';
    var sid = isStaff ? null : me.id, st = sid ? DB.moduleStatus(sid, m.id) : "";
    if (sid && st === "not_started") { db.module_progress.push({ student_id: sid, module_id: m.id, status: "in_progress" }); DB.save(); st = "in_progress"; }
    return '<a class="link" href="' + (isStaff ? "coach/modules" : "dashboard/modules") + '">← All modules</a>' +
      '<div class="reader"><div class="stack-sm"><span class="label">' + esc(m.bank) + " · " + esc(m.stage) + '</span><h1 class="h3" style="font-size:32px">' + esc(m.title) + '</h1></div>' +
      '<p class="snapshot-note">Preview: each section shows its opening lines. In the live portal the full text loads from Supabase, and a page only counts as read after you\'ve spent time on it.</p>' +
      m.sections.map(function (s, i) { return '<section class="reader-sec"><span class="mono faint">' + String(i + 1).padStart(2, "0") + "</span><div>" + (s.heading ? "<h2>" + esc(s.heading) + "</h2>" : "") + "<p>" + esc(s.excerpt || "") + "</p></div></section>"; }).join("") +
      (sid ? '<div class="row-wrap" style="margin-top:12px">' + (st === "completed" ? pill("Completed", "gain") + '<button class="btn btn--ghost btn--sm" data-a="mod-status" data-id="' + m.id + '" data-v="in_progress">Mark as not done</button>' : '<button class="btn btn--solid btn--sm" data-a="mod-status" data-id="' + m.id + '" data-v="completed">Mark complete</button>') + "</div>" : "") + "</div>";
  };

  function eventsList(rows, showStudent) {
    var up = rows.filter(function (e) { return e.event_date && e.event_date >= today; }).sort(function (a, b) { return a.event_date < b.event_date ? -1 : 1; });
    var past = rows.filter(function (e) { return !e.event_date || e.event_date < today; }).sort(function (a, b) { return (a.event_date || "") < (b.event_date || "") ? 1 : -1; });
    var row = function (e) {
      var needsRecap = e.event_date && e.event_date < today && !e.notes && !db.contacts.some(function (k) { return k.event_id === e.id; });
      return [fmtLong(e.event_date) || '<span class="faint">No date</span>', '<b>' + esc(e.title) + "</b>" + (needsRecap ? " " + pill("Needs recap", "warn") : "") + (e.event_date === today ? " " + pill("Today", "info") : "") + (e.notes ? '<span class="sub-line">' + esc(e.notes) + "</span>" : ""),
        esc(EVENT_KIND[e.kind] || e.kind), esc(e.company || "")].concat(showStudent ? [esc((student(e.student_id) || {}).full_name || "")] : [])
        .concat(['<span class="row-wrap" style="gap:8px;flex-wrap:nowrap"><a class="link" style="font-size:13px" download="' + esc(e.title) + '.ics" href="' + icsFor(e) + '">.ics</a><a class="link" style="font-size:13px" target="_blank" rel="noopener" href="' + gcalUrl(e) + '">Google</a>' + (showStudent ? "" : '<button class="link" style="font-size:13px" data-a="edit-event" data-id="' + e.id + '">Edit</button><button class="link" style="font-size:13px;color:var(--faint)" data-a="del-event" data-id="' + e.id + '">Delete</button>') + "</span>"]);
    };
    var heads = ["Date", "Event", "Type", "Firm"].concat(showStudent ? ["Student"] : []).concat([""]);
    return panel("Upcoming · " + up.length, "", table(heads, up.map(row), "No upcoming events.")) + panel("Past · " + past.length, "", table(heads, past.map(row), "No past events."));
  }
  V.events = function () { return '<div class="row-wrap" style="justify-content:flex-end"><button class="btn btn--solid btn--sm" data-a="log-event">Log event</button></div>' + eventsList(mine(db.events), false); };

  function groupOpps(rows) {
    var g = { "This week": [], "Next week": [], "Later": [], "Closed": [] };
    rows.forEach(function (o) { var n = dayDiff(o.deadline); (n < 0 ? g.Closed : n <= 6 ? g["This week"] : n <= 13 ? g["Next week"] : g.Later).push(o); });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; }); });
    return g;
  }
  V.deadlines = function () {
    var g = groupOpps(db.opportunities.filter(function (o) { return o.published; }));
    var added = mine(db.events).filter(function (e) { return e.kind === "deadline"; }).map(function (e) { return e.opp_id; });
    return panel("Deadlines", '<span class="faint" style="font-size:12.5px">Your coach adds these; you get an email a week before, the day before and on the day</span>',
      Object.keys(g).filter(function (k) { return g[k].length; }).map(function (k) {
        return '<div class="group-label">' + k + '</div><ul class="list">' + g[k].map(function (o) {
          return '<li><div class="grow"><b>' + esc(o.firm) + ": " + esc(o.title) + '</b><span>' + ROLE_TYPE[o.role_type] + " · " + fmtLong(o.deadline) + " · <b>" + relDay(o.deadline) + "</b>" + (o.deadline_note ? " · " + esc(o.deadline_note) : "") + "</span>" + (o.notes ? '<span style="display:block;color:var(--ink)">' + esc(o.notes) + "</span>" : "") + "</div>" +
            (o.link ? '<a class="btn btn--solid btn--xs" href="' + esc(o.link) + '" target="_blank" rel="noopener">Apply ↗</a>' : "") + (k !== "Closed" ? (added.indexOf(o.id) > -1 ? '<span class="faint" style="font-size:12.5px">Added to my events</span>' : '<button class="link" style="font-size:12.5px" data-a="opp-event" data-id="' + o.id + '">Add to my events</button>') : "") + "</li>";
        }).join("") + "</ul>";
      }).join("") || '<p class="empty">No open deadlines right now.</p>');
  };

  V.assessments = function () {
    var A = mine(db.assessments).sort(function (a, b) { return a.assessed_on < b.assessed_on ? 1 : -1; });
    return '<div class="stats">' + Object.keys(ASSESS).map(function (k) { var a = A.filter(function (x) { return x.kind === k; })[0]; return stat(ASSESS[k][0], a ? a.score + '<small class="faint" style="font-size:14px">/' + ASSESS[k][1] + "</small>" : "Pending", a ? fmtDate(a.assessed_on) : "Not scored yet"); }).join("") + "</div>" +
      panel("Assessment history", "", table(["Date", "Type", "Score", "Notes from Chase"], A.map(function (a) { return ['<span class="num">' + fmtDate(a.assessed_on) + "</span>", ASSESS[a.kind][0], '<b class="num">' + a.score + "/" + ASSESS[a.kind][1] + "</b>", '<span class="muted">' + esc(a.notes || "") + "</span>"]; }), "Your mock interview, DCF and LBO scores from Chase will appear here."));
  };

  function contactsTable(rows, showStudent) {
    var term = (params.get("q") || "").toLowerCase();
    var list = rows.filter(function (k) { return !term || (k.name + " " + (k.bank || "") + " " + (k.group_name || "")).toLowerCase().indexOf(term) > -1; });
    var cold = rows.filter(function (k) { return !k.call_id && !k.event_id && dayDiff(k.created_at) <= -21; });
    var byFirm = {}; rows.forEach(function (k) { var f = k.bank || "Unknown"; byFirm[f] = (byFirm[f] || 0) + 1; });
    return '<form class="filters" method="get" action="' + (isStaff ? "coach/contacts" : "dashboard/contacts") + '"><div class="search-box"><input name="q" type="search" placeholder="Search contacts" value="' + esc(params.get("q") || "") + '" aria-label="Search contacts"></div>' + (term ? '<a class="link" href="' + (isStaff ? "coach/contacts" : "dashboard/contacts") + '">Clear</a>' : "") + "</form>" +
      '<div class="cols-2"><div style="min-width:0">' + panel("Contacts · " + list.length, showStudent ? "" : '<button class="btn btn--solid btn--xs" data-a="add-contact">Add contact</button>', table(["Name", "Firm", "Group", "Role", "Email"].concat(showStudent ? ["Student"] : []).concat(["Notes"]), list.map(function (k) {
        return ["<b>" + esc(k.name) + "</b>", esc(k.bank || ""), esc(k.group_name || ""), esc(k.title || ""), k.email ? '<a class="link" style="font-size:13px" href="mailto:' + esc(k.email) + '">' + esc(k.email) + "</a>" : ""].concat(showStudent ? [esc((student(k.student_id) || {}).full_name || "")] : []).concat(['<span class="muted" style="font-size:13px">' + esc((k.personal_notes || "").slice(0, 90)) + "</span>"]);
      }), term ? "No contacts match that search." : "No contacts yet. Add the people you meet and talk to.")) + "</div>" +
      '<div class="stack" style="gap:20px">' + panel("Going cold", "", cold.length ? '<ul class="list">' + cold.map(function (k) { return "<li><div class=\"grow\"><b>" + esc(k.name) + "</b><span>" + esc(k.bank || "") + " · added " + relDay(k.created_at) + "</span></div></li>"; }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Everyone\'s warm.</p></div>') +
      panel("By firm", "", Object.keys(byFirm).length ? '<ul class="list">' + Object.keys(byFirm).sort(function (a, b) { return byFirm[b] - byFirm[a]; }).map(function (f) { return '<li><div class="grow"><b>' + esc(f) + '</b></div><span class="mono">' + byFirm[f] + "</span></li>"; }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Firms appear here as you add contacts.</p></div>') +
      (showStudent ? "" : panel("Import contacts", "", '<div class="panel-body"><p class="muted" style="font-size:13.5px">CSV with a header row: name, firm, group, title, email. One contact per row.</p><input type="file" accept=".csv" data-a="import-csv" aria-label="Choose a CSV file"><p class="status" data-import-out hidden></p></div>')) + "</div></div>";
  }
  V.contacts = function () { return contactsTable(mine(db.contacts), false); };

  function callsTable(rows, showStudent) {
    rows = rows.slice().sort(function (a, b) { return a.call_date < b.call_date ? 1 : -1; });
    return panel("Calls · " + rows.length, showStudent ? "" : '<button class="btn btn--solid btn--xs" data-a="log-call">Log a call</button>', table(["Date"].concat(showStudent ? ["Student"] : []).concat(["Contact", "AI read", ""]), rows.map(function (c) {
      return ['<span class="num faint">' + fmtDate(c.call_date) + "</span>"].concat(showStudent ? [esc((student(c.student_id) || {}).full_name || "")] : []).concat([callStatus(c), '<span class="muted" style="font-size:13px">' + esc((c.ai_summary || c.student_notes || "").slice(0, 120)) + "</span>", '<button class="link" style="font-size:13px" data-a="call" data-id="' + c.id + '">Open</button>']);
    }), "No calls yet."));
  }
  V.calls = function () { return callsTable(mine(db.calls), false); };

  function filesPanel(sid, canUpload) {
    var rows = db.files.filter(function (f) { return f.student_id === sid; });
    return panel("Documents · " + rows.length, canUpload ? '<label class="btn btn--solid btn--xs" style="cursor:pointer">Upload<input type="file" data-a="upload" data-sid="' + sid + '" hidden></label>' : "",
      rows.length ? '<ul class="list">' + rows.map(function (f) {
        var ext = (f.name.split(".").pop() || "").toUpperCase().slice(0, 4);
        var by = student(f.uploaded_by);
        return '<li><span class="file"><span class="ext ' + (/XLS|CSV/.test(ext) ? "x" : /DOC/.test(ext) ? "d" : "") + '">' + esc(ext) + '</span></span><div class="grow"><b>' + esc(f.name) + "</b><span>" + (by ? (by.id === me.id ? "You" : esc(first(by.full_name))) : "") + " · " + fmtDate(f.uploaded_at) + " · " + Math.max(1, Math.round(f.size / 1000)) + ' KB</span></div><button class="link" style="font-size:13px;color:var(--faint)" data-a="del-file" data-id="' + f.id + '">Remove</button></li>';
      }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Nothing here yet. Your coach will add files as you go.</p></div>');
  }
  V.files = function () { return filesPanel(me.id, true) + '<p class="fine">Preview: uploads keep the file name and size only. The live portal stores the file in the student-documents bucket.</p>'; };

  V.resources = function () {
    var res = (window.WSA_RESOURCES || []).filter(function (r) { return r.listed && db.resources_hidden.indexOf(r.slug) < 0; });
    return '<div class="res-grid">' + res.map(window.WSA_resCard).join("") + "</div>";
  };

  V.profile = function () {
    var p = student(me.id), en = DB.enrollmentFor(me.id);
    var checks = [["Headshot", !!p.headshot_name], ["Resume", !!p.resume_name], ["LinkedIn", !!p.linkedin_url], ["Tracker sheet", !!p.tracker_url], ["Target role", !!p.target_role]];
    var done = checks.filter(function (c) { return c[1]; }).length;
    return '<div class="cols-even">' + panel("Recruiting profile", '<a href="onboarding">Edit profile</a>', '<div class="panel-body"><dl class="kv"><dt>Name</dt><dd>' + esc(p.full_name) + "</dd><dt>Email</dt><dd>" + esc(p.email) + "</dd><dt>School</dt><dd>" + esc(p.school || "") + "</dd><dt>Class of</dt><dd>" + esc(p.class_year || "") + "</dd><dt>GPA</dt><dd>" + esc(p.gpa || "") +
      "</dd><dt>Target role</dt><dd>" + esc(p.target_role || "") + "</dd><dt>Secondary role</dt><dd>" + esc(p.secondary_role || "") + "</dd><dt>LinkedIn</dt><dd>" + (p.linkedin_url ? '<a class="link" href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener">Open profile ↗</a>' : "") + "</dd><dt>Tracker</dt><dd>" + (p.tracker_url ? '<a class="link" href="' + esc(p.tracker_url) + '" target="_blank" rel="noopener">Open sheet ↗</a>' : "") + "</dd><dt>Member since</dt><dd>" + fmtDate(p.created_at) + "</dd></dl></div>") +
      '<div class="stack" style="gap:20px">' + panel("Profile complete", pill(done + "/" + checks.length, done === checks.length ? "gain" : "warn"), '<ul class="check-list panel-body">' + checks.map(function (c) { return '<li><span class="box' + (c[1] ? " on" : "") + '">' + (c[1] ? "✓" : "") + "</span>" + c[0] + "</li>"; }).join("") + "</ul>") +
      panel("Account", "", '<div class="panel-body"><dl class="kv"><dt>Program</dt><dd>' + (en ? esc(DB.program(en.program_id).name) : "None yet") + "</dd><dt>Coach</dt><dd>" + esc((coachOf(me.id) || { full_name: "Chase Enloe" }).full_name) + '</dd></dl><div class="row-wrap"><a class="btn btn--ghost btn--sm" href="login?mode=forgot">Change password</a><button class="btn btn--ghost btn--sm" data-logout>Sign out</button></div></div>') + "</div></div>";
  };

  /* ================================================================== STAFF VIEWS */
  V.today = function () {
    var list = students().filter(function (s) { var e = DB.enrollmentFor(s.id); return e && e.status === "active"; }).map(model);
    var order = { urgent: 0, action: 1, none: 2 };
    list.sort(function (a, b) { return order[a.tier] - order[b.tier]; });
    var up = list.filter(function (m) { return m.nextCall; }).sort(function (a, b) { return new Date(a.nextCall.starts_at) - new Date(b.nextCall.starts_at); })[0];
    var cal = db.calendar, todays = db.calendar_events.filter(function (e) { return e.coach_id === me.id && DB.iso(e.starts_at) === today; }).sort(function (a, b) { return a.starts_at < b.starts_at ? -1 : 1; });
    var alerts = list.reduce(function (a, m) { return a.concat(m.alerts); }, []);
    var overdue = list.reduce(function (a, m) { return a + m.overdue.reduce(function (x, p) { return x + p.amount_cents; }, 0); }, 0);
    var dueSoon = db.payments.filter(function (p) { return !p.paid_on && p.due_on >= today && dayDiff(p.due_on) <= 7 && list.some(function (m) { return m.s.id === p.student_id; }); }).reduce(function (a, p) { return a + p.amount_cents; }, 0);
    var h = new Date().getHours();
    var eta = function (iso) { var mins = Math.round((new Date(iso) - Date.now()) / 60000); return mins < 0 ? "now" : mins < 60 ? "in " + mins + "m" : mins < 1440 ? "in " + Math.floor(mins / 60) + "h " + (mins % 60) + "m" : fmtLong(iso); };
    return '<div><div class="faint" style="font-size:15px;font-weight:600">' + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + '</div><h1 class="h3" style="font-size:32px;margin-top:4px">' + (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + ", " + esc(first(me.full_name)) + "</h1></div>" +
      (!cal.connected ? '<div class="notice"><span><b>Google Calendar isn\'t connected.</b> Today\'s meetings and the Up next card read from it. <a class="link" href="google-oauth">Connect Google Calendar</a></span></div>' : "") +
      '<div class="cols-even">' + (up ? '<section class="upnext"><img src="assets/wsa-bull.png" alt="" class="ghost"><div class="row-wrap" style="justify-content:space-between"><span class="label" style="color:#D5DBE5">Up next · ' + eta(up.nextCall.starts_at) + "</span>" + pill(up.hasPlan ? "Plan ready" : "No plan yet", up.hasPlan ? "gain" : "bad") + '</div><div class="row-wrap" style="gap:16px;flex-wrap:nowrap"><span class="avatar" style="width:64px;height:64px;font-size:22px;background:#fff;color:#12284B">' + initials(up.s.full_name) + '</span><div><b style="font-family:var(--display);font-size:28px;display:block;line-height:1.1">' + esc(up.s.full_name) + '</b><span style="color:#D5DBE5">' + esc([up.s.school, up.prog ? "session " + Math.min(up.met + 1, up.total) + " of " + up.total : ""].filter(Boolean).join(" · ")) + '</span></div></div><span style="color:#D5DBE5">' + up.met + "/" + up.total + ' sessions completed</span><a class="btn btn--solid" href="coach/student?id=' + up.s.id + '">' + (up.hasPlan ? "Review plan" : "Prep this call") + "</a></section>" : '<section class="upnext"><span class="label" style="color:#D5DBE5">Up next</span><b style="font-family:var(--display);font-size:24px">No calls on the calendar</b><span style="color:#D5DBE5">Calls with an active student in Google Calendar show up here.</span></section>') +
      panel("Today's meetings", '<span class="faint" style="font-size:13px">' + (cal.connected ? todays.length + " today" : "Not connected") + "</span>", (cal.connected ? (todays.length ? '<ul class="list">' + todays.map(function (e) { var s = e.student_id ? student(e.student_id) : null, m = s ? model(s) : null; var past = new Date(e.ends_at) < Date.now(); return '<li style="' + (past ? "opacity:.55" : "") + '"><span class="mono" style="width:70px;font-size:13px">' + fmtTime(e.starts_at) + '</span><div class="grow"><b>' + esc(s ? s.full_name : e.title) + "</b><span>" + (m ? (m.hasPlan ? "Plan ready" : '<span style="color:var(--bad)">No plan yet</span>') : "") + "</span></div>" + (s ? '<a class="btn btn--ghost btn--xs" href="coach/student?id=' + s.id + '">' + (past ? "Notes" : m.hasPlan ? "Plan" : "Prep") + "</a>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="empty">Nothing on your calendar today.</p>') : '<p class="empty">Connect Google Calendar to see them here.</p>') +
        '<div class="panel-body" style="border-top:1px solid var(--line)">' + (alerts.length ? '<a class="row-wrap" style="justify-content:space-between;text-decoration:none" href="coach/queue"><b>Other to-dos</b><span style="color:var(--accent);font-weight:700">' + alerts.length + " ›</span></a>" : "") + '<div class="row-wrap" style="justify-content:space-between"><b>Money</b><span>' + [overdue ? money(overdue) + " overdue" : "", dueSoon ? money(dueSoon) + " due this week" : "Nothing due this week"].filter(Boolean).join(" · ") + "</span></div></div>") + "</div>" +
      '<section class="stack"><div class="row-wrap" style="justify-content:space-between"><h2 class="h3" style="font-size:20px">Your roster · ' + list.length + '</h2><span class="muted" style="font-size:14px"><b style="color:var(--bad)">' + list.filter(function (m) { return m.tier === "urgent"; }).length + ' urgent</b> · <b style="color:var(--warn)">' + list.filter(function (m) { return m.tier === "action"; }).length + " to do</b> · " + list.filter(function (m) { return m.tier === "none"; }).length + " all clear</span></div>" +
      (list.length ? '<div class="roster">' + list.map(function (m) { return '<a class="rcard" href="coach/student?id=' + m.s.id + '" style="border-color:' + TIER[m.tier] + ";box-shadow:0 4px 0 " + TIER[m.tier] + '"><div class="row-wrap" style="flex-wrap:nowrap"><span class="avatar" style="box-shadow:0 0 0 3px ' + TIER[m.tier] + '">' + initials(m.s.full_name) + '</span><div style="min-width:0"><b style="display:block">' + esc(m.s.full_name) + '</b><span class="muted" style="font-size:13px">' + esc([m.s.school, m.week ? "week " + m.week : ""].filter(Boolean).join(" · ")) + '</span></div></div><span style="font-size:13.5px">' + m.met + "/" + m.total + ' sessions completed</span><span style="font-size:13.5px;font-weight:700;color:' + (m.tier === "none" ? "var(--muted)" : TIER[m.tier]) + '">' + esc(m.flag) + "</span></a>"; }).join("") + "</div>" : '<div class="empty-state">' + (me.role === "coach" ? "No students assigned to you yet. Chase assigns students on the Coaches screen." : "No students with an active enrollment. Enroll a student from Programs to see them here.") + "</div>") + "</section>";
  };

  V.queue = function () {
    var alerts = students().map(model).reduce(function (a, m) { return a.concat(m.alerts.map(function (x) { x.sid = m.s.id; return x; })); }, []);
    var order = { urgent: 0, action: 1, info: 2 };
    alerts.sort(function (a, b) { return order[a.tier] - order[b.tier]; });
    return panel("Full queue · " + alerts.length, '<a href="coach">‹ Today</a>', alerts.length ? '<ul class="list">' + alerts.map(function (a) {
      return '<li class="alert-row ' + (a.tier === "info" ? "info" : a.tier) + '"><div class="grow"><b>' + esc(a.msg) + "</b><span>" + esc(a.sub) + "</span></div>" + pill(a.tier === "urgent" ? "Urgent" : a.tier === "action" ? "Action" : "Heads up", a.tier === "urgent" ? "bad" : a.tier === "action" ? "warn" : "info") +
        (a.act === "Prep" || a.act === "Open" ? '<a class="btn btn--ghost btn--xs" href="coach/student?id=' + a.sid + '">' + a.act + "</a>" : '<button class="btn btn--ghost btn--xs" data-a="queue-act" data-v="' + esc(a.act) + '" data-sid="' + a.sid + '">' + a.act + "</button>") + "</li>";
    }).join("") + "</ul>" : '<div class="panel-body"><p class="muted">Queue cleared.</p></div>');
  };

  V.students = function () {
    var former = params.get("view") === "former";
    var all = students({ includeArchived: true }), list = all.filter(function (s) { return !!s.archived === former; });
    var head = '<div class="row-wrap" style="justify-content:space-between"><div class="seg" role="group"><a class="segl" href="coach/students" aria-pressed="' + !former + '">Active · ' + all.filter(function (s) { return !s.archived; }).length + '</a><a class="segl" href="coach/students?view=former" aria-pressed="' + former + '">Former · ' + all.filter(function (s) { return s.archived; }).length + "</a></div>" + (isAdmin ? '<button class="btn btn--solid btn--sm" data-a="approve">Approve email</button>' : "") + "</div>";
    var rows = list.map(function (s) { var m = model(s), c = coachOf(s.id); return ['<a href="coach/student?id=' + s.id + '"><b>' + esc(s.full_name) + '</b><span class="sub-line">' + esc(s.school || s.email) + "</span></a>", m.prog ? esc(m.prog.name) + '<span class="sub-line">week ' + m.week + "</span>" : '<span class="faint">No program</span>', '<span class="num">' + m.met + "/" + m.total + "</span>", m.nextCall ? fmtLong(m.nextCall.starts_at) + '<span class="sub-line">' + fmtTime(m.nextCall.starts_at) + "</span>" : '<span class="faint">None booked</span>', pill(m.hasPlan ? "Plan ready" : "No plan yet", m.hasPlan ? "gain" : "warn"), m.overdue.length ? pill(money(m.overdue[0].amount_cents) + " overdue", "bad") : pill("Current", "gain")].concat(isAdmin ? [c ? esc(c.full_name) : '<span class="faint">Chase</span>'] : []); });
    var invites = isAdmin ? db.approved_emails.filter(function (a) { return !DB.profileByEmail(a.email); }) : [];
    return head + panel(former ? "Former students" : "Students", "", table(["Student", "Program", "Sessions", "Next call", "Plan", "Payment"].concat(isAdmin ? ["Coach"] : []), rows, former ? "No former students." : (me.role === "coach" ? "No students assigned to you yet." : "No students yet. Approve an email to invite one."))) +
      (isAdmin && invites.length ? panel("Invited · not signed up yet", "", '<ul class="list">' + invites.map(function (a) { return '<li><div class="grow"><b>' + esc(a.email) + "</b><span>" + (a.role === "coach" ? "Coach" : "Student" + (a.program_id ? " · " + esc((DB.program(a.program_id) || {}).name || "") : " · no program")) + " · approved " + fmtDate(a.added_at) + '</span></div><button class="link" style="font-size:13px;color:var(--faint)" data-a="unapprove" data-v="' + esc(a.email) + '">Remove</button></li>'; }).join("") + "</ul>") : "");
  };

  V.student = function () {
    var sid = params.get("id"), s = student(sid);
    if (!s || !DB.canAccessStudent(me, sid)) return '<div class="empty-state">' + (s ? "This student isn't assigned to you." : "Student not found.") + ' <a class="link" href="coach/students">Back to students</a></div>';
    var m = model(s), en = m.en, wk = m.week;
    var notes = db.call_notes.filter(function (n) { return n.student_id === sid; }).sort(function (a, b) { return a.session_date < b.session_date ? 1 : -1; });
    var last = notes[0], plan = db.session_plans.filter(function (p) { return p.student_id === sid; })[0];
    var calls = db.calls.filter(function (c) { return c.student_id === sid; }), contacts = db.contacts.filter(function (k) { return k.student_id === sid; });
    var A = db.assessments.filter(function (a) { return a.student_id === sid; }).sort(function (a, b) { return a.assessed_on < b.assessed_on ? 1 : -1; });
    var req = DB.requiredModuleIds(sid), reqDone = req.filter(function (id) { return DB.moduleStatus(sid, id) === "completed"; }).length;
    var coaches = db.profiles.filter(function (p) { return p.role === "coach"; }), c = coachOf(sid);
    var met = DB.weeksMet(en);
    var weekCells = m.total ? Array.apply(null, Array(m.total)).map(function (_, i) { var w = i + 1, ck = met.filter(function (x) { return x.week_number === w; })[0]; return '<button type="button" class="wk' + (ck ? " met" : w === wk ? " now" : "") + '" data-a="checkin" data-v="' + w + '" title="' + (ck ? "Met " + fmtDate(ck.met_on) + ". Click to unmark." : w > wk ? "Future week" : "Tick when this week's session has happened") + '">W' + w + (ck ? "<small>" + fmtDate(ck.met_on) + "</small>" : "") + "</button>"; }).join("") : "";
    return '<div class="row-wrap" style="justify-content:space-between"><a class="link" href="coach/students">← Back to all students</a><div class="row-wrap">' + (s.archived ? '<button class="btn btn--ghost btn--sm" data-a="archive" data-v="0">Unarchive</button>' : '<button class="btn btn--ghost btn--sm" data-a="archive" data-v="1">Archive</button>') + (isAdmin ? '<button class="btn btn--ghost btn--sm" style="color:var(--bad)" data-a="delete-student">Delete student</button>' : "") + "</div></div>" +
      '<div class="cols-2"><div class="stack" style="gap:20px;min-width:0">' +
      panel("Next session", m.nextCall ? '<span class="faint" style="font-size:13px">' + fmtLong(m.nextCall.starts_at) + " · " + fmtTime(m.nextCall.starts_at) + "</span>" : '<span class="faint" style="font-size:13px">None booked</span>',
        '<div class="panel-body">' + (last ? '<div class="stack-sm"><span class="label">Last call · ' + fmtDate(last.session_date) + " · " + esc(last.source || "") + "</span><p>" + esc(last.summary) + '</p></div><div class="stack-sm"><span class="label">Action plan</span><ul class="check-list">' + last.actions.map(function (a, i) { return '<li><button type="button" class="box' + (a.done ? " on" : "") + '" data-a="action-tick" data-id="' + last.id + '" data-v="' + i + '">' + (a.done ? "✓" : "") + "</button>" + esc(a.text) + "</li>"; }).join("") + "</ul></div>" : '<p class="muted">No call notes yet. Drop the notes from the last session below.</p>') +
        (en ? '<div class="stack-sm"><span class="label">This week\'s curriculum · week ' + wk + '</span><ul class="check-list">' + DB.tasksFor(en, wk).map(function (t) { return '<li><button type="button" class="box' + (t.completed ? " on" : "") + '" data-a="tick" data-id="' + t.id + '">' + (t.completed ? "✓" : "") + "</button>" + esc(t.title) + "</li>"; }).join("") + "</ul></div>" : "") +
        '<div class="stack-sm"><span class="label">Next-session plan</span><textarea class="input" rows="3" style="height:auto;padding:10px" data-plan placeholder="What you\'ll cover, the one question to fix, what they should bring.">' + esc(plan ? plan.text : "") + '</textarea><div class="row-wrap"><button class="btn btn--solid btn--sm" data-a="save-plan">' + (plan ? "Update plan" : "Save plan") + "</button>" + (plan ? pill("Plan ready", "gain") : pill("No plan yet", "warn")) + "</div></div></div>") +
      panel("Add call notes", "", '<div class="panel-body"><p class="muted" style="font-size:13.5px">Drop the PDF, Word or text export from any notetaker (Gemini, Fathom, typed). It\'s summarised into the last call and an action plan.</p><label class="dropzone"><input type="file" accept=".pdf,.doc,.docx,.txt" data-a="notes-file"><span>Drop a file or click to choose</span></label><div class="or">or paste</div><textarea class="input" rows="3" style="height:auto;padding:10px" data-notes-text placeholder="Paste the notes here. Lines starting with a dash become action items."></textarea><button class="btn btn--ghost btn--sm" data-a="notes-text">Summarise pasted notes</button></div>') +
      (m.total ? panel("Weekly check-ins", '<span class="mono" style="font-size:13px">' + met.length + " of " + m.total + "</span>", '<div class="panel-body"><div class="wkgrid">' + weekCells + '</div><p class="fine">Tick a week once its one-hour coaching session has happened. Dates can\'t be in the future or before the program started.</p></div>') : "") +
      panel("Calls · " + calls.length, "", table(["Date", "Contact", "AI read", ""], calls.map(function (cl) { return ['<span class="num faint">' + fmtDate(cl.call_date) + "</span>", callStatus(cl), '<span class="muted" style="font-size:13px">' + esc((cl.ai_summary || cl.student_notes || "").slice(0, 110)) + "</span>", '<button class="link" style="font-size:13px" data-a="call" data-id="' + cl.id + '">Open</button>']; }), "No calls yet.")) +
      panel("Assessments · " + A.length, "", (A.length ? '<ul class="list">' + A.map(function (a) { return '<li style="display:block"><div class="row-wrap" style="justify-content:space-between"><b>' + ASSESS[a.kind][0] + '</b><span class="num"><b>' + a.score + "/" + ASSESS[a.kind][1] + '</b> <span class="faint">' + fmtDate(a.assessed_on) + "</span></span></div>" + (a.notes ? '<p class="muted" style="font-size:13.5px">' + esc(a.notes) + "</p>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="empty">None yet.</p>') +
        '<form class="panel-body assess-form" style="border-top:1px solid var(--line)" data-a="log-assess"><div class="fields-2"><label class="field">Type<select name="kind">' + Object.keys(ASSESS).map(function (k) { return '<option value="' + k + '">' + ASSESS[k][0] + "</option>"; }).join("") + '</select></label><label class="field">Score<input name="score" inputmode="numeric" placeholder="8"></label></div><label class="field">Notes<input name="notes" placeholder="What went well, what to fix"></label><button class="btn btn--solid btn--sm" type="submit">Log assessment</button></form>') +
      filesPanel(sid, true) + "</div>" +
      '<div class="stack" style="gap:20px">' +
      panel(esc(s.full_name), "", '<div class="panel-body" style="align-items:center;text-align:center"><span class="avatar" style="width:64px;height:64px;font-size:20px">' + initials(s.full_name) + '</span><div class="row-wrap" style="justify-content:center;gap:12px">' + (s.linkedin_url ? '<a class="link" href="' + esc(s.linkedin_url) + '" target="_blank" rel="noopener">LinkedIn profile</a>' : "") + (s.resume_name ? '<span class="link" title="Opens in the live portal">Resume</span>' : "") + (s.tracker_url ? '<a class="link" href="' + esc(s.tracker_url) + '" target="_blank" rel="noopener">Tracker sheet ↗</a>' : "") + '</div><dl class="kv" style="text-align:left;width:100%"><dt>Email</dt><dd>' + esc(s.email) + "</dd><dt>School</dt><dd>" + esc(s.school || "") + "</dd><dt>GPA</dt><dd>" + esc(s.gpa || "") + "</dd><dt>Target role</dt><dd>" + esc(s.target_role || "") + "</dd><dt>Secondary role</dt><dd>" + esc(s.secondary_role || "") + "</dd><dt>Joined</dt><dd>" + fmtDate(s.created_at) + "</dd><dt>Coach</dt><dd>" +
        (isAdmin ? '<select class="input" style="height:34px" data-a="assign-coach"><option value="">Chase (no coach)</option>' + coaches.map(function (co) { return '<option value="' + co.id + '"' + (c && c.id === co.id ? " selected" : "") + ">" + esc(co.full_name) + "</option>"; }).join("") + "</select>" : esc(c ? c.full_name : "Chase")) + "</dd></dl></div>") +
      panel("Program", "", '<div class="panel-body">' + (en ? '<dl class="kv"><dt>Program</dt><dd>' + esc(m.prog.name) + "</dd><dt>Started</dt><dd>" + fmtDate(en.start_date) + "</dd><dt>Week</dt><dd>" + wk + " of " + m.total + "</dd></dl>" + bar(met.length, m.total, "Weekly check-ins") + bar(reqDone, req.length, "Required modules") : '<p class="muted">No program yet.</p>') +
        (isAdmin ? '<label class="field">' + (en ? "Move onto a longer program" : "Enroll in a program") + '<select class="input" data-a="enroll"><option value="">Choose…</option>' + db.programs.filter(function (p) { return !m.prog || p.duration_weeks > m.prog.duration_weeks; }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("") + "</select></label>" : "") + "</div>") +
      '<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + stat("Calls", calls.length) + stat("Contacts", contacts.length) + stat("Modules", req.length ? Math.round(reqDone / req.length * 100) + "%" : "—", reqDone + " of " + req.length) + "</div>" +
      panel("Required modules", isAdmin ? '<a href="coach/modules">Manage</a>' : "", req.length ? '<ul class="list">' + req.map(function (id) { var mo = db.modules.filter(function (x) { return x.id === id; })[0]; if (!mo) return ""; var st = DB.moduleStatus(sid, id); return '<li><div class="grow"><b>' + esc(mo.title) + "</b></div>" + (st === "completed" ? pill("Complete", "gain") : st === "in_progress" ? pill("In progress", "info") : pill("Not started")) + "</li>"; }).join("") + "</ul>" : '<p class="empty">No required modules.</p>') +
      panel("Payments", "", (function () { var ps = db.payments.filter(function (p) { return p.student_id === sid; }); return ps.length ? '<ul class="list">' + ps.map(function (p) { return '<li><div class="grow"><b>' + esc(p.label) + "</b><span>" + money(p.amount_cents) + " · due " + fmtDate(p.due_on) + "</span></div>" + (p.paid_on ? pill("Paid", "gain") : p.due_on < today ? pill("Overdue", "bad") : pill("Due " + relDay(p.due_on), "warn")) + "</li>"; }).join("") + "</ul>" : '<p class="empty">No payments recorded.</p>'; })()) +
      "</div></div>";
  };

  V["s-calls"] = function () { return callsTable(mine(db.calls), true); };
  V["s-contacts"] = function () { return contactsTable(mine(db.contacts), true); };
  V["s-events"] = function () { return eventsList(mine(db.events), true); };

  V.opportunities = function () {
    var g = groupOpps(db.opportunities), set = db.site_settings, editId = params.get("edit");
    var form = function (o) {
      o = o || {};
      return '<form class="panel-body opp-form" data-a="save-opp" data-id="' + (o.id || "") + '" style="background:var(--sunk);border-bottom:1px solid var(--line)"><div class="fields-3"><label class="field">Firm<input name="firm" value="' + esc(o.firm || "") + '" placeholder="Goldman Sachs"></label><label class="field">Opportunity<input name="title" value="' + esc(o.title || "") + '" placeholder="2027 Summer Analyst, IBD"></label><label class="field">Type<select name="role_type">' + Object.keys(ROLE_TYPE).map(function (k) { return '<option value="' + k + '"' + (o.role_type === k ? " selected" : "") + ">" + ROLE_TYPE[k] + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="fields-3"><label class="field">Deadline<input type="date" name="deadline" value="' + esc(o.deadline || "") + '"></label><label class="field">Application link<input name="link" value="' + esc(o.link || "") + '" placeholder="https://…"></label><label class="field">Deadline note (optional)<input name="deadline_note" value="' + esc(o.deadline_note || "") + '" placeholder="11:59pm ET · resume and cover letter"></label></div><label class="field">Notes for students (optional)<input name="notes" value="' + esc(o.notes || "") + '" placeholder="Who should apply, what to prepare, who to network with first."></label><p class="status" data-opp-err hidden></p><div class="row-wrap" style="justify-content:flex-end">' + (o.id ? '<a class="btn btn--ghost btn--sm" href="coach/opportunities">Cancel</a>' : "") + '<button class="btn btn--solid btn--sm" type="submit">' + (o.id ? "Save changes" : "Add opportunity") + "</button></div></form>";
    };
    var rows = [].concat(g["This week"], g["Next week"], g.Later, g.Closed);
    return panel("Deadline reminders", '<span class="faint" style="font-size:12.5px">Emailed 7 days before, the day before and on the day, at 9am Eastern</span>', '<div class="panel-body"><div class="row-wrap"><span class="label">Sending to</span>' + (isAdmin ? '<div class="seg" role="group"><button type="button" data-a="audience" data-v="test" aria-pressed="' + (set.reminders_audience === "test") + '">Test addresses only</button><button type="button" data-a="audience" data-v="all" aria-pressed="' + (set.reminders_audience === "all") + '">Every active student</button></div>' : "<b>" + (set.reminders_audience === "all" ? "Every active student" : "Test addresses only") + "</b>") + (set.reminders_last_run ? '<span class="faint" style="font-size:13px">Last run ' + esc(set.reminders_last_run) + "</span>" : "") + '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-a="send-reminders">Send today\'s reminders now</button></div>' +
      (isAdmin && set.reminders_audience === "test" ? '<label class="field">Test addresses (comma separated)<input class="input" data-test-emails value="' + esc(set.reminders_test_emails) + '"></label>' : "") + "</div>") +
      panel("Opportunities · " + db.opportunities.length, params.get("add") === "1" ? '<a href="coach/opportunities">Cancel</a>' : '<a href="coach/opportunities?add=1">Add opportunity</a>', (params.get("add") === "1" ? form() : "") +
        table(["Deadline", "Opportunity", "Type", "Status", ""], rows.map(function (o) {
          if (o.id === editId) return { raw: '<tr><td colspan="5" style="padding:0">' + form(o) + "</td></tr>" };
          return ["<b>" + fmtDate(o.deadline) + '</b><span class="sub-line">' + relDay(o.deadline) + "</span>", "<b>" + esc(o.firm) + ": " + esc(o.title) + "</b>" + (o.deadline_note ? '<span class="sub-line">' + esc(o.deadline_note) + "</span>" : "") + (o.link ? '<a class="sub-line link" style="font-size:12px" href="' + esc(o.link) + '" target="_blank" rel="noopener">' + esc(o.link.replace(/^https:\/\//, "").slice(0, 48)) + "</a>" : ""), ROLE_TYPE[o.role_type], '<button type="button" class="pill ' + (o.published ? "pill--info" : "pill--plain") + '" style="border:0;cursor:pointer" data-a="opp-vis" data-id="' + o.id + '">' + (o.published ? "Visible" : "Hidden") + "</button>", '<span class="row-wrap" style="gap:10px;flex-wrap:nowrap"><a class="link" style="font-size:13px" href="coach/opportunities?edit=' + o.id + '">Edit</a><button class="link" style="font-size:13px;color:var(--faint)" data-a="opp-del" data-id="' + o.id + '">Delete</button></span>'];
        }), "No opportunities yet."));
  };

  V.calendar = function () {
    var cal = db.calendar;
    if (!cal.connected) return panel("Connect Google Calendar", "", '<div class="panel-body" style="align-items:flex-start"><p class="muted">Calls on your calendar show up here and on Today, matched to students by attendee email. New and moved calls sync automatically, and you can import the last two years of past sessions. Read-only access.</p><a class="btn btn--solid btn--sm" href="google-oauth">Connect Google Calendar</a></div>');
    var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    var days = [0, 1, 2, 3, 4].map(function (i) { return new Date(start.getTime() + i * DB.DAY); });
    var hours = [9, 11, 13, 15, 17, 19];
    var evs = db.calendar_events.filter(function (e) { return e.coach_id === me.id; });
    var grid = '<div class="h"></div>' + days.map(function (d) { return '<div class="h">' + d.toLocaleDateString("en-US", { weekday: "short" }) + "<span>" + d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "</span></div>"; }).join("");
    hours.forEach(function (h) {
      grid += '<div class="t">' + (h > 12 ? h - 12 + " pm" : h + (h === 12 ? " pm" : " am")) + "</div>" + days.map(function (d) {
        var e = evs.filter(function (x) { var t = new Date(x.starts_at); return DB.iso(t) === DB.iso(d) && t.getHours() >= h && t.getHours() < h + 2; })[0];
        if (!e) return '<div class="c"></div>';
        var s = e.student_id ? student(e.student_id) : null;
        return '<div class="c">' + (s ? '<a class="ev' + (db.session_plans.some(function (p) { return p.student_id === s.id; }) ? " gain" : "") + '" href="coach/student?id=' + s.id + '"><b>' + esc(s.full_name) + "</b>" + fmtTime(e.starts_at) + "</a>" : '<div class="ev"><b>' + esc(e.title) + "</b>" + fmtTime(e.starts_at) + "</div>") + "</div>";
      }).join("");
    });
    return panel("Google Calendar", pill("Connected", "gain"), '<div class="panel-body"><p class="muted">Reading <b>' + esc(cal.email) + "</b> · Primary calendar · last synced " + esc(cal.synced_at || "just now") + '</p><div class="row-wrap"><button class="btn btn--ghost btn--xs" data-a="cal-sync">Sync now</button><button class="btn btn--ghost btn--xs" data-a="cal-import">Import past sessions</button><button class="btn btn--ghost btn--xs" data-a="cal-disconnect">Disconnect</button></div></div>') +
      '<div class="table-wrap" style="border:0;background:none"><div class="calendar">' + grid + "</div></div>";
  };

  V.programs = function () {
    var pid = params.get("id") || db.programs[db.programs.length - 1].id, p = DB.program(pid);
    var weeks = db.program_weeks.filter(function (w) { return w.program_id === pid; }).sort(function (a, b) { return a.week_number - b.week_number; });
    var enrolled = db.enrollments.filter(function (e) { return e.program_id === pid && e.status === "active"; });
    return '<div class="filters">' + db.programs.map(function (x) { return '<a class="chip" href="coach/programs?id=' + x.id + '" aria-pressed="' + (x.id === pid) + '">' + esc(x.name) + "</a>"; }).join("") + "</div>" +
      '<div class="stats">' + stat("Weeks", p.duration_weeks) + stat("Tasks", db.program_tasks.filter(function (t) { return weeks.some(function (w) { return w.id === t.program_week_id; }); }).length) + stat("Active students", enrolled.length) + stat("Track split", "Tech · Soft", "Two tracks per week") + "</div>" +
      '<p class="snapshot-note">This is the master curriculum. Students are on their own copy, so edits here only reach them when you send a week, and a coach can add or remove items for one student from their record.</p>' +
      weeks.map(function (w) {
        var t = db.program_tasks.filter(function (x) { return x.program_week_id === w.id; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
        return '<details class="week"' + (w.week_number === 1 ? " open" : "") + '><summary><span class="mono faint">W' + w.week_number + "</span><b>" + esc(w.title || "") + '</b><span class="grow"></span>' + pill(t.length + " tasks") + '</summary><div class="week-body"><div class="row-wrap"><input class="input" style="height:36px;max-width:340px" value="' + esc(w.title || "") + '" data-wtitle="' + w.id + '" aria-label="Week title"><button class="btn btn--ghost btn--xs" data-a="rename-week" data-id="' + w.id + '">Rename</button><button class="btn btn--ghost btn--xs" data-a="send-week" data-id="' + w.id + '">Send to current students</button></div><ul class="list" style="border:1px solid var(--line);border-radius:12px">' +
          t.map(function (x) { return '<li><div class="grow"><b>' + esc(x.title) + "</b><span>" + esc(x.description || "") + "</span></div>" + pill(x.track === "technical" ? "Technical" : "Soft skills", x.track === "technical" ? "info" : "plain") + '<button class="link" style="font-size:13px;color:var(--faint)" data-a="del-task" data-id="' + x.id + '">Delete</button></li>'; }).join("") + "</ul>" +
          '<form class="row-wrap" data-a="add-task" data-id="' + w.id + '"><input class="input" style="height:36px;flex:1;min-width:200px" name="title" placeholder="New task, e.g. Paper LBO x3"><select class="input" style="height:36px;width:150px" name="track"><option value="technical">Technical</option><option value="soft_skills">Soft skills</option></select><button class="btn btn--solid btn--xs" type="submit">Add task</button></form></div></details>';
      }).join("");
  };

  V["s-modules"] = function () {
    var studs = students();
    return '<div class="row-wrap" style="justify-content:flex-end"><button class="btn btn--solid btn--sm" data-a="new-module">New module</button></div>' + panel("Library · " + db.modules.length, "", table(["Module", "Format", "Completion", "Required for", "Status", ""], db.modules.map(function (m) {
      var done = studs.filter(function (s) { return DB.moduleStatus(s.id, m.id) === "completed"; }).length;
      var req = db.module_required.filter(function (r) { return r.module_id === m.id; });
      var reqLabel = req.length ? req.map(function (r) { return !r.program_id && !r.student_id ? "All students" : r.program_id ? (DB.program(r.program_id) || {}).name : (student(r.student_id) || {}).full_name; }).join(", ") : '<span class="faint">Optional</span>';
      return ['<a class="link" href="dashboard/module?id=' + m.id + '"><b>' + esc(m.title) + '</b></a><span class="sub-line">' + esc(m.bank) + " · " + esc(m.stage) + "</span>", "Guide · " + m.sections.length + " sections", '<span class="num">' + done + "/" + studs.length + "</span>", reqLabel, '<button type="button" class="pill ' + (m.published ? "pill--gain" : "pill--plain") + '" style="border:0;cursor:pointer" data-a="mod-pub" data-id="' + m.id + '">' + (m.published ? "Published" : "Draft") + "</button>", '<button class="link" style="font-size:13px" data-a="mod-req" data-id="' + m.id + '">Required for…</button>'];
    })));
  };

  V["s-resources"] = function () {
    var res = (window.WSA_RESOURCES || []);
    return '<p class="snapshot-note">Hidden guides disappear from every student\'s Resources tab and the library. The public link still exists until the PDF moves to private storage.</p>' + panel("Resources · " + res.length, "", table(["Guide", "Category", "Link", "Students see it"], res.map(function (r) {
      var hidden = db.resources_hidden.indexOf(r.slug) > -1;
      return ["<b>" + esc(r.title) + "</b>", esc(r.cat), '<a class="link" style="font-size:13px" href="' + r.slug + '">/' + esc(r.slug) + "</a>", '<button type="button" class="pill ' + (hidden ? "pill--plain" : "pill--gain") + '" style="border:0;cursor:pointer" data-a="res-vis" data-v="' + esc(r.slug) + '">' + (hidden ? "Hidden" : "Visible") + "</button>"];
    })));
  };

  V.coaches = function () {
    var coaches = db.profiles.filter(function (p) { return p.role === "coach"; });
    var invites = db.approved_emails.filter(function (a) { return a.role === "coach" && !DB.profileByEmail(a.email); });
    var active = DB.visibleStudents(me);
    var open = params.get("open");
    return panel("Coaches · " + coaches.length, "", '<form class="panel-body" data-a="add-coach" style="background:var(--sunk);border-bottom:1px solid var(--line)"><div class="row-wrap" style="align-items:flex-end"><label class="field" style="flex:1;min-width:220px">Add a coach by email<input class="input" name="email" type="email" placeholder="coach@wallstalpha.com"></label><button class="btn btn--solid btn--sm" type="submit">Add coach</button></div><p class="status" data-coach-err hidden></p></form><div class="panel-body" style="padding-block:10px"><p class="muted" style="font-size:13px">The coach signs up on the login page with that email and gets the coach side of the dashboard for the students you assign below, and nothing else.</p></div>' +
      table(["Coach", "Students", ""], coaches.map(function (c) {
        var mineIds = db.coach_students.filter(function (l) { return l.coach_id === c.id; }).map(function (l) { return l.student_id; });
        var isOpen = open === c.id;
        return ["<b>" + esc(c.full_name) + '</b><span class="sub-line">' + esc(c.email) + "</span>" + (isOpen ? '<div class="stack-sm" style="margin-top:10px"><span class="label">Assigned students</span>' + (mineIds.length ? '<ul class="list" style="border:1px solid var(--line);border-radius:10px">' + mineIds.map(function (id) { return "<li><div class=\"grow\">" + esc((student(id) || {}).full_name || "Former student") + '</div><button class="link" style="font-size:12.5px;color:var(--faint)" data-a="unassign" data-v="' + c.id + '" data-id="' + id + '">Remove</button></li>'; }).join("") + "</ul>" : '<p class="muted">None yet.</p>') + '<div class="row-wrap"><select class="input" style="height:34px;flex:1" data-pick="' + c.id + '"><option value="">Choose a student…</option>' + active.filter(function (s) { return mineIds.indexOf(s.id) < 0; }).map(function (s) { return '<option value="' + s.id + '">' + esc(s.full_name) + "</option>"; }).join("") + '</select><button class="btn btn--solid btn--xs" data-a="assign" data-v="' + c.id + '">Assign</button></div></div>' : ""),
          '<span class="num">' + mineIds.length + "</span>", '<a class="link" style="font-size:13px" href="coach/coaches' + (isOpen ? "" : "?open=" + c.id) + '">' + (isOpen ? "Done" : "Assign students") + "</a>"];
      }).concat(invites.map(function (i) { return [esc(i.email) + '<span class="sub-line">Invited · has not signed up yet</span>', '<span class="num faint">0</span>', '<button class="link" style="font-size:13px;color:var(--faint)" data-a="unapprove" data-v="' + esc(i.email) + '">Remove</button>']; })), "No coaches yet."));
  };

  V.dealdesk = function () {
    var D = db.deals, lanes = [["Open", ["open"]], ["Quoted", ["quoted"]], ["Stalled", ["later", "ghosted"]], ["Won", ["won"]], ["Lost / no show", ["lost", "no_show"]]];
    var openPipe = D.filter(function (d) { return d.stage === "open" || d.stage === "quoted"; }).reduce(function (a, d) { return a + (d.quote_cents || 0); }, 0);
    var won = D.filter(function (d) { return d.stage === "won"; }), closed = D.filter(function (d) { return ["won", "lost", "no_show", "ghosted"].indexOf(d.stage) > -1; });
    var STAGES = [["open", "Open"], ["quoted", "Quoted"], ["later", "Later"], ["ghosted", "Ghosted"], ["won", "Won"], ["lost", "Lost"], ["no_show", "No show"]];
    var pays = db.payments.slice().sort(function (a, b) { return a.due_on < b.due_on ? -1 : 1; });
    return '<p class="snapshot-note">Only Chase\'s account can see the Deal Desk: what each family was quoted and could afford. In the live app Postgres enforces the same rule.</p>' +
      '<div class="stats">' + stat("Open deals", D.filter(function (d) { return d.stage === "open" || d.stage === "quoted"; }).length) + stat("Pipeline", money(openPipe), "open and quoted") + stat("Signed clients", won.length) + stat("Close rate", closed.length ? Math.round(won.length / closed.length * 100) + "%" : "—", won.length + " of " + closed.length + " decided") + "</div>" +
      '<div class="row-wrap" style="justify-content:flex-end"><button class="btn btn--solid btn--sm" data-a="new-deal">New deal</button></div>' +
      '<div class="kanban">' + lanes.map(function (l) { var ds = D.filter(function (d) { return l[1].indexOf(d.stage) > -1; }); return '<div class="lane"><div class="lane-head">' + l[0] + "<span>" + ds.length + "</span></div>" + ds.map(function (d) { return '<div class="deal"><b>' + esc(d.name) + '</b><span class="muted">' + esc(d.sub) + '</span><div class="meta"><span class="q">' + (d.quote_cents ? money(d.quote_cents) : "—") + "</span><span>" + esc(d.source) + '</span></div><div class="meta"><span>' + esc(d.next_step) + '</span></div><select class="input" style="height:30px;font-size:12.5px" data-a="deal-stage" data-id="' + d.id + '" aria-label="Stage">' + STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === d.stage ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></div>"; }).join("") + "</div>"; }).join("") + "</div>" +
      panel("Payments", "", table(["Client", "Installment", "Amount", "Due", "Status", ""], pays.map(function (p) { return ["<b>" + esc((student(p.student_id) || {}).full_name || "") + "</b>", esc(p.label), '<span class="num">' + money(p.amount_cents) + "</span>", '<span class="num">' + fmtDate(p.due_on) + "</span>", p.paid_on ? pill("Paid", "gain") : p.due_on < today ? pill("Overdue", "bad") : pill("Due " + relDay(p.due_on), "warn"), p.paid_on ? "" : '<button class="link" style="font-size:13px" data-a="mark-paid" data-id="' + p.id + '">Mark paid</button>']; })));
  };

  /* ------------------------------------------------------------------ render + events */
  function render() {
    db = DB.load();
    var fn = V[view];
    root.innerHTML = fn ? fn() : '<div class="empty-state">This screen isn\'t built yet.</div>';
    var cnt = document.querySelector("[data-nav-students]"); if (cnt) cnt.textContent = students().length;
  }

  function findTask(id) { return db.enrollment_tasks.filter(function (t) { return t.id === id; })[0]; }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b || b.tagName === "FORM" || b.tagName === "SELECT" || (b.tagName === "INPUT" && b.type !== "button")) return;
    var a = b.getAttribute("data-a"), id = b.getAttribute("data-id"), v = b.getAttribute("data-v"), sid = params.get("id");
    if (a === "log-call") return logCall(me.id);
    if (a === "add-contact") return addContactDialog(me.id);
    if (a === "log-event") return eventDialog(me.id);
    if (a === "edit-event") return eventDialog(me.id, db.events.filter(function (x) { return x.id === id; })[0]);
    if (a === "del-event") { if (confirm("Delete this event?")) { db.events = db.events.filter(function (x) { return x.id !== id; }); save("Event deleted"); } return; }
    if (a === "call") return callDetail(db.calls.filter(function (x) { return x.id === id; })[0]);
    if (a === "tick") { var t = findTask(id); if (t) { t.completed = !t.completed; t.completed_at = t.completed ? today : null; save(t.completed ? "Done" : "Unticked"); } return; }
    if (a === "mod-status") { var mp = db.module_progress.filter(function (p) { return p.student_id === me.id && p.module_id === id; })[0]; if (!mp) { mp = { student_id: me.id, module_id: id }; db.module_progress.push(mp); } mp.status = v; mp.completed_at = v === "completed" ? today : null; save(v === "completed" ? "Module complete" : "Marked as not done"); return; }
    if (a === "opp-event") { var o = db.opportunities.filter(function (x) { return x.id === id; })[0]; db.events.unshift({ id: DB.uid("ev"), student_id: me.id, kind: "deadline", opp_id: o.id, title: "Deadline: " + o.firm + ", " + o.title, company: o.firm, event_date: o.deadline, location: null, notes: o.link }); save("Added to your events"); return; }
    if (a === "del-file") { db.files = db.files.filter(function (f) { return f.id !== id; }); save("File removed"); return; }
    if (a === "queue-act") { toast(v === "Remind" ? "Payment reminder drafted for " + first((student(b.getAttribute("data-sid")) || {}).full_name) : v === "Book" ? "Opening Google Calendar to book the session" : "Renewal offer drafted"); b.closest("li").style.opacity = ".45"; return; }
    if (a === "approve") {
      return dialog("Approve email", fld("email", "Email", "email", "student@school.edu") + fld("program", "Program to enroll this student in on signup", "select", "", { value: "p12", options: [["", "No program (empty dashboard)"]].concat(db.programs.map(function (p) { return [p.id, p.name]; })) }) +
        '<div class="stack-sm"><span class="label">Approved, not signed up</span><ul class="list" style="border:1px solid var(--line);border-radius:10px">' + db.approved_emails.filter(function (x) { return x.role === "student" && !DB.profileByEmail(x.email); }).map(function (x) { return "<li><div class=\"grow\">" + esc(x.email) + "</div></li>"; }).join("") + "</ul></div>", "Approve", function (vals) {
          var em = (vals.email || "").toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return "Enter a valid email.";
          if (DB.approved(em) || DB.profileByEmail(em)) return "That email is already approved or has an account.";
          db.approved_emails.push({ email: em, role: "student", program_id: vals.program || null, added_at: today }); save("Approved. They can now sign up with " + em);
        });
    }
    if (a === "unapprove") { db.approved_emails = db.approved_emails.filter(function (x) { return x.email !== v; }); save("Invite removed"); return; }
    if (a === "archive") { var s = student(sid); s.archived = v === "1"; var en = DB.enrollmentFor(sid); if (en) en.status = v === "1" ? "completed" : "active"; save(v === "1" ? "Moved to Former" : "Back on the active roster"); return; }
    if (a === "delete-student") { if (confirm("Delete this student and all their data? This can't be undone.")) { db.profiles = db.profiles.filter(function (p) { return p.id !== sid; }); ["enrollments", "calls", "contacts", "events", "assessments", "files", "call_notes", "payments"].forEach(function (k) { db[k] = db[k].filter(function (r) { return r.student_id !== sid; }); }); db.coach_students = db.coach_students.filter(function (l) { return l.student_id !== sid; }); DB.save(); go("coach/students"); } return; }
    if (a === "action-tick") { var nn = db.call_notes.filter(function (x) { return x.id === id; })[0]; nn.actions[+v].done = !nn.actions[+v].done; save(); return; }
    if (a === "save-plan") { var txt = root.querySelector("[data-plan]").value.trim(); db.session_plans = db.session_plans.filter(function (p) { return p.student_id !== sid; }); if (txt) db.session_plans.push({ student_id: sid, text: txt }); save(txt ? "Plan saved" : "Plan cleared"); return; }
    if (a === "notes-text") { var tx = root.querySelector("[data-notes-text]").value.trim(); if (!tx) return toast("Paste some notes first"); addNotes(sid, tx, "Pasted notes"); return; }
    if (a === "checkin") {
      var en2 = DB.enrollmentFor(sid), w = +v, ex = db.checkins.filter(function (c) { return c.enrollment_id === en2.id && c.week_number === w; })[0];
      if (ex) { db.checkins = db.checkins.filter(function (c) { return c !== ex; }); save("Week " + w + " stays open."); return; }
      if (w > DB.currentWeek(en2)) return toast("The date can't be in the future.");
      db.checkins.push({ enrollment_id: en2.id, week_number: w, met_on: today }); save("Week " + w + ": met " + fmtDate(today)); return;
    }
    if (a === "opp-vis") { var op = db.opportunities.filter(function (x) { return x.id === id; })[0]; op.published = !op.published; save(op.published ? "Visible to students" : "Hidden from students"); return; }
    if (a === "opp-del") { var od = db.opportunities.filter(function (x) { return x.id === id; })[0]; if (confirm("Delete " + od.firm + ": " + od.title + "? Students stop seeing it.")) { db.opportunities = db.opportunities.filter(function (x) { return x.id !== id; }); save("Deleted"); } return; }
    if (a === "audience") { db.site_settings.reminders_audience = v; save(v === "all" ? "Reminders go to every active student" : "Reminders go to test addresses only"); return; }
    if (a === "send-reminders") {
      var due = db.opportunities.filter(function (x) { var n = dayDiff(x.deadline); return x.published && (n === 7 || n === 1 || n === 0); });
      var te = root.querySelector("[data-test-emails]"); if (te) db.site_settings.reminders_test_emails = te.value;
      var rcp = db.site_settings.reminders_audience === "all" ? DB.visibleStudents(me).length : db.site_settings.reminders_test_emails.split(",").filter(function (x) { return x.trim(); }).length;
      db.site_settings.reminders_last_run = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ": " + due.length * rcp + " sent";
      save("Run for today: " + due.length + " due, " + rcp + " recipients, " + due.length * rcp + " sent (preview, nothing emailed)"); return;
    }
    if (a === "cal-sync") { db.calendar.synced_at = "just now"; save("Synced. Calendar is up to date."); return; }
    if (a === "cal-import") { toast("Importing the last two years of past sessions…"); return; }
    if (a === "cal-disconnect") { db.calendar = { connected: false, email: null, synced_at: null }; save("Google Calendar disconnected"); return; }
    if (a === "rename-week") { var wk = db.program_weeks.filter(function (x) { return x.id === id; })[0]; wk.title = root.querySelector('[data-wtitle="' + id + '"]').value.trim() || wk.title; save("Week renamed"); return; }
    if (a === "send-week") { var pw = db.program_weeks.filter(function (x) { return x.id === id; })[0], tasks = db.program_tasks.filter(function (t) { return t.program_week_id === id; }), n2 = 0;
      db.enrollments.filter(function (en3) { return en3.program_id === pw.program_id && en3.status === "active"; }).forEach(function (en3) { tasks.forEach(function (t) { if (!db.enrollment_tasks.some(function (x) { return x.enrollment_id === en3.id && x.week_number === pw.week_number && x.title === t.title; })) { db.enrollment_tasks.push({ id: en3.id + "_" + t.id + "_" + Date.now(), enrollment_id: en3.id, week_number: pw.week_number, title: t.title, description: t.description, track: t.track, sort_order: t.sort_order, completed: false }); n2 += 1; } }); });
      save(n2 ? "Sent " + n2 + " new task" + (n2 === 1 ? "" : "s") + " to current students" : "Everyone already has this week"); return; }
    if (a === "del-task") { if (confirm("Delete this task from the master curriculum? Students keep their copy.")) { db.program_tasks = db.program_tasks.filter(function (t) { return t.id !== id; }); save("Task deleted"); } return; }
    if (a === "mod-pub") { var mo = db.modules.filter(function (x) { return x.id === id; })[0]; mo.published = !mo.published; save(mo.published ? "Published" : "Moved to drafts"); return; }
    if (a === "mod-req") {
      return dialog("Required for", fld("who", "Who has to complete it?", "select", "", { value: "all", options: [["all", "All students"], ["none", "Nobody (optional)"]].concat(db.programs.map(function (p) { return ["p:" + p.id, "Everyone on the " + p.name]; })).concat(DB.visibleStudents(me).map(function (s) { return ["s:" + s.id, s.full_name]; })) }), "Save", function (vals) {
        db.module_required = db.module_required.filter(function (r) { return r.module_id !== id; });
        if (vals.who === "all") db.module_required.push({ module_id: id, program_id: null, student_id: null });
        else if (vals.who.indexOf("p:") === 0) db.module_required.push({ module_id: id, program_id: vals.who.slice(2), student_id: null });
        else if (vals.who.indexOf("s:") === 0) db.module_required.push({ module_id: id, program_id: null, student_id: vals.who.slice(2) });
        save("Requirement saved");
      });
    }
    if (a === "new-module") {
      return dialog("New module", fld("title", "Title", "text", "Moelis Superday 2026") + '<div class="fields-2">' + fld("bank", "Company", "text", "Moelis") + fld("stage", "Stage", "select", "", { value: "Superday", options: ["Phone screen", "First round", "Superday", "Technicals", "Question bank", "Overview"].map(function (s) { return [s, s]; }) }) + "</div>" + fld("body", "First section", "textarea", "Paste the opening section. The full editor imports PDFs into sections.", { rows: 4 }), "Create module", function (vals) {
        if (!vals.title) return "Give the module a title.";
        db.modules.push({ id: DB.uid("m"), title: vals.title, bank: vals.bank || "General", stage: vals.stage, format: "guide", sections: [{ heading: null, excerpt: vals.body || "" }], published: false, sort_order: db.modules.length });
        save("Module created as a draft");
      });
    }
    if (a === "res-vis") { var hid = db.resources_hidden.indexOf(v) > -1; db.resources_hidden = hid ? db.resources_hidden.filter(function (x) { return x !== v; }) : db.resources_hidden.concat([v]); save(hid ? "Students can see it again" : "Hidden from students"); return; }
    if (a === "assign") { var pick = root.querySelector('[data-pick="' + v + '"]').value; if (!pick) return toast("Choose a student first"); db.coach_students = db.coach_students.filter(function (l) { return l.student_id !== pick; }); db.coach_students.push({ coach_id: v, student_id: pick }); save("Assigned"); return; }
    if (a === "unassign") { db.coach_students = db.coach_students.filter(function (l) { return !(l.coach_id === v && l.student_id === id); }); save("Removed"); return; }
    if (a === "new-deal") {
      return dialog("New deal", fld("name", "Name", "text", "Student name") + fld("sub", "School and target", "text", "Cornell '28 · IB") + '<div class="fields-2">' + fld("quote", "Quote ($)", "number", "6500") + fld("source", "Source", "select", "", { value: "Lecture", options: [["Lecture", "Lecture"], ["VSL", "VSL"], ["DM", "DM"], ["Referral", "Referral"]] }) + "</div>" + fld("next", "Next step", "text", "Send proposal"), "Create deal", function (vals) {
        if (!vals.name) return "Add a name.";
        db.deals.unshift({ id: DB.uid("d"), name: vals.name, sub: vals.sub || "", stage: "open", quote_cents: vals.quote ? Math.round(+vals.quote * 100) : null, next_step: vals.next || "", last_contact: today, source: vals.source }); save("Deal created");
      });
    }
    if (a === "mark-paid") { var py = db.payments.filter(function (x) { return x.id === id; })[0]; py.paid_on = today; save("Marked paid"); return; }
  });
  root.addEventListener("change", function (e) {
    var t = e.target, a = t.getAttribute("data-a"), sid = params.get("id");
    if (a === "filter-company") { var p = new URLSearchParams(window.location.search); if (t.value) p.set("company", t.value); else p.delete("company"); go("dashboard/modules" + (p.toString() ? "?" + p : "")); return; }
    if (a === "assign-coach") { db.coach_students = db.coach_students.filter(function (l) { return l.student_id !== sid; }); if (t.value) db.coach_students.push({ coach_id: t.value, student_id: sid }); save(t.value ? "Coach assigned" : "Back with Chase"); return; }
    if (a === "enroll" && t.value) { DB.enroll(sid, t.value); save("Enrolled on the " + DB.program(t.value).name); return; }
    if (a === "deal-stage") { var d = db.deals.filter(function (x) { return x.id === t.getAttribute("data-id"); })[0]; d.stage = t.value; d.last_contact = today; save("Moved to " + t.options[t.selectedIndex].text); return; }
    if (a === "upload" && t.files && t.files[0]) { var f = t.files[0]; db.files.unshift({ id: DB.uid("f"), student_id: t.getAttribute("data-sid"), name: f.name, size: f.size, uploaded_by: me.id, uploaded_at: today }); save("Uploaded " + f.name); return; }
    if (a === "notes-file" && t.files && t.files[0]) {
      var file = t.files[0];
      if (/\.txt$/i.test(file.name)) { var r = new FileReader(); r.onload = function () { addNotes(sid, String(r.result || ""), file.name); }; r.readAsText(file); }
      else addNotes(sid, "", file.name);
      return;
    }
    if (a === "import-csv" && t.files && t.files[0]) {
      var rd = new FileReader();
      rd.onload = function () {
        var lines = String(rd.result || "").split(/\r?\n/).filter(function (l) { return l.trim(); });
        var out = root.querySelector("[data-import-out]");
        if (lines.length < 2) { out.hidden = false; out.className = "status status--error"; out.textContent = "That file looks empty. It needs a header row and at least one contact."; return; }
        var head = lines[0].split(",").map(function (h) { return h.trim().toLowerCase(); });
        var col = function (names) { for (var i = 0; i < head.length; i += 1) if (names.indexOf(head[i]) > -1) return i; return -1; };
        var ci = { name: col(["name", "full name", "contact"]), bank: col(["firm", "bank", "company"]), group: col(["group", "team", "desk"]), title: col(["title", "role"]), email: col(["email", "e-mail"]) };
        var added = 0, skipped = 0;
        lines.slice(1).forEach(function (l) { var c = l.split(","); var nm = ci.name > -1 ? (c[ci.name] || "").trim() : ""; if (!nm) { skipped += 1; return; } if (db.contacts.some(function (k) { return k.student_id === me.id && k.name.toLowerCase() === nm.toLowerCase(); })) { skipped += 1; return; } addContact(me.id, { name: nm, bank: ci.bank > -1 ? c[ci.bank] : "", group: ci.group > -1 ? c[ci.group] : "", title: ci.title > -1 ? c[ci.title] : "", email: ci.email > -1 ? c[ci.email] : "" }); added += 1; });
        save("Imported " + added + " contact" + (added === 1 ? "" : "s") + (skipped ? ", skipped " + skipped : ""));
      };
      rd.readAsText(t.files[0]);
    }
  });
  root.addEventListener("submit", function (e) {
    var f = e.target, a = f.getAttribute("data-a"); if (!a) return;
    e.preventDefault();
    var val = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; };
    var sid = params.get("id");
    if (a === "log-assess") { var sc = parseFloat(val("score")), k = val("kind"); if (isNaN(sc)) return toast("Add a score"); if (sc > ASSESS[k][1] || sc < 0) return toast("Scores for " + ASSESS[k][0] + " run 0 to " + ASSESS[k][1]); db.assessments.unshift({ id: DB.uid("a"), student_id: sid, kind: k, score: sc, notes: val("notes") || null, assessed_on: today }); save("Assessment logged"); return; }
    if (a === "save-opp") {
      var err = f.querySelector("[data-opp-err]"), say = function (m) { err.hidden = false; err.className = "status status--error"; err.textContent = m; };
      if (!val("firm") || !val("title")) return say("Firm and title are needed.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val("deadline"))) return say("Pick the deadline date.");
      var link = val("link"); if (link && !/^https:\/\//i.test(link)) return say("Use a full https:// link.");
      var id = f.getAttribute("data-id"), row = id ? db.opportunities.filter(function (x) { return x.id === id; })[0] : { id: DB.uid("o"), published: true };
      Object.assign(row, { firm: val("firm"), title: val("title"), role_type: val("role_type"), deadline: val("deadline"), link: link || null, deadline_note: val("deadline_note") || null, notes: val("notes") || null });
      if (!id) db.opportunities.push(row);
      DB.save(); go("coach/opportunities"); return;
    }
    if (a === "add-task") { var ti = val("title"); if (!ti) return toast("Name the task"); var wid = f.getAttribute("data-id"); db.program_tasks.push({ id: DB.uid("t"), program_week_id: wid, title: ti, description: "", track: val("track"), sort_order: 99 }); save("Task added to the master week"); return; }
    if (a === "add-coach") {
      var em = val("email").toLowerCase(), ce = f.querySelector("[data-coach-err]");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { ce.hidden = false; ce.className = "status status--error"; ce.textContent = "Enter a valid email."; return; }
      if (DB.approved(em) || DB.profileByEmail(em)) { ce.hidden = false; ce.className = "status status--error"; ce.textContent = "Couldn't add that email. It may already be approved."; return; }
      db.approved_emails.push({ email: em, role: "coach", program_id: null, added_at: today }); save("Invite added. " + em + " can now sign up as a coach.");
    }
  });
  function addNotes(sid, text, source) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var acts = lines.filter(function (l) { return /^[-*•]/.test(l); }).map(function (l) { return { text: l.replace(/^[-*•]\s*/, ""), done: false }; });
    var prose = lines.filter(function (l) { return !/^[-*•]/.test(l); }).join(" ");
    var s = student(sid);
    db.call_notes.unshift({ id: DB.uid("n"), student_id: sid, session_date: today, source: source,
      summary: prose ? prose.slice(0, 320) + (prose.length > 320 ? "…" : "") : "Summary of " + source + ": covered this week's curriculum with " + first(s.full_name) + ", reviewed open applications and set the next priorities.",
      actions: acts.length ? acts.slice(0, 6) : [{ text: "Finish this week's technical tasks", done: false }, { text: "Send two follow-up emails", done: false }, { text: "Bring one live deal to the next session", done: false }] });
    save("Notes summarised into the Next session card");
  }

  render();
})();
