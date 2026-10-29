/* Wall Street Alpha — shared behaviour for every page (preview build).
   Sign-ins and lecture sign-ups are simulated in the browser. The application and CV forms are the live Youform embeds. */
(function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var url = function (p) { return new URL(p, document.baseURI).href; };
  var go = function (p) { window.location.href = url(p); };
  var params = new URLSearchParams(window.location.search);
  var page = document.body.getAttribute("data-page") || "";
  var basePath = new URL(document.baseURI).pathname;
  var here = (function () { var p = window.location.pathname; return p.indexOf(basePath) === 0 ? p.slice(basePath.length) : p.replace(/^\//, ""); })();
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()); };
  var firstName = function (n) { return String(n || "").trim().split(/\s+/)[0] || ""; };
  var initials = function (n, e) { var s = String(n || "").trim(); if (!s) s = String(e || "?").split("@")[0]; var p = s.split(/[\s._-]+/).filter(Boolean); return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase(); };

  /* storage: localStorage, falling back to a cookie, falling back to memory */
  var mem = {};
  var store = {
    get: function (k) {
      try { var v = window.localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) {}
      try { var m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)")); if (m) return JSON.parse(decodeURIComponent(m[1])); } catch (e) {}
      return mem[k] == null ? null : mem[k];
    },
    set: function (k, v) {
      mem[k] = v;
      try { window.localStorage.setItem(k, JSON.stringify(v)); return; } catch (e) {}
      try { document.cookie = k + "=" + encodeURIComponent(JSON.stringify(v)) + "; path=" + basePath + "; max-age=2592000; samesite=lax"; } catch (e) {}
    },
    del: function (k) {
      delete mem[k];
      try { window.localStorage.removeItem(k); } catch (e) {}
      try { document.cookie = k + "=; path=" + basePath + "; max-age=0"; } catch (e) {}
    }
  };

  /* Accounts live in the mock database (db.js): profiles carry the role, exactly like
     profiles.role in Supabase. admin (Chase), coach (assigned students only), student (an email
     Chase approved), member (free forum account, new in this build). */
  var DB = window.WSA_DB;
  var COACH_EMAIL = "chase@wallstalpha.com";
  var stored = store.get("wsa_session");
  var session = stored && stored.id && DB ? DB.profile(stored.id) : null;
  if (stored && !session) store.del("wsa_session");
  window.WSA_ME = session;
  function setSession(p) { store.set("wsa_session", { id: p.id }); session = p; window.WSA_ME = p; }
  function findAccount(em) { return DB ? DB.profileByEmail(em) : null; }
  function newProfile(fields) {
    var p = Object.assign({ id: DB.uid("u"), created_at: DB.iso(Date.now()), archived: false }, fields);
    DB.load().profiles.push(p); DB.save(); return p;
  }
  var isStaff = function (s) { return !!s && (s.role === "admin" || s.role === "coach"); };
  var isAdmin = function (s) { return !!s && s.role === "admin"; };
  /* Academy access (resources, job board, portal): staff and approved students. Members and visitors hit the paywall. */
  function hasAccess(s) { return isStaff(s) || (!!s && s.role === "student"); }
  function homeFor(s) { return !s ? "login" : isStaff(s) ? "coach" : s.role === "member" ? "membership" : (s.onboarded ? "dashboard" : "onboarding"); }
  function safeNext(n) { return n && /^[a-z0-9][a-z0-9/_-]*(\?[^#]*)?$/i.test(n) && n.indexOf("//") < 0 ? n : null; }

  /* toast */
  function toast(msg) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }
  window.wsaToast = toast;

  /* campaign tags: remembered from the landing page so the application still gets them */
  var utm = (function () {
    var fresh = {}, any = false;
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { var v = params.get(k); if (v) { fresh[k] = v.slice(0, 200); any = true; } });
    if (any) { store.set("wsa_utm", fresh); return fresh; }
    return store.get("wsa_utm") || {};
  })();

  /* ---------------- guards (run first) ---------------- */
  var need = document.body.getAttribute("data-require");
  var bounce = function (to) { window.WSA_REDIRECTING = true; go(to); };
  if (need === "student" || need === "staff" || need === "owner" || need === "academy" || need === "dealdesk") {
    if (!session) { bounce("login?next=" + encodeURIComponent(here + window.location.search)); return; }
    if (need === "academy" && !hasAccess(session)) { bounce("membership"); return; }
    if (need === "dealdesk" && !session.deal_desk) { bounce(isStaff(session) ? "coach?denied=1" : homeFor(session)); return; }
    if (need === "student" && isStaff(session)) { bounce("coach"); return; }
    if (need === "student" && session.role === "member") { bounce("membership"); return; }
    if (need === "student" && !session.onboarded && page !== "onboarding") { bounce("onboarding"); return; }
    if ((need === "staff" || need === "owner") && !isStaff(session)) { bounce(homeFor(session)); return; }
    if (need === "owner" && !isAdmin(session)) { bounce("coach?denied=1"); return; }
  }
  if (need === "webinar-admin" && !store.get("wsa_admin")) { bounce("webinar-data-login"); return; }

  /* ---------------- chrome: preview bar, header, menus ---------------- */
  var bar = $(".preview-bar");
  if (bar) {
    if (store.get("wsa_bar_hidden")) bar.hidden = true;
    var bb = $("button", bar); if (bb) bb.addEventListener("click", function () { bar.hidden = true; store.set("wsa_bar_hidden", true); });
  }
  $$("[data-when]").forEach(function (el) { el.hidden = (el.getAttribute("data-when") === "in") !== !!session; });
  $$("[data-access]").forEach(function (el) { el.hidden = (el.getAttribute("data-access") === "yes") !== hasAccess(session); });
  if (page === "membership" && params.get("welcome") === "1") $$("[data-welcome]").forEach(function (el) { el.hidden = false; });
  $$("[data-user-name]").forEach(function (el) { el.textContent = session ? (session.name || session.email) : ""; });
  $$("[data-user-first]").forEach(function (el) { el.textContent = session ? (firstName(session.name) || "there") : "there"; });
  $$("[data-user-email]").forEach(function (el) { el.textContent = session ? session.email : ""; });
  $$("[data-user-initials]").forEach(function (el) { el.textContent = session ? initials(session.name, session.email) : ""; });
  $$("[data-home-link]").forEach(function (a) { a.setAttribute("href", url(homeFor(session))); });
  $$("[data-logout]").forEach(function (b) { b.addEventListener("click", function () { store.del("wsa_session"); go("./"); }); });

  var menuBtn = $(".menu-btn"), panel = $("#mobile-panel");
  if (menuBtn && panel) {
    menuBtn.addEventListener("click", function () { var o = !panel.classList.contains("open"); panel.classList.toggle("open", o); menuBtn.setAttribute("aria-expanded", String(o)); });
  }
  $$(".usermenu").forEach(function (um) {
    var b = $("button", um), m = $(".menu", um);
    if (!b || !m) return;
    b.addEventListener("click", function (e) { e.stopPropagation(); m.hidden = !m.hidden; b.setAttribute("aria-expanded", String(!m.hidden)); });
    document.addEventListener("click", function (e) { if (!um.contains(e.target)) { m.hidden = true; b.setAttribute("aria-expanded", "false"); } });
  });

  /* role badge + owner-only items in the coach portal */
  $$("[data-role-label]").forEach(function (el) { el.textContent = isAdmin(session) ? "Admin" : isStaff(session) ? "Coach" : "Student"; });
  $$("[data-owner-only]").forEach(function (el) { if (!isAdmin(session)) el.hidden = true; });
  $$("[data-dealdesk-only]").forEach(function (el) { if (!session || !session.deal_desk) el.hidden = true; });
  $$("[data-reset-demo]").forEach(function (b) { b.addEventListener("click", function () { if (!confirm("Reset all demo data in this browser? Everything you added goes back to the starting sample.")) return; DB.reset(); if (session && !DB.profile(session.id)) store.del("wsa_session"); window.location.reload(); }); });
  if (params.get("denied") === "1") setTimeout(function () { toast("That screen is for admins. Coaches see their own students only."); }, 300);

  /* ---------------- redirects (old Lovable slugs) ---------------- */
  var redir = document.body.getAttribute("data-redirect");
  if (redir) { setTimeout(function () { go(redir + window.location.search); }, 400); }

  /* ---------------- shared data ---------------- */
  var dataEl = document.getElementById("wsa-data");
  var DATA = {};
  try { DATA = dataEl ? JSON.parse(dataEl.textContent) : {}; } catch (e) { DATA = {}; }

  var L = "assets/logos/wins/";
  var WINS = [
    ["Indiana", "indiana.png", "J.P. Morgan", "jpmorgan.png", "IB Summer Analyst", "NYC"],
    ["Northwestern", "northwestern.jpg", "Blackstone", "blackstone.jpg", "Private Equity Associate", "NYC"],
    ["Columbia", "columbia.png", "Goldman Sachs", "goldman-sachs.jpg", "IB Summer Analyst", "NYC"],
    ["Oregon", "oregon.png", "Blackstone", "blackstone.jpg", "Private Equity Summer Analyst", ""],
    ["UNC", "unc.png", "PJT Partners", "pjt.png", "IB Summer Analyst", "NYC"],
    ["Wharton", "wharton.png", "J.P. Morgan", "jpmorgan.png", "IB Summer Analyst", "NYC"],
    ["Oregon", "oregon.png", "Guggenheim", "guggenheim.png", "IB Summer Analyst", ""],
    ["Indiana", "indiana.png", "Bank of America", "bank-of-america.png", "IB Summer Analyst", "NYC"],
    ["UChicago", "uchicago.png", "GLC Advisors", "glc.png", "IB Summer Analyst", ""],
    ["Miami", "miami.png", "Solomon Partners", "solomon.png", "IB Summer Analyst", "NYC"],
    ["Miami (Ohio)", "miami-ohio.png", "Ares", "ares.png", "Private Credit Analyst", "NYC"],
    ["Emory", "emory.png", "Moelis", "moelis.png", "IB Analyst", "NYC"],
    ["Michigan", "michigan.png", "Moelis", "moelis.png", "IB Analyst", "NYC"],
    ["Wesleyan", "wesleyan.png", "Moelis", "moelis.png", "IB Analyst", "NYC"],
    ["Columbia", "columbia.png", "Citi", "citi.png", "IB Analyst", "NYC"],
    ["Babson", "babson.png", "PJT Partners", "pjt.png", "IB Analyst", "NYC"],
    ["NYU Stern", "nyu-stern.png", "Centerview", "centerview.png", "IB Analyst", "NYC"],
    ["New Hampshire", "unh.png", "Guggenheim", "guggenheim.png", "IB Analyst", "NYC"]
  ];
  /* full-bleed brand marks fill their tile; white-on-black wordmarks sit on black */
  var FILL = { "goldman-sachs.jpg": 1, "northwestern.jpg": 1 }, DARK = { "blackstone.jpg": 1 };
  var logo = function (file, name, cls, lazy) {
    var c = "lg" + (FILL[file] ? " lg--fill" : DARK[file] ? " lg--dark" : "") + (cls ? " " + cls : "");
    return '<img class="' + c + '" src="' + L + file + '" alt="' + esc(name) + ' logo" width="36" height="36"' + (lazy ? ' loading="lazy"' : "") + ">";
  };

  /* wins ticker: slow, steady, pausable on hover */
  $$("[data-belt]").forEach(function (belt) {
    var one = WINS.map(function (w) {
      return '<div class="win"><span class="win-logos">' + logo(w[1], w[0]) + logo(w[3], w[2]) + "</span>" +
        '<span class="win-text"><span class="win-line"><b>' + esc(w[0]) + '</b><span class="to" aria-label="to">→</span><b>' + esc(w[2]) + "</b></span>" +
        '<span class="win-role">' + esc(w[4]) + (w[5] ? " · " + esc(w[5]) : "") + "</span></span></div>";
    }).join("");
    belt.innerHTML = one + one.replace(/class="win"/g, 'class="win" aria-hidden="true"');
    var PX_PER_SEC = 26;
    var setSpeed = function () { var w = belt.scrollWidth / 2; if (w > 0) belt.style.animationDuration = Math.round(w / PX_PER_SEC) + "s"; };
    setSpeed();
    if (document.readyState === "complete") setTimeout(setSpeed, 300); else window.addEventListener("load", setSpeed);
  });

  /* wins grid */
  $$("[data-wins-grid]").forEach(function (g) {
    g.innerHTML = WINS.map(function (w) {
      return '<article class="wincard"><div class="from">' + logo(w[1], w[0], "", true) + "<span>" + esc(w[0]) + '</span></div>' +
        '<div class="to-firm">' + logo(w[3], w[2], "lg--lg", true) + "<b>" + esc(w[2]) + "</b></div>" +
        '<span class="role">' + esc(w[4]) + (w[5] ? " · " + esc(w[5]) : "") + "</span></article>";
    }).join("");
  });
  $$("[data-mini-wins]").forEach(function (g) {
    var n = parseInt(g.getAttribute("data-mini-wins"), 10) || 4;
    g.innerHTML = WINS.slice(0, n).map(function (w) {
      return "<div>" + logo(w[3], w[2]) + "<b>" + esc(w[2]) + "</b><span>" + esc(w[0]) + " · " + esc(w[4]) + "</span></div>";
    }).join("");
  });

  /* ---------------- community threads ---------------- */
  var THREADS = [
    { t: "Moelis first round last week: every question they asked", d: "IB", v: 214, c: 63, h: 2, f: "Student · Emory" },
    { t: "Sophomore at a non-target with zero connections. Where do I start?", d: "Students", v: 188, c: 97, h: 5, f: "Student · New Hampshire" },
    { t: "How do you say a DCF out loud without sounding memorized?", d: "IB", v: 151, c: 41, h: 9, f: "Student · Babson" },
    { t: "Private credit vs. IB as a first job: what I'd pick again", d: "Private Credit", v: 133, c: 58, h: 22, f: "Analyst · Private Credit" },
    { t: "Is it too late to recruit for Summer 2028?", d: "Students", v: 120, c: 74, h: 26, f: "Student · Oregon" },
    { t: "PE associate process at a megafund, start to finish", d: "PE", v: 117, c: 29, h: 40, f: "Associate · Private Equity" },
    { t: "My parents think finance is a bad bet. How did you talk to yours?", d: "Students", v: 96, c: 52, h: 30, f: "Student · Miami (Ohio)" },
    { t: "S&T superday at a bulge bracket: the 'pitch me a trade' question", d: "S&T", v: 76, c: 22, h: 60, f: "Analyst · Sales & Trading" },
    { t: "Stock pitch for a hedge fund interview: how long should it be?", d: "HF", v: 64, c: 18, h: 84, f: "Student · UChicago" },
    { t: "AM vs. ER if you like markets more than deals", d: "AM", v: 51, c: 30, h: 110, f: "Student · Michigan" },
    { t: "Lower middle market PE: what they actually test in the modeling test", d: "PE", v: 47, c: 15, h: 3, f: "Analyst · Investment Banking" },
    { t: "Unitranche vs. senior secured: explain it like I'm interviewing tomorrow", d: "Private Credit", v: 39, c: 11, h: 7, f: "Student · Columbia" }
  ];
  var ago = function (h) { return h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago"; };
  $$("[data-threads]").forEach(function (list) {
    var limit = parseInt(list.getAttribute("data-threads"), 10) || THREADS.length;
    var target = list.getAttribute("data-thread-link") || "community";
    var wrap = list.closest(".threads");
    var sort = "hot";
    var render = function () {
      var rows = THREADS.slice().sort(function (a, b) { return sort === "new" ? a.h - b.h : b.v - a.v; }).slice(0, limit);
      list.innerHTML = rows.map(function (x) {
        return '<li class="thread"><div class="votes"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5l8 11H4z"/></svg>' + x.v + "</div>" +
          '<div class="t-body"><a class="t-title" href="' + esc(target) + '">' + esc(x.t) + "</a>" +
          '<div class="t-meta"><span class="t-desk">' + esc(x.d) + '</span><span class="flair">' + esc(x.f) + "</span><span>" + x.c + " replies</span><span>" + ago(x.h) + "</span></div></div></li>";
      }).join("");
    };
    if (wrap) $$("[data-sort]", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        sort = b.getAttribute("data-sort");
        $$("[data-sort]", wrap).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        render();
      });
    });
    render();
  });

  /* ---------------- small interactions ---------------- */
  $$("[data-reveal]").forEach(function (b) {
    var t = document.getElementById(b.getAttribute("data-reveal"));
    if (!t) return;
    b.addEventListener("click", function () {
      t.hidden = !t.hidden;
      b.setAttribute("aria-expanded", String(!t.hidden));
      b.textContent = t.hidden ? (b.getAttribute("data-show") || "Show answer") : (b.getAttribute("data-hide") || "Hide answer");
    });
  });

  $$("[data-countdown]").forEach(function (el) {
    var end = new Date(el.getAttribute("data-countdown")).getTime();
    var parts = { d: $("[data-d]", el), h: $("[data-h]", el), m: $("[data-m]", el), s: $("[data-s]", el) };
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var tick = function () {
      var ms = Math.max(0, end - Date.now()), s = Math.floor(ms / 1000);
      if (parts.d) parts.d.textContent = pad(Math.floor(s / 86400));
      if (parts.h) parts.h.textContent = pad(Math.floor(s % 86400 / 3600));
      if (parts.m) parts.m.textContent = pad(Math.floor(s % 3600 / 60));
      if (parts.s) parts.s.textContent = pad(s % 60);
    };
    tick(); setInterval(tick, 1000);
  });

  $$("[data-rotator]").forEach(function (r) {
    var items = $$("span", r); if (items.length < 2) return;
    var i = 0; items[0].classList.add("on");
    if (reduced) return;
    setInterval(function () { items[i].classList.remove("on"); i = (i + 1) % items.length; items[i].classList.add("on"); }, 1900);
  });

  /* ---------------- resources library ---------------- */
  /* one card markup for the library, the portal Resources tab and "More in" (build.py res_card) */
  var lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var resCard = function (r) {
    var lock = hasAccess(session) ? "" : '<span class="res-lock" title="WSA Academy">' + lockSvg + "Academy</span>";
    return '<a class="res" href="https://wallstalpha.com/login"><span class="res-thumb"><img src="' + esc(r.thumb) + '" alt="" loading="lazy" width="480" height="621">' + lock + "</span>" +
      '<div class="res-body"><h3>' + esc(r.title) + "</h3><p>" + esc(r.desc) + '</p><span class="res-meta">' + r.pages + (r.pages === 1 ? " page" : " pages") + " · PDF</span></div></a>";
  };
  window.WSA_resCard = resCard;

  $$("[data-resources]").forEach(function (root) {
    var hidden = DB && !isStaff(session) ? DB.load().resources_hidden : [];
    var items = (DATA.resources || []).filter(function (r) { return hidden.indexOf(r.slug) < 0; });
    var cats = DATA.cats || [];
    var groups = $("[data-res-groups]", root), q = $("[data-res-search]", root);
    var cat = "All";
    var group = function (title, rows, note) {
      return '<section class="res-group"><div class="res-group-head"><h2>' + esc(title) + "</h2><span>" + (note || rows.length + (rows.length === 1 ? " guide" : " guides")) + '</span></div><div class="res-grid">' + rows.map(resCard).join("") + "</div></section>";
    };
    var render = function () {
      var term = (q && q.value || "").trim().toLowerCase();
      var match = function (r) { return !term || (r.title + " " + r.desc + " " + r.cat).toLowerCase().indexOf(term) > -1; };
      if (term) {
        var hits = items.filter(function (r) { return (cat === "All" || r.cat === cat) && match(r); });
        groups.innerHTML = hits.length ? group("Results for \u201c" + q.value.trim() + "\u201d", hits)
          : '<div class="empty-state">No guides match that search. Try a broader word, like "networking" or "resume".</div>';
        return;
      }
      groups.innerHTML = cats.filter(function (c) { return cat === "All" || c === cat; }).map(function (c) {
        var rows = items.filter(function (r) { return r.cat === c; });
        return rows.length ? group(c, rows) : "";
      }).join("");
    };
    $$("[data-cat]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        cat = b.getAttribute("data-cat");
        $$("[data-cat]", root).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        render();
      });
    });
    if (q) q.addEventListener("input", render);
    render();
  });

  /* ---------------- course library (video courses, listed on the Resources page) ---------------- */
  $$("[data-courses]").forEach(function (root) {
    var courses = DATA.courses || [], topics = DATA.course_topics || [];
    var groups = $("[data-course-groups]", root), q = $("[data-course-search]", root), chips = $("[data-course-chips]", root), stats = $("[data-course-stats]", root);
    var topic = "All";
    var num = function (n) { return n.toLocaleString("en-US"); };
    var dur = function (m) { return Math.floor(m / 60) + "h " + (m % 60) + "m"; };
    var sum = function (key) { return courses.reduce(function (s, c) { return s + (+c[key] || 0); }, 0); };
    if (stats) {
      stats.innerHTML = [[num(courses.length), "Video courses"], [num(Math.round(sum("mins") / 60)), "Hours of video"], [num(sum("lessons")), "Lessons"], [num(sum("exam")), "Course exams"]]
        .map(function (s) { return '<div class="stat"><span class="label">' + s[1] + "</span><b>" + s[0] + "</b></div>"; }).join("");
    }
    if (chips) {
      chips.innerHTML = ["All"].concat(topics).map(function (t) {
        return '<button class="chip" type="button" data-ctopic="' + esc(t) + '" aria-pressed="' + (t === "All") + '">' + esc(t) + "</button>";
      }).join("");
    }
    var lock = hasAccess(session) ? "" : '<span class="course-lock" role="img" aria-label="Locked: WSA Academy students only" title="WSA Academy">' + lockSvg + "</span>";
    var row = function (c) {
      return '<li class="course">' + lock + '<div class="course-body"><h3>' + esc(c.title) + '</h3><span class="course-meta">' + dur(c.mins) + " · " + c.lessons + " lessons</span></div>" +
        (c.exam ? '<span class="pill pill--info">Exam</span>' : "") + "</li>";
    };
    var group = function (title, rows) {
      return '<section class="res-group"><div class="res-group-head"><h2>' + esc(title) + "</h2><span>" + rows.length + (rows.length === 1 ? " course" : " courses") + '</span></div><ul class="course-list">' + rows.map(row).join("") + "</ul></section>";
    };
    var render = function () {
      var term = (q && q.value || "").trim().toLowerCase();
      if (term) {
        var hits = courses.filter(function (c) { return (topic === "All" || c.topic === topic) && (c.title + " " + c.topic).toLowerCase().indexOf(term) > -1; });
        groups.innerHTML = hits.length ? group("Results for “" + q.value.trim() + "”", hits)
          : '<div class="empty-state">No courses match that search. Try a broader word, like "modeling" or "Excel".</div>';
        return;
      }
      groups.innerHTML = topics.filter(function (t) { return topic === "All" || t === topic; }).map(function (t) {
        var rows = courses.filter(function (c) { return c.topic === t; });
        return rows.length ? group(t, rows) : "";
      }).join("");
    };
    $$("[data-ctopic]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        topic = b.getAttribute("data-ctopic");
        $$("[data-ctopic]", root).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        render();
      });
    });
    if (q) q.addEventListener("input", render);
    render();
  });

  /* guide page: load the PDF viewer for Academy members only */
  $$(".pdf-view iframe[data-src]").forEach(function (f) {
    if (hasAccess(session)) f.src = f.getAttribute("data-src");
  });

  /* ---------------- job board ---------------- */
  $$("[data-jobs]").forEach(function (root) {
    var jobs = DATA.jobs || [];
    var state = { type: "all", vert: "all", q: "" };
    var body = $("[data-jobs-body]", root), countEl = $("[data-jobs-count]", root), search = $("[data-jobs-search]", root);
    var typeLabel = { full_time: "Full-time", internship: "Internship", program: "Insight & programs" };
    var counts = function (key, val) { return jobs.filter(function (j) { return (key === "type" ? (val === "all" || j.type === val) && (state.vert === "all" || j.vert === state.vert) : (state.type === "all" || j.type === state.type) && (val === "all" || j.vert === val)); }).length; };
    var render = function () {
      var term = state.q.trim().toLowerCase();
      var rows = jobs.filter(function (j) {
        return (state.type === "all" || j.type === state.type) && (state.vert === "all" || j.vert === state.vert) &&
          (!term || (j.title + " " + j.firm + " " + j.loc).toLowerCase().indexOf(term) > -1);
      });
      body.innerHTML = rows.length ? rows.map(function (j) {
        var mark = j.firm.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
        return '<tr><td><a class="job-cell" href="' + esc(j.url) + '" target="_blank" rel="noopener"><span class="firm-mark">' + esc(mark) + '</span><span><span class="strong">' + esc(j.title) + '</span><span class="sub-line">' + esc(j.firm) + " · " + esc(j.loc) + "</span></span></a></td>" +
          "<td>" + esc(j.vert) + '</td><td><span class="pill ' + (j.type === "internship" ? "pill--info" : j.type === "program" ? "pill--warn" : "pill--plain") + '">' + esc(typeLabel[j.type]) + '</span></td><td class="faint num" style="white-space:nowrap">' + esc(j.posted) + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="empty">No openings match. Clear the search or pick another filter.</td></tr>';
      if (countEl) countEl.textContent = rows.length + " of " + jobs.length + " openings";
      $$("[data-type]", root).forEach(function (b) { var v = b.getAttribute("data-type"); b.setAttribute("aria-pressed", String(v === state.type)); var c = $("span", b); if (c) c.textContent = counts("type", v); });
      $$("[data-vert]", root).forEach(function (b) { var v = b.getAttribute("data-vert"); b.setAttribute("aria-pressed", String(v === state.vert)); var c = $("span", b); if (c) c.textContent = counts("vert", v); });
    };
    $$("[data-type]", root).forEach(function (b) { b.addEventListener("click", function () { state.type = b.getAttribute("data-type"); render(); }); });
    $$("[data-vert]", root).forEach(function (b) { b.addEventListener("click", function () { state.vert = b.getAttribute("data-vert"); render(); }); });
    if (search) search.addEventListener("input", function () { state.q = search.value; render(); });
    var reset = $("[data-jobs-reset]", root);
    if (reset) reset.addEventListener("click", function () { state = { type: "all", vert: "all", q: "" }; if (search) search.value = ""; render(); });
    render();
  });

  /* ---------------- forms: shared ---------------- */
  function say(el, msg, kind) { if (!el) return; el.textContent = msg; el.className = "status" + (kind ? " status--" + kind : ""); el.hidden = !msg; }
  function busy(btn, on, label) { if (!btn) return; if (on) { btn._t = btn.innerHTML; btn.disabled = true; btn.textContent = label || "Working…"; } else { btn.disabled = false; if (btn._t) btn.innerHTML = btn._t; } }

  /* ---------------- Youform embeds (/apply, /applydm, /booked) ----------------
     The live forms, loaded like the Lovable site does: campaign tags go in as hidden fields,
     so Youform's webhooks, the Zaps and the Calendly step are exactly as they are today. */
  var embeds = $$("[data-youform-embed]");
  if (embeds.length) {
    var tags = new URLSearchParams();
    Object.keys(utm).forEach(function (k) { tags.set(k, utm[k]); });
    embeds.forEach(function (el) { el.setAttribute("data-params", tags.toString()); });
    var yf = document.createElement("script");
    yf.src = "https://app.youform.com/embed.js"; yf.async = true;
    yf.addEventListener("load", function () { if (window.YouformEmbed && window.YouformEmbed.init) window.YouformEmbed.init(); });
    document.body.appendChild(yf);
  }

  /* ---------------- lecture registration (/webinar123) ---------------- */
  $$("[data-webinar-form]").forEach(function (form) {
    var err = $("[data-reg-error]", form), parentBox = $("[data-parent-fields]", form);
    $$("input[name=parent]", form).forEach(function (r) {
      r.addEventListener("change", function () { parentBox.hidden = !(form.querySelector("input[name=parent]:checked").value !== "no_invite"); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { return ($("#" + id, form) || {}).value ? $("#" + id, form).value.trim() : ""; };
      if (!v("rg-first") || !v("rg-email")) { say(err, "Please fill in your name and email.", "error"); return; }
      if (!emailOk(v("rg-email"))) { say(err, "Please check your email address.", "error"); return; }
      var ph = v("rg-phone").replace(/\D/g, "");
      if (ph && ph.length < 7) { say(err, "Please enter a phone number with the correct country code.", "error"); return; }
      var po = (form.querySelector("input[name=parent]:checked") || {}).value || "no_invite";
      if (po !== "no_invite" && (!v("rg-pfirst") || !emailOk(v("rg-pemail")))) { say(err, "Please add your parent or guardian's name and email.", "error"); return; }
      var rid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      store.set("wsa_registration", { rid: rid, first: v("rg-first"), last: v("rg-last"), email: v("rg-email"), parent: po, parentFirst: v("rg-pfirst") });
      busy($("button[type=submit]", form), true, "Reserving…");
      setTimeout(function () { go("webinar-registered?rid=" + rid); }, 700);
    });
  });
  $$("[data-ticket]").forEach(function () {
    var reg = store.get("wsa_registration");
    var name = reg ? [reg.first, reg.last].filter(Boolean).join(" ") : "";
    $$("[data-reg-name]").forEach(function (el) { el.textContent = name || "Your name"; });
    $$("[data-reg-first]").forEach(function (el) { el.textContent = reg && reg.first ? reg.first : "you"; });
    var pt = $("[data-parent-ticket]");
    if (pt && reg && reg.parent && reg.parent !== "no_invite") { pt.hidden = false; $$("[data-parent-name]").forEach(function (el) { el.textContent = reg.parentFirst || "your parent"; }); }
    $$("[data-step-done]").forEach(function (b) {
      b.addEventListener("click", function () { var c = b.closest(".stepcard"); if (c) c.classList.add("done"); });
    });
  });

  /* ---------------- webinar replay (replay.html) ---------------- */
  if (page === "replay") {
    /* booking links carry what the email link came with, so the application opens pre-filled */
    var carry = new URLSearchParams();
    ["name", "first_name", "last_name", "email", "phone", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(function (k) {
      var v = params.get(k); if (v) carry.set(k, v.slice(0, 200));
    });
    if (String(carry)) $$("[data-book]").forEach(function (a) { a.setAttribute("href", a.getAttribute("href").split("?")[0] + "?" + carry); });

    /* sharing sends the bare replay link, never the viewer's own details */
    var shareUrl = window.location.href.split(/[?#]/)[0];
    var shareText = "Watch Chase Enloe's Placement Playbook replay: how students break into investment banking and private equity without a target school or connections.";
    $$("[data-share]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (navigator.share) { navigator.share({ title: "Chase's Placement Playbook: replay", text: shareText, url: shareUrl }).catch(function () {}); return; }
        var ask = function () { window.prompt("Copy this link to share the replay:", shareUrl); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareUrl).then(function () { toast("Link copied. Send it to a parent or guardian."); }, ask);
        else ask();
      });
    });
    $$("[data-share-mail]").forEach(function (a) {
      a.setAttribute("href", "mailto:?subject=" + encodeURIComponent("Watch this with me: Chase's Placement Playbook") + "&body=" + encodeURIComponent(shareText + "\n\n" + shareUrl));
    });

    /* this cohort's dates: blocks disappear once their date has passed, finished milestones dim */
    var nowMs = Date.now();
    $$("[data-until]").forEach(function (el) { if (nowMs > Date.parse(el.getAttribute("data-until"))) el.hidden = true; });
    $$("[data-date]").forEach(function (el) { el.classList.toggle("is-past", nowMs > Date.parse(el.getAttribute("data-date"))); });

    /* the booking bar slides in once the video has scrolled away, and steps aside for the closing band */
    var dock = $("[data-dock]"), player = $("[data-player]"), closing = $(".closing");
    if (dock && player && "IntersectionObserver" in window) {
      var past = false, atEnd = false;
      var setDock = function () {
        var on = past && !atEnd;
        dock.classList.toggle("on", on);
        dock.setAttribute("aria-hidden", String(!on));
        $$("a", dock).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
      };
      new IntersectionObserver(function (es) { past = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; setDock(); }).observe(player);
      if (closing) new IntersectionObserver(function (es) { atEnd = es[0].isIntersecting; setDock(); }).observe(closing);
    }

    /* if Wistia can't load (blocked or offline), offer the video in a new tab */
    setTimeout(function () {
      if (!(window.customElements && customElements.get("wistia-player"))) $$("[data-video-alt]").forEach(function (el) { el.hidden = false; });
    }, 6000);
  }

  /* ---------------- technicals guide opt-in ---------------- */
  $$("[data-guide-form]").forEach(function (form) {
    var err = $("[data-guide-error]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = $("#tg-name", form).value.trim(), em = $("#tg-email", form).value.trim();
      if (!n) { say(err, "Add your name so we know who to send it to.", "error"); return; }
      if (!emailOk(em)) { say(err, "Enter a valid email address, like you@university.edu.", "error"); return; }
      store.set("wsa_guide", { name: n, email: em });
      busy($("button[type=submit]", form), true, "Sending…");
      setTimeout(function () { go("technicalguide/sent"); }, 600);
    });
  });
  $$("[data-guide-email]").forEach(function (el) { var g = store.get("wsa_guide"); el.textContent = g && g.email ? g.email : "your inbox"; });

  /* ---------------- sign in (/login) ---------------- */
  $$("[data-login]").forEach(function (form) {
    if (session) { go(safeNext(params.get("next")) || homeFor(session)); return; }
    var mode = "password";
    var err = $("[data-login-error]", form), sent = $("[data-login-sent]"), pw = $("[data-pw-field]", form), title = $("[data-login-title]"), sub = $("[data-login-sub]"), submit = $("button[type=submit]", form);
    var setMode = function (m) {
      mode = m; say(err, "");
      pw.hidden = m !== "password";
      $$("[data-mode-link]").forEach(function (a) { a.hidden = a.getAttribute("data-mode-link") === m; });
      title.textContent = m === "forgot" ? "Reset your password" : m === "link" ? "Sign in with a link" : "Welcome back";
      sub.textContent = m === "forgot" ? "We'll email you a link to set a new password." : m === "link" ? "We'll email you a secure link. No password needed." : "Sign in to your Wall Street Alpha account.";
      submit.textContent = m === "forgot" ? "Email me a reset link" : m === "link" ? "Email me a sign-in link" : "Sign in";
    };
    $$("[data-mode-link]").forEach(function (a) { a.addEventListener("click", function () { setMode(a.getAttribute("data-mode-link")); }); });
    if (params.get("mode")) setMode(params.get("mode"));
    var nextQ = safeNext(params.get("next")) ? "&next=" + encodeURIComponent(params.get("next")) : "";
    if (nextQ) $$("a[href='join']").forEach(function (a) { a.setAttribute("href", url("join?next=" + encodeURIComponent(params.get("next")))); });
    $$("[data-google]").forEach(function (b) { b.addEventListener("click", function () { go("auth/callback?provider=google" + nextQ); }); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = $("#li-email", form).value.trim();
      if (!emailOk(em)) { say(err, "Enter the email you signed up with.", "error"); return; }
      if (mode === "password") {
        if (!$("#li-pass", form).value) { say(err, "Enter your password, or choose “Email me a sign-in link instead”.", "error"); return; }
        var acct = findAccount(em);
        if (!acct) { say(err, "Invalid login credentials. Check the email, or create an account.", "error"); return; }
        busy(submit, true, "Signing in…");
        setSession(acct);
        setTimeout(function () { go(safeNext(params.get("next")) || homeFor(acct)); }, 500);
        return;
      }
      form.hidden = true; sent.hidden = false;
      $("[data-sent-email]", sent).textContent = em;
      $("[data-sent-what]", sent).textContent = mode === "forgot" ? "a password link" : "a sign-in link";
      $("[data-sent-open]", sent).setAttribute("href", url(mode === "forgot" ? "reset-password?email=" + encodeURIComponent(em) : "auth/callback?email=" + encodeURIComponent(em) + nextQ));
    });
    $$("[data-sent-back]").forEach(function (b) { b.addEventListener("click", function () { sent.hidden = true; form.hidden = false; }); });
    $$("[data-demo]").forEach(function (b) {
      b.addEventListener("click", function () { setMode("password"); $("#li-email", form).value = b.getAttribute("data-demo"); $("#li-pass", form).value = "preview-password"; form.requestSubmit ? form.requestSubmit() : form.querySelector("button[type=submit]").click(); });
    });
  });

  /* create account (/join) */
  $$("[data-join]").forEach(function (form) {
    var err = $("[data-join-error]", form);
    var jn = safeNext(params.get("next"));
    if (jn) $$("a[href='login']").forEach(function (a) { a.setAttribute("href", url("login?next=" + encodeURIComponent(jn))); });
    $$("[data-google]").forEach(function (b) { b.addEventListener("click", function () { go("auth/callback?provider=google&new=1" + (jn ? "&next=" + encodeURIComponent(jn) : "")); }); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = $("#jn-name", form).value.trim(), em = $("#jn-email", form).value.trim(), pw = $("#jn-pass", form).value;
      if (!n) { say(err, "Add your full name.", "error"); return; }
      if (!emailOk(em)) { say(err, "Enter a valid email address, like you@university.edu.", "error"); return; }
      if (pw.length < 8) { say(err, "Use a password with at least 8 characters.", "error"); return; }
      if (findAccount(em)) { say(err, "An account with this email already exists. Log in instead.", "error"); return; }
      /* is_email_approved(): only emails Chase approved become students or coaches. Everyone else is a forum member. */
      var ap = DB.approved(em);
      if (!ap && form.getAttribute("data-free") === "0") { say(err, "That email isn't on the approved list. Use the email your mentor approved, or apply to the Academy first.", "error"); return; }
      var acct = newProfile({ email: em.toLowerCase(), full_name: n, role: ap ? ap.role : "member", school: $("#jn-school", form).value.trim(), class_year: $("#jn-year", form).value, onboarded: !(ap && ap.role === "student") });
      if (ap && ap.role === "student" && ap.program_id) DB.enroll(acct.id, ap.program_id);
      setSession(acct);
      busy($("button[type=submit]", form), true, "Creating your account…");
      var approved = !!ap;
      setTimeout(function () { go(acct.role === "coach" ? "coach" : approved ? "onboarding" : (safeNext(params.get("next")) || "membership?welcome=1")); }, 600);
    });
  });

  /* magic link / Google landing (/auth/callback) */
  if (page === "auth-callback") {
    var google = params.get("provider") === "google";
    var em = params.get("email") || (google ? "student@wallstalpha.com" : "");
    var msg = $("[data-callback-msg]");
    setTimeout(function () {
      var acct = findAccount(em);
      if (!acct && google && params.get("new") === "1") acct = findAccount("google.member@gmail.com") || newProfile({ email: "google.member@gmail.com", full_name: "Google Member", role: "member", onboarded: true });
      if (!acct) { msg.textContent = "Sign-in link didn't work"; $("[data-callback-fail]").hidden = false; $(".spinner").hidden = true; return; }
      setSession(acct);
      go(safeNext(params.get("next")) || homeFor(acct));
    }, 1300);
  }

  /* set a new password (/reset-password) */
  $$("[data-reset]").forEach(function (form) {
    var err = $("[data-reset-error]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var a = $("#rp-new", form).value, b = $("#rp-confirm", form).value;
      if (a.length < 8) { say(err, "Use at least 8 characters.", "error"); return; }
      if (a !== b) { say(err, "The two passwords don't match.", "error"); return; }
      var s = findAccount(params.get("email") || (session && session.email));
      if (!s) { say(err, "This reset link has expired. Request a new one from the sign-in page.", "error"); return; }
      setSession(s);
      say(err, "Password updated. Taking you to your dashboard…", "ok");
      setTimeout(function () { go(homeFor(s)); }, 900);
    });
  });

  /* Google Calendar connect (/google-oauth) */
  if (page === "google-oauth") {
    setTimeout(function () { var d = DB.load(); d.calendar = { connected: true, email: (session && session.email) || COACH_EMAIL, synced_at: "just now" }; DB.save(); go("coach/calendar?connected=1"); }, 1400);
  }
  if (params.get("connected") === "1") toast("Google Calendar connected");

  /* onboarding */
  $$("[data-onboarding]").forEach(function (form) {
    var p = session || {};
    var setv = function (id, v) { var el = $("#" + id, form); if (el && v != null && !el.value) el.value = v; };
    setv("ob-name", p.full_name); setv("ob-school", p.school); setv("ob-gpa", p.gpa); setv("ob-linkedin", p.linkedin_url); setv("ob-tracker", p.tracker_url);
    if (p.target_role) $("#ob-role", form).value = p.target_role;
    if (p.secondary_role) $("#ob-role2", form).value = p.secondary_role;
    var err = $("[data-ob-error]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#ob-name", form).value.trim(), school = $("#ob-school", form).value.trim(), gpa = parseFloat($("#ob-gpa", form).value), li = $("#ob-linkedin", form).value.trim(), role = $("#ob-role", form).value, tracker = $("#ob-tracker", form).value.trim();
      if (!name || !school) { say(err, "Add your full name and school.", "error"); return; }
      if (isNaN(gpa) || gpa < 0 || gpa > 4.33) { say(err, "Enter your GPA on a 4.0 scale, for example 3.75.", "error"); return; }
      if (!/linkedin\.com\//i.test(li)) { say(err, "Add your LinkedIn profile link. It should contain linkedin.com/in/.", "error"); return; }
      if (tracker && !/docs\.google\.com\/spreadsheets/i.test(tracker)) { say(err, "The tracker link should be a Google Sheet (docs.google.com/spreadsheets/…).", "error"); return; }
      if (!role) { say(err, "Choose the role you're targeting first.", "error"); return; }
      var row = DB.profile(session.id);
      var fileName = function (id) { var f = $("#" + id, form); return f && f.files && f.files[0] ? f.files[0].name : null; };
      Object.assign(row, { full_name: name, school: school, gpa: gpa, linkedin_url: li, tracker_url: tracker || null, target_role: role, secondary_role: $("#ob-role2", form).value || null, onboarded: true,
        headshot_name: fileName("ob-photo") || row.headshot_name || null, resume_name: fileName("ob-cv") || row.resume_name || null });
      var net = fileName("ob-net");
      if (net) DB.load().files.unshift({ id: DB.uid("f"), student_id: row.id, name: net, size: 40000, uploaded_by: row.id, uploaded_at: DB.iso(Date.now()) });
      DB.save(); setSession(row);
      busy($("button[type=submit]", form), true, "Saving…");
      setTimeout(function () { go("dashboard"); }, 500);
    });
  });

  /* admin sign-in for lecture reporting */
  $$("[data-admin-login]").forEach(function (form) {
    var err = $("[data-admin-error]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = $("#ad-email", form).value.trim();
      if (!emailOk(em) || !$("#ad-pass", form).value) { say(err, "Enter your admin email and password.", "error"); return; }
      store.set("wsa_admin", { email: em });
      go("webinar-data");
    });
  });
  $$("[data-admin-logout]").forEach(function (b) { b.addEventListener("click", function () { store.del("wsa_admin"); go("webinar-data-login"); }); });

  /* app: contacts import, module status, coach actions */
  $$("[data-import]").forEach(function (inp) {
    inp.addEventListener("change", function () {
      if (!inp.files || !inp.files.length) return;
      var n = inp.files[0].name;
      var out = $("[data-import-result]");
      if (out) { out.hidden = false; out.textContent = "Read " + n + ". In the live portal this shows a preview of each row (will import, already have, no name) before anything is saved."; }
    });
  });
  $$("[data-cycle]").forEach(function (b) {
    var states = [["Not started", "pill--plain"], ["In progress", "pill--warn"], ["Complete", "pill--gain"]];
    b.addEventListener("click", function () {
      var i = (parseInt(b.getAttribute("data-cycle"), 10) + 1) % states.length;
      b.setAttribute("data-cycle", i); b.className = "pill " + states[i][1]; b.textContent = states[i][0];
    });
  });
  $$("[data-act]").forEach(function (b) { b.addEventListener("click", function () { toast(b.getAttribute("data-act")); var r = b.closest("li"); if (r && b.hasAttribute("data-clears")) r.style.opacity = ".45"; }); });
  $$("[data-greeting]").forEach(function (el) { var h = new Date().getHours(); el.textContent = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; });
  $$("[data-today]").forEach(function (el) { el.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()); });
})();
