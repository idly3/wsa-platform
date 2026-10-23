/* Wall Street Alpha — post-webinar application (apply-webinar.html).
   Youform-style: one question at a time, letter keys pick an answer, Enter moves on. Answers go to the
   Zapier webhook as a flat form post, with the same fields every time:
     partial   once we have contact details, then again after a pause or when the tab is hidden
     complete  when the last question is answered and the Calendly step opens
     booked    when Calendly confirms the booking
   Calendly is pre-filled with the name, email and phone from the form, and a parent or student who is
   joining the call goes on the invite as a guest. Progress is kept in this browser, so a refresh picks
   up where it left off. Open the page with ?test=1 for a panel that sends test payloads; every post
   from a test session carries is_test=yes. */
(function () {
  "use strict";

  /* ---------------- settings ---------------- */
  var WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/28895668/41vnkwy/";
  var CALENDLY_URL = "https://calendly.com/d/dthy-t7r-368/wsa-interview-webinar";
  /* Calendly fields that get the phone number: "location" when the event's location is a phone call,
     "a1" to "a10" for the event's invitee questions, in order. Remove any that don't match the event. */
  var CALENDLY_PHONE_FIELDS = ["location", "a1"];
  var PAUSE_MS = 30000;                     // a partial goes out after this long without a new answer
  var KEY = "wsa_apply_webinar";            // progress in this browser
  var FORGET_AFTER_MS = 14 * 864e5;         // start fresh after two weeks
  var FORM_NAME = "apply-webinar";

  /* ---------------- helpers ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = $("[data-aw]"), form = $("[data-aw-form]");
  if (!root || !form) return;
  var params = new URLSearchParams(window.location.search);
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()); };
  var digits = function (v) { return String(v || "").replace(/\D/g, ""); };
  var now = function () { return new Date().toISOString(); };
  var uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "aw-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  };
  var hash = function (s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
  var store = {
    get: function (k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  };
  var bull = function (detail) { try { window.dispatchEvent(new CustomEvent("wsa:bull", { detail: detail })); } catch (e) {} };

  /* ---------------- steps ---------------- */
  var steps = $$("[data-step]", form);
  var ids = steps.map(function (s) { return s.getAttribute("data-step"); });
  var questions = steps.filter(function (s) { return s.hasAttribute("data-q"); });
  var TOTAL = questions.length;
  var stepEl = function (id) { return form.querySelector('[data-step="' + id + '"]'); };
  var qIndex = function (id) { return questions.indexOf(stepEl(id)); };

  /* phone country codes: one list in the page, copied to every picker; the default follows the time zone */
  var DIAL = { US: "1", CA: "1", GB: "44", IN: "91", CN: "86", HK: "852", SG: "65", AU: "61", AE: "971", IE: "353", DE: "49", FR: "33", KR: "82", JP: "81", NG: "234", BR: "55", MX: "52" };
  var ccLists = $$("select[data-cc]", form);
  ccLists.slice(1).forEach(function (s) { s.innerHTML = ccLists[0].innerHTML; });
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var homeCc = (function () {
    var m = [[/London/, "GB"], [/Dublin/, "IE"], [/Kolkata|Calcutta/, "IN"], [/Shanghai|Chongqing|Urumqi/, "CN"], [/Hong_Kong/, "HK"], [/Singapore/, "SG"],
      [/^Australia\//, "AU"], [/Dubai/, "AE"], [/Berlin/, "DE"], [/Paris/, "FR"], [/Seoul/, "KR"], [/Tokyo/, "JP"], [/Lagos/, "NG"], [/Sao_Paulo/, "BR"], [/Mexico_City/, "MX"],
      [/Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns/, "CA"]];
    for (var i = 0; i < m.length; i++) if (m[i][0].test(tz)) return m[i][1];
    return "US";
  })();
  /* the country of a number written with its +code (a shared code like +1 keeps the local guess) */
  var fromIntl = function (raw) {
    var d = digits(raw), best = "";
    Object.keys(DIAL).forEach(function (cc) {
      var code = DIAL[cc];
      if (d.indexOf(code) === 0 && (!best || code.length > DIAL[best].length || (code === DIAL[best] && cc === homeCc))) best = cc;
    });
    return best ? { cc: best, num: d.slice(DIAL[best].length) } : null;
  };
  /* +E.164 from a country and a number; a number typed with its own + wins */
  var e164 = function (cc, num) {
    var raw = String(num || "").trim(), d = digits(raw);
    if (!d) return "";
    if (raw.charAt(0) === "+") return "+" + d;
    var code = DIAL[cc] || "1";
    if (code !== "1") d = d.replace(/^0+/, "");
    else if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return "+" + code + d;
  };

  /* ---------------- state (kept in this browser) ---------------- */
  var blank = function () { return { id: uid(), started_at: now(), updated_at: now(), step: "welcome", reached: 0, answers: {}, status: "", sent: {}, track: {} }; };
  var saved = store.get(KEY);
  var resumed = !!(saved && saved.id && params.get("new") !== "1" && Date.now() - Date.parse(saved.updated_at || 0) < FORGET_AFTER_MS);
  var state = resumed ? saved : blank();
  state.sent = state.sent || {}; state.track = state.track || {}; state.answers = state.answers || {};
  if (params.get("test") === "1") state.test = true;
  var save = function () { state.updated_at = now(); store.set(KEY, state); };

  /* where they came from: campaign tags from this link, else the ones site.js remembered from an earlier page */
  (function () {
    var t = state.track, any = false, keep = store.get("wsa_utm") || {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(function (k) {
      var v = params.get(k); if (v) { t[k] = v.slice(0, 300); any = true; }
    });
    if (!any) ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { if (!t[k] && keep[k]) t[k] = keep[k]; });
    if (!t.page_url) t.page_url = window.location.href.split("#")[0];
    if (!t.referrer) t.referrer = document.referrer || "";
  })();

  /* ---------------- reading and writing answers ---------------- */
  var fields = function () { return $$("input[name], select[name], textarea[name]", form).filter(function (el) { return el.name !== "company_website"; }); };
  function read() {
    var a = {};
    fields().forEach(function (el) {
      if (el.type === "radio") { if (el.checked) a[el.name] = el.value; else if (!(el.name in a)) a[el.name] = ""; }
      else if (el.type === "checkbox") { a[el.name] = a[el.name] || []; if (el.checked) a[el.name].push(el.value); }
      else a[el.name] = el.value.trim();
    });
    return a;
  }
  function write(a) {
    fields().forEach(function (el) {
      if (!(el.name in a)) return;
      var v = a[el.name];
      if (el.type === "radio") el.checked = el.value === v;
      else if (el.type === "checkbox") el.checked = Array.isArray(v) && v.indexOf(el.value) >= 0;
      else if (v != null) el.value = v;
    });
  }
  /* the words on the option, so the webhook carries readable answers */
  function label(name, value) {
    var esc = window.CSS && CSS.escape ? CSS.escape : String;
    var el = value && form.querySelector('input[name="' + name + '"][value="' + esc(String(value)) + '"]');
    var t = el && el.parentNode.querySelector(".txt");
    return t ? t.textContent.trim() : (value || "");
  }
  var labels = function (name, list) { return (list || []).map(function (v) { return label(name, v); }).join(", "); };

  /* wording for students or parents, fields revealed by an answer, names dropped into the copy */
  function sync() {
    var a = read();
    var who = a.filled_by === "parent" ? "parent" : "student";
    form.setAttribute("data-who", who);
    $$("[data-if]", root).forEach(function (el) { el.hidden = el.getAttribute("data-if") !== who; });
    $$("[data-show-when]", form).forEach(function (el) {
      if (el.getAttribute("data-if") && el.getAttribute("data-if") !== who) return;
      var p = el.getAttribute("data-show-when").split(":");
      el.hidden = p[1].split("|").indexOf(a[p[0]]) < 0;
    });
    var kid = who === "parent" ? a.student_first_name : a.first_name;
    var names = { first: a.first_name, student: kid, email: a.email };
    $$("[data-name]", root).forEach(function (el) {
      el.textContent = names[el.getAttribute("data-name")] || el.getAttribute("data-fallback") || "";
    });
    /* after booking: no need to ask them to bring someone who is already on the invite */
    var onCall = who === "parent" ? a.involvement_parent === "both" : a.involvement_student === "join";
    var fam = $("[data-booked-family]");
    if (fam) fam.hidden = onCall;
    $$("[data-booked-n]").forEach(function (el, i) { el.textContent = String(i + (onCall ? 2 : 3)); });
    var last = questions[TOTAL - 1] && questions[TOTAL - 1].getAttribute("data-step");
    $("[data-aw-submit-label]").textContent = state.step === last ? "Submit and pick a time" : "Continue";
    return a;
  }

  /* ---------------- the payload ---------------- */
  function person(first, last, email, phone) {
    first = first || ""; last = last || "";
    return { first: first, last: last, full: (first + " " + last).trim(), email: email || "", phone: phone || "" };
  }
  function payload(st, status) {
    var a = st.answers || {}, parentMode = a.filled_by === "parent", t = st.track || {};
    var me = person(a.first_name, a.last_name, a.email, e164(a.phone_cc, a.phone));
    var kid = parentMode ? person(a.student_first_name, a.student_last_name, a.student_email, "") : me;
    var mum = parentMode ? me : person(a.parent_first_name, a.parent_last_name, a.parent_email, e164(a.parent_phone_cc, a.parent_phone));
    var inv = parentMode ? a.involvement_parent : a.involvement_student;
    var at = st.step === "book" ? TOTAL : Math.max(qIndex(st.step), 0);
    var lastEl = stepEl(st.step);
    var secs = Math.max(0, Math.round((Date.now() - Date.parse(st.started_at)) / 1000));
    return {
      submission_id: st.id,
      submission_status: status,
      is_complete: status === "partial" ? "no" : "yes",
      is_test: st.test ? "yes" : "no",
      form: FORM_NAME,
      last_step: st.step === "book" ? (status === "booked" ? "booked" : "calendar") : st.step,
      last_question: lastEl && lastEl.getAttribute("data-title") || "",
      questions_answered: String(Math.max(st.reached || 0, at)),
      total_questions: String(TOTAL),
      filled_by: a.filled_by === "parent" ? "Parent or guardian" : a.filled_by === "student" ? "Student" : "",
      first_name: me.first, last_name: me.last, full_name: me.full, email: me.email, phone: me.phone, phone_country: a.phone_cc || "",
      student_first_name: kid.first, student_last_name: kid.last, student_full_name: kid.full, student_email: kid.email, student_phone: kid.phone,
      parent_first_name: mum.first, parent_last_name: mum.last, parent_full_name: mum.full, parent_email: mum.email, parent_phone: mum.phone,
      parent_involved: parentMode ? "yes" : inv === "join" || inv === "involved" ? "yes" : inv === "self" ? "no" : "",
      parent_on_call: parentMode ? "yes" : inv === "join" ? "yes" : inv ? "no" : "",
      student_on_call: parentMode ? (inv === "both" ? "yes" : inv === "parent_only" ? "no" : inv === "unsure" ? "not sure" : "") : "yes",
      current_stage: label("stage", a.stage),
      target_roles: labels("roles", a.roles),
      offer_timeline: label("timeline", a.timeline),
      investment: label("invest", a.invest),
      involvement_answer: parentMode ? label("involvement_parent", inv) : label("involvement_student", inv),
      biggest_obstacle: label("obstacle", a.obstacle),
      biggest_obstacle_detail: a.obstacle === "other" ? a.obstacle_detail || "" : "",
      anything_else: a.notes || "",
      calendly_event_uri: st.calendly && st.calendly.event || "",
      calendly_invitee_uri: st.calendly && st.calendly.invitee || "",
      started_at: st.started_at || "",
      completed_at: st.completed_at || "",
      booked_at: st.booked_at || "",
      sent_at: now(),
      seconds_on_form: String(secs),
      utm_source: t.utm_source || "", utm_medium: t.utm_medium || "", utm_campaign: t.utm_campaign || "", utm_content: t.utm_content || "", utm_term: t.utm_term || "",
      fbclid: t.fbclid || "", gclid: t.gclid || "",
      page_url: t.page_url || "", referrer: t.referrer || "",
      timezone: tz, device: coarse ? "mobile" : "desktop"
    };
  }

  /* ---------------- sending ---------------- */
  /* a simple form post (no preflight), which Zapier splits into one field per key */
  function post(data, beacon) {
    var body = new URLSearchParams(data);
    if (beacon && navigator.sendBeacon) { try { if (navigator.sendBeacon(WEBHOOK_URL, body)) return Promise.resolve(); } catch (e) {} }
    var tries = 0;
    return (function go() {
      return fetch(WEBHOOK_URL, { method: "POST", mode: "no-cors", keepalive: true, body: body })
        .catch(function (err) { if (++tries < 3) return new Promise(function (r) { setTimeout(r, 2000 * tries); }).then(go); throw err; });
    })();
  }
  var RANK = { "": 0, partial: 1, complete: 2, booked: 3 };
  var botty = function () { var h = form.querySelector('[name="company_website"]'); return !!(h && h.value); };
  var pause = null;
  /* each status goes once per change of answers; partials stop once the application is complete */
  function send(status, beacon) {
    clearTimeout(pause);
    if (botty()) return;
    if (status === "partial" && RANK[state.status] >= RANK.complete) return;
    var data = payload(state, status);
    var sig = hash(JSON.stringify(Object.assign({}, data, { sent_at: "", seconds_on_form: "", last_step: "", last_question: "", questions_answered: "" })));
    if (status === "partial" && state.sent.partial_at === data.last_step + sig) return;
    if (status !== "partial" && state.sent[status] === sig) return;
    if (status === "partial") state.sent.partial_at = data.last_step + sig; else state.sent[status] = sig;
    if (RANK[status] > RANK[state.status]) state.status = status;
    save();
    post(data, beacon).catch(function () {});
  }
  var reachable = function () { return !!state.contact_ok; };
  function touched() {
    state.answers = read();
    save();
    sync();
    if (reachable() && RANK[state.status] < RANK.complete) { clearTimeout(pause); pause = setTimeout(function () { send("partial"); }, PAUSE_MS); }
  }
  var flush = function () { if (reachable()) send("partial", true); };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  /* ---------------- validation ---------------- */
  var errBox = $("[data-aw-error]");
  var visible = function (el) { return el.getClientRects().length > 0; };
  function fail(el, msg) {
    errBox.textContent = msg; errBox.hidden = false;
    if (el) { el.setAttribute("aria-invalid", "true"); el.focus({ preventScroll: false }); }
    return false;
  }
  function clearErr() { errBox.hidden = true; $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); }); }
  function check(step) {
    clearErr();
    var a = read(), groups = $$("[data-required-group]", step);
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (visible(g) && !a[g.getAttribute("data-required-group")]) return fail(g.querySelector("input"), "Please choose an answer to continue.");
    }
    var els = $$("input[name], select[name], textarea[name]", step);
    for (var j = 0; j < els.length; j++) {
      var el = els[j], v = el.value.trim();
      if (el.type === "radio" || el.type === "checkbox" || !visible(el)) continue;
      if (el.required && !v) return fail(el, el.type === "email" ? "Please add an email address." : el.hasAttribute("data-phone") ? "Please add a phone number." : "Please fill this in to continue.");
      if (v && el.type === "email" && !emailOk(v)) return fail(el, "That email doesn't look right. Check for typos.");
      if (v && el.hasAttribute("data-phone") && digits(v).length < 7) return fail(el, "That phone number looks too short.");
    }
    return true;
  }

  /* ---------------- moving between steps ---------------- */
  var top = $("[data-aw-top]"), nav = $("[data-aw-nav]"), bar = $("[data-aw-bar]"), line = $("[data-aw-line]");
  function progress() {
    var qi = qIndex(state.step), book = state.step === "book";
    var done = book ? TOTAL : Math.max(qi, 0);
    var pct = Math.round(done / TOTAL * 100);
    top.hidden = state.step === "welcome";
    nav.hidden = qi < 0;
    $("[data-aw-count]").textContent = book ? (state.status === "booked" ? "Call booked" : "Application complete") : "Question " + (qi + 1) + " of " + TOTAL;
    $("[data-aw-pct-label]").textContent = pct + "%";
    bar.style.width = pct + "%";
    $$("[data-aw-pct]").forEach(function (el) { el.textContent = pct + "%"; });
    if (line) line.style.strokeDashoffset = String(100 - Math.max(pct, 2));
  }
  function focusStep(step) {
    var input = !coarse && !step.querySelector(".aw-choices") && step.querySelector("input, textarea");
    var target = input && visible(input) && !input.value ? input : step.querySelector("[tabindex='-1']");
    if (target) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }
    var r = form.getBoundingClientRect();
    if (r.top < 0) window.scrollTo({ top: window.scrollY + r.top - 96, behavior: reduced ? "auto" : "smooth" });
  }
  function show(id, dir) {
    clearErr();
    state.step = id;
    steps.forEach(function (s) {
      var on = s.getAttribute("data-step") === id;
      s.hidden = !on;
      s.classList.remove("is-in", "is-back");
      if (on && dir && !reduced) { void s.offsetWidth; s.classList.add(dir < 0 ? "is-back" : "is-in"); }
    });
    root.setAttribute("data-at", id);
    root.classList.toggle("is-booking", id === "book");
    save();
    sync();
    progress();
    if (id === "book") openCalendar();
    if (dir) focusStep(stepEl(id));
  }
  var autoTimer = null;
  function next() {
    clearTimeout(autoTimer);
    var cur = stepEl(state.step), i = ids.indexOf(state.step);
    if (state.step === "book" || i < 0) return;
    if (!check(cur)) return;
    state.answers = read();
    var nid = ids[i + 1], was = state.step;
    state.reached = Math.max(state.reached || 0, qIndex(was) + 1);
    state.step = nid;                               // payloads report the step they're on now
    if (was === "contact") { state.contact_ok = true; send("partial"); }
    if (nid === "book") {
      state.completed_at = state.completed_at || now();
      send("complete");
      bull({ celebrate: true });
    } else {
      bull({ dir: i % 2 ? 1 : -1 });
    }
    show(nid, 1);
  }
  function back() {
    clearTimeout(autoTimer);
    var i = ids.indexOf(state.step);
    if (i > 0) { show(ids[i - 1], -1); bull({ dir: -1 }); }
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); next(); });
  $$("[data-aw-next]", form).forEach(function (b) { b.addEventListener("click", next); });
  $$("[data-aw-back]", form).forEach(function (b) { b.addEventListener("click", back); });
  form.addEventListener("input", function (e) { if (e.target.getAttribute("aria-invalid")) clearErr(); touched(); });

  /* single-choice questions move on by themselves, but only after a click, a tap or a letter key
     (arrow keys between radios shouldn't jump ahead), and not when the answer opens more fields */
  var picked = 0;
  form.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest(".choice")) picked = Date.now(); });
  form.addEventListener("change", function (e) {
    var el = e.target;
    if (el.type === "checkbox" && el.checked) {
      $$('input[name="' + el.name + '"]', form).forEach(function (o) {
        if (o !== el && (el.hasAttribute("data-exclusive") || o.hasAttribute("data-exclusive"))) o.checked = false;
      });
    }
    if (el.name === "filled_by") $$("[data-aw-resume]").forEach(function (n) { n.hidden = true; });
    clearErr();
    touched();
    var step = el.closest("[data-step]");
    if (el.type === "radio" && step && step.hasAttribute("data-auto") && !el.hasAttribute("data-stay") && Date.now() - picked < 1500) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(next, reduced ? 120 : 360);
    } else if (el.hasAttribute("data-stay")) {
      var reveal = step && $$(".aw-reveal", step).filter(visible)[0], first = reveal && reveal.querySelector("input, textarea");
      if (first && !coarse) setTimeout(function () { first.focus(); }, 60);
    }
  });

  /* keyboard: A, B, C… pick an option, Enter moves on (text fields submit the form by themselves) */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, inForm = form.contains(t) || t === document.body;
    if (!inForm || state.step === "book") return;
    var typing = /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === "INPUT" && !/^(radio|checkbox)$/.test(t.type));
    if (e.key === "Enter") {
      if (t.tagName === "TEXTAREA" && (e.shiftKey || coarse)) return;
      if (t.tagName === "BUTTON" || t.tagName === "A" || (typing && t.tagName !== "TEXTAREA")) return;
      e.preventDefault(); next(); return;
    }
    if (typing || e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
    var step = stepEl(state.step);
    var opts = $$(".aw-choices", step).filter(visible).reduce(function (all, g) { return all.concat($$("input", g)); }, []);
    var n = e.key.toUpperCase().charCodeAt(0) - 65, inp = opts[n];
    if (!inp) return;
    e.preventDefault();
    picked = Date.now();
    inp.checked = inp.type === "checkbox" ? !inp.checked : true;
    inp.focus({ preventScroll: true });
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  });

  /* ---------------- Calendly ---------------- */
  var calBox = $("[data-aw-cal]"), calLink = $("[data-aw-cal-link]"), calShown = "";
  function calendarUrl() {
    var p = payload(state, "complete"), q = [];
    var add = function (k, v) { if (v) q.push(k + "=" + encodeURIComponent(v)); };
    add("name", p.full_name); add("first_name", p.first_name); add("last_name", p.last_name); add("email", p.email);
    CALENDLY_PHONE_FIELDS.forEach(function (k) { add(k, p.phone); });
    /* whoever else is joining the call goes on the invite (the event must allow guests) */
    var parentMode = state.answers.filled_by === "parent";
    add("guests", parentMode ? (p.student_on_call !== "no" ? p.student_email : "") : (p.parent_on_call === "yes" ? p.parent_email : ""));
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { add(k, p[k]); });
    var css = getComputedStyle(document.documentElement);
    var hex = function (n) { return css.getPropertyValue(n).trim().replace(/^#/, "").toLowerCase(); };
    add("background_color", hex("--card")); add("text_color", hex("--ink")); add("primary_color", hex("--accent"));
    add("hide_gdpr_banner", "1"); add("hide_event_type_details", "1"); add("hide_landing_page_details", "1");
    return CALENDLY_URL + (CALENDLY_URL.indexOf("?") < 0 ? "?" : "&") + q.join("&");
  }
  var calScript = null;
  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (calScript) return calScript;
    calScript = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = "https://assets.calendly.com/assets/external/widget.js"; s.async = true;
      s.onload = function () { window.Calendly ? ok() : no(); }; s.onerror = no;
      document.head.appendChild(s);
      setTimeout(no, 15000);
    });
    return calScript;
  }
  function openCalendar() {
    if (state.status === "booked") { booked(false); return; }
    var u = calendarUrl();
    calLink.href = u;
    if (u === calShown) return;
    calShown = u;
    calBox.hidden = false;
    calBox.innerHTML = '<div class="aw-cal-wait"><span class="spinner" aria-hidden="true"></span>Loading the calendar…</div>';
    loadCalendly().then(function () {
      if (calShown !== u) return;
      calBox.innerHTML = "";
      window.Calendly.initInlineWidget({ url: u, parentElement: calBox, resize: true });
    }).catch(function () {
      calShown = "";
      calBox.innerHTML = '<div class="aw-cal-wait">The calendar didn\'t load here.<a class="btn btn--solid" target="_blank" rel="noopener" href="' + u.replace(/"/g, "&quot;") + '">Open the calendar <span class="arr" aria-hidden="true">→</span></a></div>';
    });
  }
  function booked(live) {
    $("[data-book-head]").hidden = true;
    $("[data-book-back]").hidden = true;
    $("[data-booked]").hidden = false;
    $("[data-aw-cal-alt]").hidden = true;
    if (!live) calBox.hidden = true;
    progress();
    var h = $("#aw-h-booked");
    if (live && h) { try { h.focus({ preventScroll: true }); } catch (e) {} $("[data-booked]").scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }
  }
  window.addEventListener("message", function (e) {
    if (!/^https:\/\/([a-z0-9-]+\.)*calendly\.com$/.test(e.origin || "")) return;
    var d = e.data;
    if (!d || typeof d.event !== "string" || d.event.indexOf("calendly.") !== 0) return;
    if (d.event === "calendly.page_height" && d.payload && d.payload.height) {
      var h = parseInt(d.payload.height, 10);
      if (h > 0) calBox.style.height = Math.max(h, 560) + "px";
    }
    if (d.event === "calendly.event_scheduled" && state.status !== "booked") {
      var p = d.payload || {};
      state.calendly = { event: p.event && p.event.uri || "", invitee: p.invitee && p.invitee.uri || "" };
      state.booked_at = now();
      send("booked");
      bull({ celebrate: true });
      booked(true);
    }
  });

  /* ---------------- 3D bull: in the side panel on wide screens, above the form on phones ---------------- */
  (function () {
    var stage = $("[data-aw-stage]"), slot = $("[data-aw-stage-slot]");
    if (!stage || !slot || !window.matchMedia) return;
    var home = stage.parentNode, mq = matchMedia("(max-width: 960px)");
    var place = function () {
      if (mq.matches) { if (stage.parentNode !== slot) slot.appendChild(stage); }
      else if (stage.parentNode !== home) home.insertBefore(stage, home.firstChild);
      stage.classList.toggle("aw-stage--compact", mq.matches);
    };
    if (mq.addEventListener) mq.addEventListener("change", place); else if (mq.addListener) mq.addListener(place);
    place();
  })();

  /* ---------------- start ---------------- */
  /* details passed in from the webinar link (?name=&email=&phone=), for anything not already typed */
  (function () {
    var a = state.answers, nm = (params.get("name") || "").trim().split(/\s+/);
    var pre = {
      first_name: params.get("first_name") || params.get("fname") || (nm[0] || ""),
      last_name: params.get("last_name") || params.get("lname") || nm.slice(1).join(" "),
      email: params.get("email") || "",
      phone: params.get("phone") || ""
    };
    var intl = !a.phone && /^\s*\+/.test(pre.phone) && fromIntl(pre.phone);
    if (intl) { a.phone_cc = intl.cc; pre.phone = intl.num; }
    Object.keys(pre).forEach(function (k) { if (pre[k] && !a[k]) a[k] = pre[k].slice(0, 120); });
    if (!a.phone_cc) a.phone_cc = homeCc;
    if (!a.parent_phone_cc) a.parent_phone_cc = a.phone_cc;
  })();
  write(state.answers);
  if (resumed && state.step !== "welcome") $("[data-aw-resume]").hidden = false;
  /* start over in place, keeping the campaign tags this visit came with */
  $("[data-aw-restart]").addEventListener("click", function () {
    var keep = state;
    state = blank(); state.track = keep.track; if (keep.test) state.test = true;
    form.reset();
    write({ phone_cc: keep.answers.phone_cc || homeCc, parent_phone_cc: keep.answers.phone_cc || homeCc });
    $("[data-aw-resume]").hidden = true;
    $("[data-book-head]").hidden = false; $("[data-book-back]").hidden = false; $("[data-booked]").hidden = true;
    calBox.hidden = false; $("[data-aw-cal-alt]").hidden = false; calShown = "";
    show("welcome", 0);
    $("#aw-h-welcome").focus();
  });
  show(ids.indexOf(state.step) >= 0 ? state.step : "welcome", 0);

  /* ---------------- test mode (?test=1) ---------------- */
  if (state.test) {
    var sample = function (status) {
      var t0 = Date.now() - 154000;
      return payload({
        id: "test-" + uid(), test: true, step: status === "partial" ? "invest" : "book", reached: status === "partial" ? 5 : TOTAL,
        started_at: new Date(t0).toISOString(),
        completed_at: status === "partial" ? "" : new Date(t0 + 120000).toISOString(),
        booked_at: status === "booked" ? new Date(t0 + 150000).toISOString() : "",
        calendly: status === "booked" ? { event: "https://api.calendly.com/scheduled_events/TEST-EVENT", invitee: "https://api.calendly.com/scheduled_events/TEST-EVENT/invitees/TEST-INVITEE" } : null,
        track: { utm_source: "webinar", utm_medium: "live", utm_campaign: "placement-playbook", utm_content: "end-cta", page_url: window.location.href.split("#")[0], referrer: "" },
        answers: {
          filled_by: "student", stage: "junior", roles: ["ib", "pe"], first_name: "Test", last_name: "Student", email: "test.student@example.com", phone_cc: "US", phone: "555 555 0123",
          timeline: "3m", invest: status === "partial" ? "" : "5k_plus",
          involvement_student: status === "partial" ? "" : "join", parent_first_name: status === "partial" ? "" : "Test", parent_last_name: status === "partial" ? "" : "Parent",
          parent_email: status === "partial" ? "" : "test.parent@example.com", parent_phone_cc: "US", parent_phone: status === "partial" ? "" : "555 555 0124",
          obstacle: status === "partial" ? "" : "other", obstacle_detail: status === "partial" ? "" : "Test submission from the ?test=1 panel. Safe to delete.", notes: status === "partial" ? "" : "Test payload, safe to delete."
        }
      }, status);
    };
    var panel = document.createElement("div");
    panel.className = "aw-test";
    panel.innerHTML = '<b>Test mode</b><span>Every post from this browser session carries is_test=yes.</span>' +
      '<div class="aw-test-row"><button type="button" data-s="partial">Send partial</button><button type="button" data-s="complete">Send complete</button><button type="button" data-s="booked">Send booked</button></div>' +
      '<small data-test-out aria-live="polite"></small>';
    document.body.appendChild(panel);
    var out = $("[data-test-out]", panel);
    $$("button", panel).forEach(function (b) {
      b.addEventListener("click", function () {
        var s = b.getAttribute("data-s");
        out.textContent = "Sending " + s + "…";
        post(sample(s), false).then(function () { out.textContent = "Sent a test " + s + " payload at " + new Date().toLocaleTimeString() + ". Check the Zap's trigger."; })
          .catch(function () { out.textContent = "Couldn't reach Zapier from this browser (blocked or offline)."; });
      });
    });
  }
})();
