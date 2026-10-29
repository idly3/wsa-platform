/* Wall Street Alpha — motion for the marketing pages (index.html, replay.html).
   Decoration on top of pages that already work without it:
     [data-split]       a headline whose words rise in one after another on load
     [data-rise]        rises into view the first time it is scrolled to
     [data-rise-group]  its children rise in turn
     [data-count]       a number that counts up when it comes into view ("240+" counts to 240 and keeps the +)
     [data-spot]        a soft light that follows the cursor across a card
     [data-tilt]        leans toward the cursor in 3D (inside its parent, or [data-tilt-stage])
     [data-magnetic]    a button that drifts toward the cursor
   plus a scroll progress line and a raised header once the page scrolls.
   Each page's <head> adds .js-motion to <html> before the first paint, so nothing flashes, unless the
   visitor prefers reduced motion; if this file never loads, the class comes off again after 3 seconds. */
(function () {
  "use strict";
  window.WSA_MOTION = true;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var moving = root.classList.contains("js-motion") && !reduced;

  /* ---------------- headline words ---------------- */
  /* words split on ordinary spaces only, so "Wall&nbsp;Street" stays together; a .mark highlight is one word */
  $$("[data-split]").forEach(function (h) {
    if (!moving) return;
    var i = 0;
    var word = function (el) { el.classList.add("w"); el.style.setProperty("--i", i++); return el; };
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\r\n]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\r\n]+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var s = document.createElement("span"); s.textContent = p; frag.appendChild(word(s));
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.classList.contains("mark")) word(n); else wrap(n);
        }
      });
    })(h);
    h.classList.add("is-split");
    requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add("is-in"); }); });
  });

  /* ---------------- rise in, count up ---------------- */
  function countUp(el) {
    var m = el.textContent.match(/^(\D*)([\d,]+)(.*)$/);
    if (!m) return;
    var end = parseInt(m[2].replace(/,/g, ""), 10), t0 = 0, dur = 1500;
    var fmt = function (n) { return m[1] + Math.round(n).toLocaleString("en-US") + m[3]; };
    el.style.minWidth = el.getBoundingClientRect().width + "px";       // no reflow while the digits change
    el.textContent = fmt(0);
    (function step(ts) {
      t0 = t0 || ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = fmt(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else el.style.minWidth = "";
    })(performance.now());
  }
  $$("[data-rise-group]").forEach(function (g) {
    Array.prototype.slice.call(g.children).forEach(function (c, i) { c.style.setProperty("--i", i); });
  });
  var watched = $$("[data-rise], [data-rise-group], [data-count]");
  if (moving && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        e.target.classList.add("is-in");
        if (e.target.hasAttribute("data-count")) countUp(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    watched.forEach(function (el) { io.observe(el); });
  } else {
    watched.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------------- cursor: spotlight, tilt, magnetic ---------------- */
  if (fine) {
    $$("[data-spot]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  }
  if (fine && !reduced) {
    $$("[data-tilt]").forEach(function (el) {
      var stage = el.closest("[data-tilt-stage]") || el.parentElement;
      stage.addEventListener("pointermove", function (e) {
        var r = stage.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (x * 16).toFixed(2) + "deg");
        el.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
      });
      stage.addEventListener("pointerleave", function () { el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg"); });
    });
    $$("[data-magnetic]").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.2).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  }

  /* ---------------- scroll: progress line, raised header ---------------- */
  var line = document.createElement("div");
  line.className = "scroll-line";
  line.setAttribute("aria-hidden", "true");
  document.body.appendChild(line);
  var header = document.querySelector(".header"), ticking = false;
  var onScroll = function () {
    ticking = false;
    var max = root.scrollHeight - window.innerHeight;
    line.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ")";
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
