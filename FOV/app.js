/* =============================================================================
 * app.js — math, rendering, and event wiring for the FOV Planner.
 * Reads SCOPES / CAMERAS / TARGETS from data.js.
 * No framework, no build step.
 * ============================================================================= */

"use strict";

const DEG = 180 / Math.PI;

/* ---- Core math (from spec) ------------------------------------------------ */

// Angular extent (deg) of a linear sensor/circle dimension at a focal length.
// Proper arctangent form so it stays correct at wide fields.
function angularDeg(dimMM, focalMM) {
  return 2 * Math.atan((dimMM / 2) / focalMM) * DEG;
}

// arcsec / pixel
function arcsecPerPx(pixelMicron, focalMM) {
  return (pixelMicron / focalMM) * 206.265;
}

function camFov(cam, focalMM) {
  return { w: angularDeg(cam.wMM, focalMM), h: angularDeg(cam.hMM, focalMM) };
}

// "Fits" test (rotation ignored in v1).
function fits(fov, target) {
  return fov.w >= target.wDeg && fov.h >= target.hDeg;
}

const round2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

/* ---- Seeded PRNG (mulberry32) so field stars don't jitter on redraw ------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const STAR_SEED = 1235; // constant => stable star field

/* ---- Palette: a distinct colour per camera (by index) --------------------- */
const CAM_COLORS = ["#6db3f2", "#57d18a", "#f2b84b", "#c887f0", "#f2785c"];
function camColor(i) { return CAM_COLORS[i % CAM_COLORS.length]; }

/* ---- State ---------------------------------------------------------------- */
// Camera ordering: owned first, then original order (stable).
const CAM_ORDER = CAMERAS
  .map((c, i) => ({ cam: c, i }))
  .sort((a, b) => (b.cam.owned === true) - (a.cam.owned === true));

const enabled = new Map(); // original index -> bool
CAM_ORDER.forEach(({ i }) => enabled.set(i, true));

let configIdx = 0;
let targetIdx = 0;

/* ---- DOM ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/* ---- Populate dropdowns --------------------------------------------------- */
function initSelectors() {
  const cfg = $("configSelect");
  SCOPES.forEach((s, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `${s.name} — ${s.focalLength}mm f/${s.fRatio}`;
    cfg.appendChild(o);
  });
  cfg.addEventListener("change", () => { configIdx = +cfg.value; render(); });

  const tgt = $("targetSelect");
  TARGETS.forEach((t, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = t.name;
    tgt.appendChild(o);
  });
  tgt.addEventListener("change", () => { targetIdx = +tgt.value; render(); });
}

/* ---- Legend (camera toggles) ---------------------------------------------- */
function renderLegend(focalMM) {
  const wrap = $("legend");
  wrap.innerHTML = "";
  CAM_ORDER.forEach(({ cam, i }) => {
    const on = enabled.get(i);
    const color = camColor(i);
    const fov = camFov(cam, focalMM);

    const row = document.createElement("div");
    row.className = "cam" + (on ? "" : " off");
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", String(on));

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.color = color;
    sw.style.background = on ? color : "transparent";

    const main = document.createElement("div");
    main.className = "cam-main";
    const name = document.createElement("div");
    name.className = "cam-name";
    name.textContent = cam.name;
    if (cam.owned) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = "mine";
      name.appendChild(b);
    }
    const fovEl = document.createElement("div");
    fovEl.className = "cam-fov";
    fovEl.textContent = `${round2(fov.w)}° × ${round2(fov.h)}°`;
    main.appendChild(name);
    main.appendChild(fovEl);

    row.appendChild(sw);
    row.appendChild(main);
    row.addEventListener("click", () => {
      enabled.set(i, !enabled.get(i));
      render();
    });
    wrap.appendChild(row);
  });
}

/* ---- Diagram -------------------------------------------------------------- */
function renderDiagram(scope, target, focalMM) {
  const svg = $("diagram");
  svg.innerHTML = "";

  const VB = 1000;            // viewBox is 1000 x 1000
  const cx = VB / 2, cy = VB / 2;

  // Enabled camera FOVs (deg).
  const cams = CAM_ORDER
    .filter(({ i }) => enabled.get(i))
    .map(({ cam, i }) => ({ cam, i, color: camColor(i), fov: camFov(cam, focalMM) }));

  const circleDeg = angularDeg(scope.imageCircle, focalMM);

  // Auto-zoom: the larger of {image circle, target} fits with ~6% margin.
  // We also make sure every enabled camera frame stays on-canvas.
  let extentDeg = Math.max(
    circleDeg,
    target.wDeg, target.hDeg
  );
  cams.forEach((c) => { extentDeg = Math.max(extentDeg, c.fov.w, c.fov.h); });
  const halfSpanDeg = (extentDeg / 2) / 0.94;          // 6% margin
  const pxPerDeg = (VB / 2) / halfSpanDeg;             // deg -> viewBox px

  const D = (deg) => deg * pxPerDeg;                   // full extent in px

  // --- background field stars (seeded) ---
  const rnd = mulberry32(STAR_SEED);
  const starG = svgEl("g", {});
  for (let s = 0; s < 14; s++) {
    const x = rnd() * VB, y = rnd() * VB;
    const r = 1.2 + rnd() * 2.3;
    const op = 0.18 + rnd() * 0.35;
    starG.appendChild(svgEl("circle", { cx: x, cy: y, r, fill: "#cdd6e3", opacity: op.toFixed(3) }));
  }
  svg.appendChild(starG);

  // --- target schematic ---
  svg.appendChild(drawTarget(target, cx, cy, D));

  // --- image circle (dashed grey) ---
  svg.appendChild(svgEl("circle", {
    cx, cy, r: D(circleDeg) / 2,
    fill: "none", stroke: "#7f8aa0", "stroke-width": 2.2,
    "stroke-dasharray": "10 9", opacity: 0.9
  }));

  // --- camera rectangles: largest area first so smaller layer on top ---
  const ordered = cams.slice().sort((a, b) =>
    (b.fov.w * b.fov.h) - (a.fov.w * a.fov.h));
  ordered.forEach(({ color, fov }) => {
    const w = D(fov.w), h = D(fov.h);
    svg.appendChild(svgEl("rect", {
      x: cx - w / 2, y: cy - h / 2, width: w, height: h,
      rx: 4, fill: color, "fill-opacity": 0.06,
      stroke: color, "stroke-width": 2.6, "stroke-opacity": 0.95
    }));
  });
}

function drawTarget(t, cx, cy, D) {
  const g = svgEl("g", {});
  const rw = D(t.wDeg) / 2;          // semi-axes in px
  const rh = D(t.hDeg) / 2;

  if (t.kind === "dark") {
    // tilted grey ellipse + denser "nose"
    const tilt = svgEl("g", { transform: `rotate(-22 ${cx} ${cy})` });
    tilt.appendChild(svgEl("ellipse", {
      cx, cy, rx: rw, ry: rh, fill: "#9aa7ba", "fill-opacity": 0.12,
      stroke: "#9aa7ba", "stroke-opacity": 0.25, "stroke-width": 1.5
    }));
    tilt.appendChild(svgEl("ellipse", {
      cx: cx - rw * 0.45, cy, rx: rw * 0.42, ry: rh * 0.6,
      fill: "#9aa7ba", "fill-opacity": 0.22
    }));
    g.appendChild(tilt);
  } else if (t.kind === "galaxy") {
    g.appendChild(svgEl("ellipse", {
      cx, cy, rx: rw, ry: rh, fill: "#d7e0ee", "fill-opacity": 0.14,
      stroke: "#d7e0ee", "stroke-opacity": 0.22, "stroke-width": 1.5
    }));
    g.appendChild(svgEl("circle", {
      cx, cy, r: Math.max(2.5, Math.min(rw, rh) * 0.18),
      fill: "#fff7e6", "fill-opacity": 0.9
    }));
  } else if (t.kind === "pn") {
    g.appendChild(svgEl("circle", {
      cx, cy, r: Math.max(rw, rh, 3),
      fill: "#3fd0c9", "fill-opacity": 0.35,
      stroke: "#3fd0c9", "stroke-opacity": 0.7, "stroke-width": 1.5
    }));
  } else { // 'neb'
    g.appendChild(svgEl("ellipse", {
      cx, cy, rx: rw, ry: rh, fill: "#6db3f2", "fill-opacity": 0.14,
      stroke: "#6db3f2", "stroke-opacity": 0.3, "stroke-width": 1.5
    }));
  }
  return g;
}

/* ---- Metric cards --------------------------------------------------------- */
function renderCards(scope, target, focalMM) {
  const cards = $("cards");
  cards.innerHTML = "";

  const card = (k, v, sub) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>` +
                   (sub ? `<div class="sub">${sub}</div>` : "");
    return el;
  };

  cards.appendChild(card("Focal length", `${focalMM} mm`));
  cards.appendChild(card("f-ratio", `f/${scope.fRatio}`));
  cards.appendChild(card("Target size", `${round2(target.wDeg)}° × ${round2(target.hDeg)}°`,
    target.kind));

  // Sampling: per-camera (pixel-dependent), full-width card.
  const samp = document.createElement("div");
  samp.className = "card sampling";
  samp.innerHTML = `<div class="k">Sampling — arcsec / pixel</div>
    <div class="sub">Pixel-size dependent; differs per camera.</div>`;
  const list = document.createElement("div");
  list.className = "samp-list";
  CAM_ORDER.forEach(({ cam }) => {
    const row = document.createElement("div");
    row.className = "samp-row";
    const aspp = arcsecPerPx(cam.pixelMicron, focalMM);
    row.innerHTML = `<span class="sname">${cam.name} · ${cam.pixelMicron}µm</span>` +
                    `<span class="sval">${round2(aspp)}″/px</span>`;
    list.appendChild(row);
  });
  samp.appendChild(list);
  cards.appendChild(samp);
}

/* ---- Verdict -------------------------------------------------------------- */
function renderVerdict(target, focalMM) {
  const el = $("verdict");
  const active = CAM_ORDER
    .filter(({ i }) => enabled.get(i))
    .map(({ cam }) => ({ cam, fov: camFov(cam, focalMM) }));

  if (active.length === 0) {
    el.className = "verdict";
    el.textContent = "No cameras selected — tap a swatch above to add one.";
    return;
  }

  const fitting = active.filter(({ fov }) => fits(fov, target));
  const fl = `${focalMM}mm`;

  if (fitting.length === active.length) {
    // Smallest fitting sensor (by area) is the efficient pick.
    const smallest = fitting.slice()
      .sort((a, b) => (a.cam.wMM * a.cam.hMM) - (b.cam.wMM * b.cam.hMM))[0];
    el.className = "verdict good";
    el.textContent =
      `All selected cameras frame ${target.name} at ${fl}. ` +
      `Smallest fitting sensor (${smallest.cam.name}) is the efficient pick.`;
  } else if (fitting.length === 0) {
    el.className = "verdict bad";
    el.textContent =
      `${target.name} overflows every selected sensor at ${fl}. ` +
      `Use a shorter config or shoot a mosaic.`;
  } else {
    el.className = "verdict some";
    const names = fitting.map((f) => f.cam.name).join(", ");
    el.textContent = `Fits in: ${names}. Smaller sensors crop the target.`;
  }
}

/* ---- Master render -------------------------------------------------------- */
function render() {
  const scope = SCOPES[configIdx];
  const target = TARGETS[targetIdx];
  const focalMM = scope.focalLength;

  renderLegend(focalMM);
  renderDiagram(scope, target, focalMM);
  renderCards(scope, target, focalMM);
  renderVerdict(target, focalMM);
}

/* ---- Boot ----------------------------------------------------------------- */
initSelectors();
render();
