/* 3D bull for the experimental landing page (home-3d.html).
   Extrudes the traced logo outline (bull-shape.json, made by .claude/trace_bull.py) into a faint
   watermark behind the hero headline that follows the cursor, touch, scroll and phone tilt.
   CSS sets its opacity.
   Falls back to the flat logo when WebGL or the CDN isn't available. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const host = document.querySelector("[data-bull3d]");
if (host) init(host).catch(function (err) { host.classList.add("is-fallback"); console.warn("3D bull unavailable:", err); });

function webglOk() {
  try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}

/* traced outline (image px, y down) -> THREE.Shapes in world units (y up), centred on the origin */
function buildShapes(data, scale) {
  var cx = data.width / 2, cy = data.height / 2;
  var v = function (p) { return new THREE.Vector2((p[0] - cx) * scale, (cy - p[1]) * scale); };
  var toShapes = function (parts) {
    return parts.map(function (s) {
      var shape = new THREE.Shape(s.outer.map(v));
      s.holes.forEach(function (h) { shape.holes.push(new THREE.Path(h.map(v))); });
      return shape;
    });
  };
  return { body: toShapes(data.parts.body), horn: toShapes(data.parts.horn) };
}

async function init(host) {
  if (!webglOk()) throw new Error("WebGL not supported");
  var data = await (await fetch(new URL("bull-shape.json", import.meta.url))).json();

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = matchMedia("(pointer: coarse)").matches;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  var camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

  /* the bull: ~4 units tall, extruded with a small bevel so the edges catch the light */
  var HEIGHT = 4, scale = HEIGHT / data.height, depth = 0.5;
  var shapes = buildShapes(data, scale);
  var extrude = { depth: depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.018, bevelSegments: 3, curveSegments: 1 };
  var bodyMat = new THREE.MeshPhysicalMaterial({ metalness: 0.2, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  var hornMat = new THREE.MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  var bodyGeo = new THREE.ExtrudeGeometry(shapes.body, extrude);
  var hornGeo = new THREE.ExtrudeGeometry(shapes.horn, Object.assign({}, extrude, { depth: depth + 0.04 }));
  bodyGeo.translate(0, 0, -depth / 2);
  hornGeo.translate(0, 0, -(depth + 0.04) / 2);
  var bull = new THREE.Group();
  bull.add(new THREE.Mesh(bodyGeo, bodyMat), new THREE.Mesh(hornGeo, hornMat));
  var pivot = new THREE.Group();               // pivot turns toward the cursor
  pivot.add(bull);
  scene.add(pivot);

  /* lights: key from upper right and a cool rim from behind; soft enough to stay a watermark */
  var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 6); scene.add(key);
  var rim = new THREE.DirectionalLight(0x9db7ff, 2.2); rim.position.set(-5, 3, -4); scene.add(rim);

  /* one brand tone from the site's colour tokens (navy in light mode, pale blue in dark mode) */
  var applyTheme = function () {
    var css = getComputedStyle(document.documentElement);
    var tone = css.getPropertyValue("--accent").trim() || "#12284B";
    bodyMat.color.set(tone);
    hornMat.color.set(tone);
    render();
  };

  /* fit the bull to the canvas */
  var box = new THREE.Box3().setFromObject(bull), size = box.getSize(new THREE.Vector3());
  var resize = function () {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    var fov = THREE.MathUtils.degToRad(camera.fov);
    var fitH = (size.y * 0.56) / Math.tan(fov / 2), fitW = (size.x * 0.56) / (Math.tan(fov / 2) * camera.aspect);
    camera.position.set(0, 0, Math.max(fitH, fitW) + depth);
    camera.updateProjectionMatrix();
    render();
  };

  /* inputs: cursor, touch (drag and tap), page scroll and, on Android, tilting the phone.
     All listeners are passive, so nothing blocks scrolling. Idle sway when nothing moves. */
  var hero = host.closest(".hero") || host.parentElement;
  var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, lastInput = -1e9;
  var scroll = 0, scrollCur = 0, grown = 1;          // 0 at the top of the hero, 1 once it has scrolled past
  var spin = { x: 0, v: 0 };                         // springy flinch when the hero is tapped or clicked
  var aim = function (cx, cy) {
    var r = host.getBoundingClientRect();
    target.x = THREE.MathUtils.clamp((cx - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
    target.y = THREE.MathUtils.clamp((cy - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
    lastInput = performance.now();
    wake();
  };
  var readScroll = function () {                     // the hero opens the page: full effect after 60% of it
    scroll = THREE.MathUtils.clamp(window.scrollY / Math.max(hero.offsetHeight * 0.6, 1), 0, 1);
  };
  window.addEventListener("pointermove", function (e) { aim(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("touchmove", function (e) { if (e.touches[0]) aim(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener("scroll", function () { readScroll(); wake(); }, { passive: true });
  hero.addEventListener("pointerdown", function (e) {
    if (reduced) return;
    var r = host.getBoundingClientRect();
    spin.v += (e.clientX < r.left + r.width / 2 ? -1 : 1) * 3;
    aim(e.clientX, e.clientY);
  }, { passive: true });
  /* phone tilt where it needs no permission prompt (Android); iOS would ask, so it is skipped there */
  if (coarse && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== "function") {
    var held = null;                                 // the angle the phone is normally held at
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null || e.beta == null) return;
      held = held == null ? e.beta : held + (e.beta - held) * 0.02;
      target.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
      target.y = THREE.MathUtils.clamp((e.beta - held) / 30, -1, 1);
      lastInput = performance.now();
      wake();
    });
  }

  var clock = new THREE.Clock(), running = false, visible = true;
  function render() { renderer.render(scene, camera); }
  function frame() {
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    var idle = performance.now() - lastInput > 2500;
    var tx = target.x, ty = target.y;
    if (idle && !reduced) { tx = Math.sin(t * 0.3) * 0.4; ty = Math.sin(t * 0.21) * 0.15; }
    var k = 1 - Math.exp(-dt * (idle ? 1 : 3));
    cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k;
    scrollCur += ((reduced ? 0 : scroll) - scrollCur) * (1 - Math.exp(-dt * 6));
    spin.v += (-spin.x * 28 - spin.v * 5) * dt; spin.x += spin.v * dt;   // damped spring back to rest
    pivot.rotation.y = cur.x * 0.45 + scrollCur * 0.6 + spin.x;          // scrolling turns the head away
    pivot.rotation.x = cur.y * 0.22 + scrollCur * 0.25;
    pivot.position.y = -scrollCur * 0.8;                                  // and lags behind the text (depth)
    var grow = 1 + scrollCur * 0.22;                                      // and grows; scaling the layer (not
    if (Math.abs(grow - grown) > 1e-4) { host.style.scale = grow; grown = grow; }   // the model) avoids canvas clipping
    render();
    var settled = reduced && Math.abs(tx - cur.x) < 1e-3 && Math.abs(ty - cur.y) < 1e-3;
    if (settled) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function wake() {
    if (running || !visible || document.hidden) return;
    running = true; clock.getDelta(); requestAnimationFrame(frame);
  }
  function sleep() { running = false; }

  /* only animate while the hero is on screen and the tab is visible */
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    visible ? wake() : sleep();
  }).observe(host);
  document.addEventListener("visibilitychange", function () { document.hidden ? sleep() : wake(); });
  new ResizeObserver(resize).observe(host);
  var scheme = matchMedia("(prefers-color-scheme: dark)");
  if (scheme.addEventListener) scheme.addEventListener("change", applyTheme);

  resize();
  readScroll();
  applyTheme();
  host.classList.add("is-ready");
  wake();
}
