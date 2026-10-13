/* Wall Street Alpha mock database (preview build).
   Mirrors the Lovable/Supabase tables closely enough that the screens behave the same way:
   profiles + roles, approved_emails, programs/weeks/tasks, enrollments with a per-student copy of
   the curriculum, weekly check-ins, coach_students, modules + progress + required modules,
   contacts, calls, events, assessments, opportunities, coaching notes, payments, calendar events
   and the Deal Desk. Everything lives in this browser's localStorage; "Reset demo data" reseeds it.
   Scoping helpers stand in for Postgres row security: admins see everyone, coaches see their
   assigned students, students see themselves, members (free forum accounts) see nothing. */
(function () {
  "use strict";
  var KEY = "wsa_db";
  var VERSION = 4;
  var MODULES = /*__MODULES__*/[];

  var DAY = 86400000;
  function iso(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  function rel(days) { return iso(Date.now() + days * DAY); }
  function relAt(days, h, m) { var d = new Date(Date.now() + days * DAY); d.setHours(h, m || 0, 0, 0); return d.toISOString(); }
  var n = 0;
  function uid(p) { n += 1; return (p || "id") + "_" + Date.now().toString(36) + "_" + n.toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ------------------------------------------------------------------ seed */
  function seed() {
    var db = { version: VERSION, seededAt: new Date().toISOString() };

    /* profiles: one row per account, role decides everything */
    var P = function (id, email, name, role, extra) { return Object.assign({ id: id, email: email, full_name: name, role: role, created_at: rel(-60), onboarded: true, archived: false }, extra || {}); };
    db.profiles = [
      P("u_chase", "chase@wallstalpha.com", "Chase Enloe", "admin", { deal_desk: true }),
      P("u_amber", "amber@wallstalpha.com", "Amber Teng", "admin"),
      P("u_casey", "coach@wallstalpha.com", "Casey Morgan", "coach"),
      P("u_alex", "student@wallstalpha.com", "Alex Teng", "student", { school: "Indiana University", class_year: "2028", gpa: 3.7, target_role: "Investment Banking", secondary_role: "Private Credit", linkedin_url: "https://www.linkedin.com/in/", tracker_url: "https://docs.google.com/spreadsheets/d/preview", resume_name: "Alex_Teng_Resume.pdf" }),
      P("u_priya", "priya.shah@umich.edu", "Priya Shah", "student", { school: "University of Michigan", class_year: "2028", gpa: 3.8, target_role: "Investment Banking", secondary_role: "Equity Research", linkedin_url: "https://www.linkedin.com/in/", resume_name: "Priya_Shah_CV.pdf" }),
      P("u_jordan", "jordan.alvarez@stern.nyu.edu", "Jordan Alvarez", "student", { school: "NYU Stern", class_year: "2027", gpa: 3.6, target_role: "Investment Banking", secondary_role: "Private Equity", linkedin_url: "https://www.linkedin.com/in/" }),
      P("u_marcus", "marcus.lee@iu.edu", "Marcus Lee", "student", { school: "Indiana University", class_year: "2028", gpa: 3.5, target_role: "Private Credit", secondary_role: "Investment Banking" }),
      P("u_sam", "sam.ortiz@unc.edu", "Sam Ortiz", "student", { school: "UNC", class_year: "2027", gpa: 3.4, target_role: "Sales & Trading", secondary_role: "Hedge Funds" }),
      P("u_hannah", "hannah.cole@emory.edu", "Hannah Cole", "student", { school: "Emory", class_year: "2028", gpa: 3.9, target_role: "Investment Banking", linkedin_url: "https://www.linkedin.com/in/" }),
      P("u_ethan", "ethan.park@babson.edu", "Ethan Park", "student", { school: "Babson", class_year: "2027", gpa: 3.5, target_role: "Investment Banking" }),
      P("u_daniel", "daniel.kim@uoregon.edu", "Daniel Kim", "student", { school: "University of Oregon", class_year: "2027", gpa: 3.6, target_role: "Investment Banking", archived: true }),
      P("u_sammem", "member@wallstalpha.com", "Sam Rivera", "member", { school: "Rutgers" })
    ];
    db.admin_emails = ["chase@wallstalpha.com", "amber@wallstalpha.com"];
    /* approved_emails: the invite list. Signing up with one of these makes a student (or coach). */
    db.approved_emails = [
      { email: "new.student@wallstalpha.com", role: "student", program_id: "p12", added_at: rel(-1) },
      { email: "new.coach@wallstalpha.com", role: "coach", program_id: null, added_at: rel(-1) }
    ];

    /* programs: 4, 6, 10 and 12 weeks. Tasks are split into Technical and Soft skills tracks. */
    db.programs = [
      { id: "p4", name: "4-Week Accelerator", duration_weeks: 4, description: "Technicals and interview readiness, fast." },
      { id: "p6", name: "6-Week Program", duration_weeks: 6, description: "Technicals sprint plus networking foundations." },
      { id: "p10", name: "10-Week Program", duration_weeks: 10, description: "Condensed from the 12-week program." },
      { id: "p12", name: "12-Week Program", duration_weeks: 12, description: "The full Alpha Path: lane, positioning, process, execution." }
    ];
    var W = {
      p4: [
        ["Foundations", [["Accounting crash course", "Three statements and how they link. Write the links from memory.", "technical"], ["DCF walkthrough, written out", "Walk me through a DCF on paper, no notes.", "technical"], ["EV vs equity value drills", "10 drills, no calculator.", "technical"], ["Draft your story", "The 2-minute version. Say it out loud 5 times.", "soft_skills"], ["LinkedIn overhaul", "Headline, photo, About section, target-firm follows.", "soft_skills"], ["Resume banker-ready", "One page. Numbers in every bullet.", "soft_skills"]]],
        ["Valuation and behaviorals", [["Valuation multiples", "EV/EBITDA vs P/E: when and why each.", "technical"], ["Paper LBO x3", "Three paper LBOs under 10 minutes each.", "technical"], ["400 questions: accounting", "Full accounting section, mark misses.", "technical"], ["Behavioral drafts", "Strengths, weakness, failure, leadership. Written.", "soft_skills"], ["10 questions for bankers", "Questions that show you did the work.", "soft_skills"]]],
        ["Modeling and mocks", [["3-statement model from scratch", "Blank sheet to linked model in 90 minutes.", "technical"], ["DCF on a real company", "Pick a name you would pitch. Defend the assumptions.", "technical"], ["Mock behavioral with coach", "Full 30-minute behavioral round.", "soft_skills"], ["Record yourself answering", "Watch it back. Fix the filler words.", "soft_skills"]]],
        ["Superday ready", [["Two timed technical mocks", "Full first-round sims, graded.", "technical"], ["Review misses, redo drills", "Every missed question becomes a drill.", "technical"], ["Superday logistics check", "Outfit, route, sleep, what to bring.", "soft_skills"], ["Full superday simulation", "Back-to-back rounds with no breaks.", "soft_skills"]]]
      ],
      p12: [
        ["Choose your lane", [["Accounting fundamentals I", "Income statement deep dive.", "technical"], ["Story draft v1", "First pass at your 2-minute story.", "soft_skills"], ["Target list: 25 firms", "Bulge, elite boutique, middle market. Why each.", "soft_skills"]]],
        ["Positioning", [["Accounting fundamentals II", "Balance sheet and cash flow links.", "technical"], ["LinkedIn and resume pass", "Both banker-ready by Friday.", "soft_skills"]]],
        ["Network", [["Enterprise value drills", "15 EV bridge questions.", "technical"], ["First outreach batch", "20 cold emails to alumni.", "soft_skills"]]],
        ["Valuation", [["DCF deep dive", "Terminal value three ways: growth, exit multiple, convergence.", "technical"], ["Coffee chat framework", "Five questions, one ask, follow-up within 24 hours.", "soft_skills"]]],
        ["Multiples", [["Comps and precedents", "Build a comps set for one deal you follow.", "technical"], ["Second outreach batch", "20 more emails, follow up on the first batch.", "soft_skills"]]],
        ["Deal discussion", [["Pick your deal", "One live deal you can discuss for five minutes.", "technical"], ["Networking call x3", "Log every call in the dashboard.", "soft_skills"]]],
        ["LBO", [["Paper LBO x3", "Three paper LBOs under 10 minutes each.", "technical"], ["Behavioral drafts", "Strengths, weakness, failure, leadership.", "soft_skills"]]],
        ["M&A", [["Accretion / dilution", "Five quick checks, then one full build.", "technical"], ["Why this firm, x5", "One paragraph per top firm.", "soft_skills"]]],
        ["Mock interviews", [["Timed technical mock", "First-round sim, graded.", "technical"], ["Mock behavioral with coach", "Full 30-minute round.", "soft_skills"]]],
        ["Superday prep", [["Superday question sets", "Firm-specific sets from the modules library.", "technical"], ["Thank-you notes template", "Within 24 hours, specific to each interviewer.", "soft_skills"]]],
        ["Execute", [["Review misses, redo drills", "Every missed question becomes a drill.", "technical"], ["Full superday simulation", "Back-to-back rounds with no breaks.", "soft_skills"]]],
        ["Offer and next steps", [["Offer evaluation", "Compare offers on group, class size and exits.", "technical"], ["Pay it forward", "Two intros for students behind you.", "soft_skills"]]]
      ]
    };
    W.p6 = W.p4.concat([["Networking sprint", [["Firm-specific question sets", "Two firms, full sets.", "technical"], ["10 alumni emails", "Personalized, logged.", "soft_skills"]]], ["Close out", [["Final technical mock", "Graded, with notes.", "technical"], ["Offer conversations", "How to handle timelines and exploding offers.", "soft_skills"]]]]);
    W.p10 = (function () {
      var out = [];
      W.p12.forEach(function (w, i) {
        var t = Math.min(10, Math.ceil((i + 1) * 10 / 12)) - 1;
        if (!out[t]) out[t] = [w[0], w[1].slice()];
        else { out[t][0] += " + " + w[0]; out[t][1] = out[t][1].concat(w[1]); }
      });
      return out;
    })();
    db.program_weeks = []; db.program_tasks = [];
    Object.keys(W).forEach(function (pid) {
      W[pid].forEach(function (w, i) {
        var wid = pid + "_w" + (i + 1);
        db.program_weeks.push({ id: wid, program_id: pid, week_number: i + 1, title: w[0] });
        w[1].forEach(function (t, k) { db.program_tasks.push({ id: wid + "_t" + (k + 1), program_week_id: wid, title: t[0], description: t[1], track: t[2], sort_order: k + 1 }); });
      });
    });

    /* enrollments: each copies its program into enrollment_tasks so per-student edits stay local */
    db.enrollments = []; db.enrollment_tasks = []; db.checkins = [];
    function enroll(sid, pid, startDays, weeksMet, sessionsPurchased) {
      var eid = "e_" + sid;
      db.enrollments.push({ id: eid, student_id: sid, program_id: pid, start_date: rel(startDays), status: "active", sessions_purchased: sessionsPurchased });
      var curWeek = Math.max(1, Math.min(programWeeks(db, pid), Math.floor(-startDays / 7) + 1));
      db.program_weeks.filter(function (w) { return w.program_id === pid; }).forEach(function (w) {
        db.program_tasks.filter(function (t) { return t.program_week_id === w.id; }).forEach(function (t, k) {
          var done = w.week_number < curWeek || (w.week_number === curWeek && k === 0);
          db.enrollment_tasks.push({ id: eid + "_" + t.id, enrollment_id: eid, week_number: w.week_number, title: t.title, description: t.description, track: t.track, sort_order: t.sort_order, completed: done, completed_at: done ? rel(startDays + (w.week_number - 1) * 7 + 3) : null });
        });
      });
      for (var i = 1; i <= weeksMet; i += 1) db.checkins.push({ enrollment_id: eid, week_number: i, met_on: rel(startDays + (i - 1) * 7 + 2) });
    }
    enroll("u_alex", "p12", -36, 5, 12);
    enroll("u_priya", "p12", -40, 5, 12);
    enroll("u_jordan", "p10", -57, 8, 10);
    enroll("u_marcus", "p6", -22, 3, 6);
    enroll("u_sam", "p12", -45, 5, 12);
    enroll("u_hannah", "p12", -72, 10, 12);
    enroll("u_ethan", "p4", -15, 2, 4);
    db.enrollments.push({ id: "e_u_daniel", student_id: "u_daniel", program_id: "p12", start_date: rel(-100), status: "completed", sessions_purchased: 12 });
    db.coach_students = [{ coach_id: "u_casey", student_id: "u_priya" }, { coach_id: "u_casey", student_id: "u_marcus" }, { coach_id: "u_casey", student_id: "u_ethan" }];

    /* modules: real titles and section headings; text trimmed to excerpts for the preview */
    db.modules = MODULES.map(function (m, i) { return { id: "m" + (i + 1), title: m.title, bank: m.bank, stage: m.stage, format: "guide", sections: m.sections, published: true, sort_order: i }; });
    db.module_required = [{ module_id: "m17", program_id: "p12", student_id: null }, { module_id: "m36", program_id: null, student_id: null }, { module_id: "m10", program_id: null, student_id: "u_alex" }];
    db.module_progress = [
      { student_id: "u_alex", module_id: "m17", status: "in_progress" }, { student_id: "u_alex", module_id: "m8", status: "completed", completed_at: rel(-9) },
      { student_id: "u_alex", module_id: "m9", status: "completed", completed_at: rel(-6) }, { student_id: "u_priya", module_id: "m17", status: "completed", completed_at: rel(-3) },
      { student_id: "u_jordan", module_id: "m36", status: "in_progress" }
    ];

    /* networking: Chase's own demo seed (Apple/Banana packs), spread across the roster */
    db.calls = [
      { id: "c1", student_id: "u_alex", call_date: rel(-2), status: "parsed", ai_summary: "You had a strong call with a Morgan Stanley ER VP who covers semis. She offered to review your NVDA pitch, gave you her email, and volunteered to flag you to the recruiter when the sophomore program opens.", improvement_notes: "Send the NVDA pitch within 48 hours while the offer is warm.", student_notes: null },
      { id: "c2", student_id: "u_alex", call_date: rel(-1), status: "parsed", ai_summary: "Solid process-focused call with an MS ER associate. He walked you through the superday format, told you one round is a live pitch, and warned against pitching a consensus long.", improvement_notes: "Ask one more personal question before diving into process next time.", student_notes: null },
      { id: "c3", student_id: "u_alex", call_date: rel(-5), status: "parsed", ai_summary: "Useful staffing-model call with an Evercore associate. He explained the generalist first year and told you to state your M&A preference consistently and anchor it to a live deal.", improvement_notes: "Pick one recent deal and be ready to discuss it in depth.", student_notes: null },
      { id: "c4", student_id: "u_alex", call_date: rel(0), status: "parsed", ai_summary: null, improvement_notes: null, student_notes: "Quick 10-minute intro call, mostly logistics. She is sending me the desk overview deck. Forgot to grab her exact title, need to check LinkedIn." },
      { id: "c5", student_id: "u_priya", call_date: rel(-3), status: "parsed", ai_summary: "Good call with a Lazard restructuring analyst. She offered a resume read and explained how RX staffing differs from M&A.", improvement_notes: "Send the resume by Friday with a one-line thank you.", student_notes: null },
      { id: "c6", student_id: "u_marcus", call_date: rel(-4), status: "failed", ai_summary: null, improvement_notes: null, student_notes: null },
      { id: "c7", student_id: "u_jordan", call_date: rel(-6), status: "parsed", ai_summary: "Citi LevFin VP walked through covenant-lite trends and offered an intro to the analyst class.", improvement_notes: "Reference her covenant-lite point in the follow-up.", student_notes: null }
    ];
    var C = function (id, sid, name, bank, group, title, extra) { return Object.assign({ id: id, student_id: sid, name: name, bank: bank, group_name: group, title: title, email: null, linkedin_url: null, personal_notes: null, call_id: null, event_id: null, created_at: rel(-10) }, extra || {}); };
    db.contacts = [
      C("k1", "u_alex", "Priya Raman", "Morgan Stanley", "Equity Research - Semis", "Vice President", { call_id: "c1", email: "priya.raman@morganstanley.com", personal_notes: "Offered pitch review and recruiter referral. Intro to Dev on her team coming.", created_at: rel(-2) }),
      C("k2", "u_alex", "Dev Sharma", "Morgan Stanley", "Equity Research - Semis", "Associate", { call_id: "c2", personal_notes: "Intro from Priya. Superday: 3 rounds, one live pitch. Avoid consensus longs.", created_at: rel(-1) }),
      C("k3", "u_alex", "Tom Becker", "Evercore", "M&A", "Associate", { call_id: "c3", personal_notes: "Generalist year then group ranking. Wants to hear a live deal in the follow-up.", created_at: rel(-5) }),
      C("k4", "u_alex", "Rachel Lin", "Citi", "Leveraged Finance", "Vice President", { personal_notes: "Panel speaker. Follow up referencing her point about covenant-lite deals.", created_at: rel(-12) }),
      C("k5", "u_alex", "Victor Osei", "Goldman Sachs", null, "Analyst", { personal_notes: "Met in the spring. Have not spoken since.", created_at: rel(-30) }),
      C("k6", "u_priya", "Aisha Khan", "Lazard", "Restructuring", "Analyst", { call_id: "c5", personal_notes: "Met at the restructuring dinner. Offered a resume read." }),
      C("k7", "u_jordan", "Sofia Ruiz", "Citi", "Leveraged Finance", "Vice President", { call_id: "c7" }),
      C("k8", "u_marcus", "Ben Hartley", "Centerview", "TMT", "Associate")
    ];
    var E = function (id, sid, kind, title, company, days, loc, notes) { return { id: id, student_id: sid, kind: kind, title: title, company: company, event_date: days === null ? null : rel(days), location: loc, notes: notes || null }; };
    db.events = [
      E("ev1", "u_alex", "networking", "Goldman campus dinner", "Goldman Sachs", -8, "Campus faculty club", "Sat next to Marcus. He said to email him after spring finals about the insight program."),
      E("ev2", "u_alex", "coffee_chat", "Evercore office visit", "Evercore", -1, "55th & Park", null),
      E("ev3", "u_alex", "info_session", "JPMorgan office hours", "JPMorgan", 0, "Zoom", null),
      E("ev4", "u_alex", "career_fair", "Fall finance career fair", null, 6, "Student center", null),
      E("ev5", "u_alex", "info_session", "IBD virtual info session", "Barclays", 4, "Zoom", null),
      E("ev6", "u_priya", "networking", "Lazard restructuring dinner", "Lazard", -6, "Tribeca", "Small group dinner. Aisha offered a resume read; follow up Friday."),
      E("ev7", "u_priya", "coffee_chat", "Coffee with Dev Sharma", "Morgan Stanley", 1, "Bryant Park", null),
      E("ev8", "u_jordan", "networking", "Citi women in banking panel", "Citi", 3, "Greenwich St", null)
    ];
    var A = function (id, sid, kind, score, notes, days) { return { id: id, student_id: sid, kind: kind, score: score, notes: notes, assessed_on: rel(days) }; };
    db.assessments = [
      A("a1", "u_alex", "modeling", 82, "Clean model, circularity handled. Slow on formatting.", -8),
      A("a2", "u_alex", "mock_interview", 5, "Rambling on why-this-firm. Needs a rewrite before Friday.", -2),
      A("a3", "u_alex", "dcf", 74, "Terminal value still hand-wavy; EV bridge clean.", -4),
      A("a4", "u_priya", "mock_interview", 7, "Good energy, story is tight. Paper LBO still slow.", -6),
      A("a5", "u_priya", "lbo", 68, "LBO template solid, returns math slow.", -1),
      A("a6", "u_jordan", "mock_interview", 8, "Big jump from last week. Story is automatic now.", 0)
    ];

    /* opportunities: staff add them, students see the visible ones on Deadlines */
    var O = function (id, firm, title, type, days, note, notes, pub, link) { return { id: id, firm: firm, title: title, role_type: type, deadline: rel(days), deadline_note: note || null, notes: notes || null, published: pub !== false, link: link || "https://www.goldmansachs.com/careers/" }; };
    db.opportunities = [
      O("o1", "Goldman Sachs", "2028 Summer Analyst, Investment Banking", "internship", 4, "11:59pm ET · resume and cover letter", "Apply early; first-round invites go out on a rolling basis."),
      O("o2", "Morgan Stanley", "2028 Early Insights Program", "early_insight", 9, null, "Sophomores only. Mention your MS coffee chats in the short answer."),
      O("o3", "Evercore", "Diversity Info Session", "event", 2, "6pm ET, virtual", null),
      O("o4", "Blackstone", "2028 Summer Analyst", "internship", 18, null, null),
      O("o5", "Point72 Academy", "Investment Analyst Program (2027, US)", "full_time", 25, "Rolling", null),
      O("o6", "Demo Bank", "Test opportunity", "other", 7, null, null, false),
      O("o7", "Lazard", "2027 Summer Analyst, Restructuring", "internship", -3, null, null)
    ];
    db.site_settings = { reminders_audience: "test", reminders_test_emails: "chase@wallstalpha.com, amber@wallstalpha.com", reminders_last_run: null };
    db.resources_hidden = ["alpha", "job", "freelist", "triage"];

    /* coaching: notes from sessions (the meeting-notes drop box), next-session plans, payments, calendar */
    db.call_notes = [
      { id: "n1", student_id: "u_alex", session_date: rel(-5), summary: "Covered the EV bridge and terminal value. Alex is strong on accounting but rushes the DCF walk. Recruiting update: Evercore first round next Tuesday.", actions: [{ text: "Two paper LBOs before next session", done: true }, { text: "Rewrite 'why Evercore' in under 45 seconds", done: false }, { text: "Send the NVDA pitch to Priya Raman", done: false }], source: "Gemini notes · PDF" },
      { id: "n2", student_id: "u_priya", session_date: rel(-7), summary: "Story and fit. Priya's opener runs long when nervous; technicals are solid.", actions: [{ text: "Cut the opener to 45 seconds", done: false }], source: "Typed notes" },
      { id: "n3", student_id: "u_jordan", session_date: rel(-3), summary: "Mock superday debrief. Strong across rounds; prep a live deal for Moelis.", actions: [{ text: "Pick one live deal", done: true }], source: "Gemini notes · Word" }
    ];
    db.session_plans = [{ student_id: "u_hannah", text: "Superday debrief: what went well, the one question to fix, thank-you notes." }, { student_id: "u_jordan", text: "Mock superday, three rounds, Moelis deal discussion." }];
    db.payments = [
      { id: "pay1", student_id: "u_jordan", label: "Installment 2 of 3", amount_cents: 120000, due_on: rel(-9), paid_on: null },
      { id: "pay2", student_id: "u_sam", label: "Installment 2 of 2", amount_cents: 240000, due_on: rel(3), paid_on: null },
      { id: "pay3", student_id: "u_priya", label: "Installment 3 of 3", amount_cents: 100000, due_on: rel(6), paid_on: null },
      { id: "pay4", student_id: "u_hannah", label: "Paid in full", amount_cents: 650000, due_on: rel(-40), paid_on: rel(-40) },
      { id: "pay5", student_id: "u_ethan", label: "Installment 1 of 3", amount_cents: 220000, due_on: rel(-8), paid_on: rel(-8) }
    ];
    db.calendar = { connected: false, email: null, synced_at: null };
    db.calendar_events = [
      { id: "ce1", student_id: "u_hannah", title: "Hannah Cole / Chase", starts_at: relAt(0, 13), ends_at: relAt(0, 14), coach_id: "u_chase" },
      { id: "ce2", student_id: "u_priya", title: "Priya Shah / Casey", starts_at: relAt(0, 16), ends_at: relAt(0, 17), coach_id: "u_casey" },
      { id: "ce3", student_id: "u_ethan", title: "Ethan Park / Casey", starts_at: relAt(0, 19), ends_at: relAt(0, 20), coach_id: "u_casey" },
      { id: "ce4", student_id: "u_jordan", title: "Jordan Alvarez / Chase", starts_at: relAt(1, 11), ends_at: relAt(1, 12), coach_id: "u_chase" },
      { id: "ce5", student_id: "u_alex", title: "Alex Teng / Chase", starts_at: relAt(2, 19), ends_at: relAt(2, 20), coach_id: "u_chase" },
      { id: "ce6", student_id: "u_marcus", title: "Marcus Lee / Casey", starts_at: relAt(3, 18), ends_at: relAt(3, 19), coach_id: "u_casey" },
      { id: "ce7", student_id: null, title: "Strategy calls (3)", starts_at: relAt(1, 15), ends_at: relAt(1, 16), coach_id: "u_chase" }
    ];
    db.files = [
      { id: "f1", student_id: "u_alex", name: "Resume v4 (Chase's markup).pdf", size: 182000, uploaded_by: "u_chase", uploaded_at: rel(-7) },
      { id: "f2", student_id: "u_alex", name: "Networking tracker.xlsx", size: 48000, uploaded_by: "u_alex", uploaded_at: rel(-30) },
      { id: "f3", student_id: "u_alex", name: "Why banking, draft 3.docx", size: 21000, uploaded_by: "u_alex", uploaded_at: rel(-14) }
    ];

    /* Deal Desk (Chase only): sales calls through to signed clients */
    var D = function (id, name, sub, stage, quote, next, last, src) { return { id: id, name: name, sub: sub, stage: stage, quote_cents: quote, next_step: next, last_contact: rel(last), source: src }; };
    db.deals = [
      D("d1", "Ava Thompson", "Cornell '28 · IB", "open", 650000, "Send proposal", -1, "Lecture"),
      D("d2", "Noah Patel", "Rutgers '27 · S&T", "open", 480000, "Parent call Thursday", -2, "DM"),
      D("d3", "Grace Liu", "BU '28 · IB", "open", null, "Strategy call Friday", 0, "VSL"),
      D("d4", "Lucas Moreno", "Texas '27 · PE", "quoted", 720000, "Follow up Monday", -4, "Lecture"),
      D("d5", "Isabella Wright", "Georgetown '28 · IB", "quoted", 650000, "Waiting on parents", -3, "VSL"),
      D("d6", "Ryan Cooper", "Penn State '27 · IB", "later", 540000, "Re-book in 3 days", -9, "DM"),
      D("d7", "Mia Robinson", "Tulane '28 · AM", "ghosted", 480000, "Gone cold", -21, "Lecture"),
      D("d8", "Hannah Cole", "Emory '28 · IB", "won", 650000, "Enrolled", -70, "Lecture"),
      D("d9", "Ethan Park", "Babson '27 · IB", "won", 650000, "Enrolled", -16, "VSL"),
      D("d10", "Chris Evans", "Purdue '27 · IB", "no_show", null, "No show", -12, "DM"),
      D("d11", "Zoe Martin", "UVA '28 · IB", "lost", 650000, "Chose another program", -15, "VSL")
    ];
    return db;
  }

  function programWeeks(db, pid) { var p = (db.programs || []).filter(function (x) { return x.id === pid; })[0]; return p ? p.duration_weeks : 0; }

  /* ------------------------------------------------------------------ persistence */
  var cache = null;
  function load() {
    if (cache) return cache;
    try { var raw = window.localStorage.getItem(KEY); if (raw) { var d = JSON.parse(raw); if (d && d.version === VERSION) { cache = d; return cache; } } } catch (e) {}
    cache = seed(); save(); return cache;
  }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {} }
  function reset() { cache = seed(); save(); return cache; }

  /* ------------------------------------------------------------------ helpers */
  var api = {
    load: load, save: save, reset: reset, uid: uid, iso: iso, rel: rel, DAY: DAY,
    profile: function (id) { return load().profiles.filter(function (p) { return p.id === id; })[0] || null; },
    profileByEmail: function (em) { em = String(em || "").trim().toLowerCase(); return load().profiles.filter(function (p) { return p.email.toLowerCase() === em; })[0] || null; },
    approved: function (em) { em = String(em || "").trim().toLowerCase(); return load().approved_emails.filter(function (a) { return a.email.toLowerCase() === em; })[0] || null; },
    isStaff: function (p) { return !!p && (p.role === "admin" || p.role === "coach"); },
    isAdmin: function (p) { return !!p && p.role === "admin"; },
    /* row security stand-in: which students can this viewer see? */
    visibleStudents: function (viewer, opts) {
      var db = load(); opts = opts || {};
      var all = db.profiles.filter(function (p) { return p.role === "student" && (opts.includeArchived || !p.archived); });
      if (!viewer) return [];
      if (viewer.role === "admin") return all;
      if (viewer.role === "coach") { var mine = db.coach_students.filter(function (l) { return l.coach_id === viewer.id; }).map(function (l) { return l.student_id; }); return all.filter(function (s) { return mine.indexOf(s.id) > -1; }); }
      if (viewer.role === "student") return all.filter(function (s) { return s.id === viewer.id; });
      return [];
    },
    canAccessStudent: function (viewer, sid) { return api.visibleStudents(viewer, { includeArchived: true }).some(function (s) { return s.id === sid; }); },
    enrollmentFor: function (sid) { var db = load(); return db.enrollments.filter(function (e) { return e.student_id === sid && (e.status === "active" || e.status === "completed"); }).sort(function (a, b) { return a.status === "active" ? -1 : 1; })[0] || null; },
    program: function (pid) { return load().programs.filter(function (p) { return p.id === pid; })[0] || null; },
    currentWeek: function (en) { if (!en) return null; var p = api.program(en.program_id); var w = Math.floor((Date.now() - new Date(en.start_date).getTime()) / (7 * DAY)) + 1; return Math.max(1, Math.min(p ? p.duration_weeks : 1, w)); },
    weeksMet: function (en) { return en ? load().checkins.filter(function (c) { return c.enrollment_id === en.id; }) : []; },
    tasksFor: function (en, week) { return en ? load().enrollment_tasks.filter(function (t) { return t.enrollment_id === en.id && (week == null || t.week_number === week); }).sort(function (a, b) { return a.week_number - b.week_number || (a.track === b.track ? a.sort_order - b.sort_order : a.track === "technical" ? -1 : 1); }) : []; },
    requiredModuleIds: function (sid) {
      var db = load(), en = api.enrollmentFor(sid);
      return db.module_required.filter(function (r) { return (!r.program_id && !r.student_id) || (r.student_id === sid) || (en && r.program_id === en.program_id); }).map(function (r) { return r.module_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    },
    moduleStatus: function (sid, mid) { var r = load().module_progress.filter(function (p) { return p.student_id === sid && p.module_id === mid; })[0]; return r ? r.status : "not_started"; },
    programWeeks: function (pid) { return programWeeks(load(), pid); },
    /* enroll_student(): copy the program template into the enrollment so later edits stay local.
       Moving onto a longer program keeps ticks and check-ins on the weeks that already exist. */
    enroll: function (sid, pid) {
      var db = load(), old = api.enrollmentFor(sid), eid = uid("e");
      var start = old ? old.start_date : iso(Date.now());
      db.enrollments = db.enrollments.filter(function (e) { return !(old && e.id === old.id); });
      db.enrollments.push({ id: eid, student_id: sid, program_id: pid, start_date: start, status: "active", sessions_purchased: programWeeks(db, pid) });
      var keepDone = old ? db.enrollment_tasks.filter(function (t) { return t.enrollment_id === old.id && t.completed; }).map(function (t) { return t.week_number + "|" + t.title; }) : [];
      db.program_weeks.filter(function (w) { return w.program_id === pid; }).forEach(function (w) {
        db.program_tasks.filter(function (t) { return t.program_week_id === w.id; }).forEach(function (t) {
          db.enrollment_tasks.push({ id: eid + "_" + t.id, enrollment_id: eid, week_number: w.week_number, title: t.title, description: t.description, track: t.track, sort_order: t.sort_order, completed: keepDone.indexOf(w.week_number + "|" + t.title) > -1 });
        });
      });
      if (old) {
        db.checkins.forEach(function (c) { if (c.enrollment_id === old.id) c.enrollment_id = eid; });
        db.enrollment_tasks = db.enrollment_tasks.filter(function (t) { return t.enrollment_id !== old.id; });
      }
      save();
      return eid;
    }
  };
  window.WSA_DB = api;
})();
