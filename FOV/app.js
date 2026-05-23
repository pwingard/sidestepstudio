/* =============================================================================
 * app.js — math, rendering, and event wiring for the FOV Planner.
 * Reads SCOPES / CAMERAS / TARGETS from data.js.
 * No framework, no build step.
 * ============================================================================= */

"use strict";

const APP_VERSION = "v10";   // shown in the title bar; bump with sw.js CACHE_VERSION
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

// Cameras valid for a given config: a fixed-system scope (e.g. the Origin)
// only shows cameras tagged with the same `system`; normal scopes hide any
// system-tagged cameras. Keeps physically-impossible combos out of the UI.
function camsForScope(scope) {
  const sys = scope.system || null;
  return CAM_ORDER.filter(({ cam }) => (cam.system || null) === sys);
}

let configIdx = 0;
let targetIdx = 0;
let lastPxPerDeg = 1;   // deg->viewBox scale from the last diagram render (for drag)

/* ---- Custom targets resolved by name (CDS Sesame) ------------------------- */
// Persisted in localStorage; appended after the seeded TARGETS in the dropdown.
// Sesame returns coordinates + a type but not angular size, so a custom target
// gets a user-editable approximate size (used by the fit verdict / schematic).
const customTargets = [];
const CT_KEY = "fovCustomTargets";

function loadCustomTargets() {
  try {
    const j = localStorage.getItem(CT_KEY);
    if (j) JSON.parse(j).forEach((t) => customTargets.push(t));
  } catch (e) { console.warn("custom targets unavailable:", e); }
}
function saveCustomTargets() {
  try { localStorage.setItem(CT_KEY, JSON.stringify(customTargets)); }
  catch (e) { console.warn("could not save custom targets:", e); }
}
function allTargets() { return TARGETS.concat(customTargets); }

// Resolve a name to {ra, dec, kind} via CDS Sesame (SIMBAD/NED/VizieR).
function resolveByName(name) {
  const u = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oIF/SNV?" + encodeURIComponent(name);
  return fetch(u).then((r) => {
    if (!r.ok) throw new Error("resolver HTTP " + r.status);
    return r.text();
  }).then((txt) => {
    const m = txt.match(/%J\s+([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)/);
    if (!m) throw new Error("not found");
    const ra = parseFloat(m[1]), dec = parseFloat(m[2]);
    let kind = "neb";
    const cm = txt.match(/%C\.0\s+(\S+)/);
    if (cm) {
      const t = cm[1];
      if (/^G/.test(t)) kind = "galaxy";
      else if (/PN/.test(t)) kind = "pn";
      else if (/Dk|DNe/.test(t)) kind = "dark";
    }
    return { ra, dec, kind };
  });
}

/* ---- User object images (optional, per target) ---------------------------
 * Each target may have a user-supplied photo that replaces the schematic blob.
 * Stored offline in IndexedDB so it survives relaunch with no network.
 * In-memory mirror (targetName -> {dataUrl, fovWDeg, aspect}) is read
 * synchronously by the renderer; IndexedDB is the durable backing store.
 *   fovWDeg : how wide the image is on the sky, in degrees (user-set)
 *   aspect  : image height / width (from the file's pixels), so height in
 *             degrees = fovWDeg * aspect.
 * ------------------------------------------------------------------------- */
const targetImages = new Map();
const IDB_NAME = "fovPlanner", IDB_STORE = "images", IMG_MAXPX = 1600;

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbReq(makeReq) {
  return idbOpen().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = makeReq(tx.objectStore(IDB_STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
async function loadAllImages() {
  if (!("indexedDB" in window)) return;
  try {
    const db = await idbOpen();
    await new Promise((res) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const keys = store.getAllKeys(), vals = store.getAll();
      tx.oncomplete = () => {
        keys.result.forEach((k, i) => targetImages.set(k, vals.result[i]));
        res();
      };
    });
  } catch (e) { console.warn("image store unavailable:", e); }
}
function saveImage(name, rec) {
  targetImages.set(name, rec);
  idbReq((s) => s.put(rec, name)).catch((e) => console.warn("save failed:", e));
}
function deleteImage(name) {
  targetImages.delete(name);
  idbReq((s) => s.delete(name)).catch((e) => console.warn("delete failed:", e));
}

// Read a picked file, downscale to <= IMG_MAXPX on the long edge, re-encode
// as JPEG to keep storage small and rendering fast. Returns {dataUrl, aspect}.
function processFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, IMG_MAXPX / Math.max(w, h));
        const cw = Math.round(w * scale), ch = Math.round(h * scale);
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        res({ dataUrl: c.toDataURL("image/jpeg", 0.85), aspect: h / w });
      };
      img.onerror = rej;
      img.src = reader.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

/* Fetch a real survey cutout via CDS hips2fits. We request a SQUARE image at a
 * field width we choose, so the on-sky scale is known by construction (no
 * plate-solving). Returns a data URL. Needs network at fetch time; the result
 * is then cached in IndexedDB for offline use. */
const HIPS_ENDPOINT = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits";
const SURVEY_PX = 1000;            // square cutout edge, in pixels
function fetchSurveyImage(target, hips, fovDeg) {
  const u = new URL(HIPS_ENDPOINT);
  u.search = new URLSearchParams({
    hips, width: SURVEY_PX, height: SURVEY_PX, fov: fovDeg,
    projection: "TAN", coordsys: "icrs",
    ra: target.ra, dec: target.dec, format: "jpg"
  }).toString();
  return fetch(u.toString()).then((r) => {
    if (!r.ok) throw new Error("survey HTTP " + r.status);
    return r.blob();
  }).then((blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  }));
}

// Suggested fetch field width: 1.5x the object's long axis, so it sits with
// margin and you can slide a sensor around it.
function suggestedFov(target) {
  return Math.max(0.1, Math.round(Math.max(target.wDeg, target.hDeg) * 1.5 * 100) / 100);
}

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
  rebuildTargetSelect();
  tgt.addEventListener("change", () => { targetIdx = +tgt.value; render(); });

  // Find object by name (CDS Sesame).
  const input = $("findInput"), btn = $("findBtn"), status = $("findStatus");
  const doFind = () => {
    const name = input.value.trim();
    if (!name) return;
    // If we already have this custom target, just select it.
    const existing = customTargets.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) {
      targetIdx = TARGETS.length + existing;
      $("targetSelect").value = targetIdx;
      status.textContent = `Selected existing “${name}”.`;
      render();
      return;
    }
    btn.disabled = true; status.textContent = `Resolving “${name}”…`;
    resolveByName(name).then(({ ra, dec, kind }) => {
      customTargets.push({ name, ra, dec, wDeg: 1.0, hDeg: 1.0, kind, custom: true });
      saveCustomTargets();
      rebuildTargetSelect();
      targetIdx = allTargets().length - 1;
      $("targetSelect").value = targetIdx;
      input.value = "";
      status.textContent =
        `Found “${name}” at RA ${ra.toFixed(3)}°, Dec ${dec.toFixed(3)}°. ` +
        `Set its approx size below, then fetch a sky image.`;
      render();
    }).catch((e) => {
      console.warn("resolve failed:", e);
      status.textContent =
        `Couldn't resolve “${name}” — check the name, or your connection ` +
        `(name resolution needs network).`;
    }).finally(() => { btn.disabled = false; });
  };
  btn.addEventListener("click", doFind);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doFind(); });
}

// (Re)build the Target dropdown from seeded + custom targets, preserving the
// current selection index.
function rebuildTargetSelect() {
  const tgt = $("targetSelect");
  const keep = targetIdx;
  tgt.innerHTML = "";
  allTargets().forEach((t, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = t.custom ? `★ ${t.name}` : t.name;
    tgt.appendChild(o);
  });
  if (keep < allTargets().length) { targetIdx = keep; tgt.value = keep; }
}

/* ---- Legend (camera toggles) ---------------------------------------------- */
function renderLegend(scope, focalMM) {
  const wrap = $("legend");
  wrap.innerHTML = "";
  camsForScope(scope).forEach(({ cam, i }) => {
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

  // Enabled camera FOVs (deg), limited to cameras valid for this scope.
  const cams = camsForScope(scope)
    .filter(({ i }) => enabled.get(i))
    .map(({ cam, i }) => ({ cam, i, color: camColor(i), fov: camFov(cam, focalMM) }));

  const circleDeg = angularDeg(scope.imageCircle, focalMM);

  // Optional user/survey image for this target.
  const img = targetImages.get(target.name);
  const imgW = img ? img.fovWDeg : 0;
  const imgH = img ? img.fovWDeg * img.aspect : 0;

  // Framing offset (deg): the scope (image circle + sensor frames) slides over
  // the fixed sky so you can hunt the best composition. +offX right, +offY up.
  const offX = img && img.offX ? img.offX : 0;
  const offY = img && img.offY ? img.offY : 0;

  // Auto-zoom: fit the fixed sky {image, target} AND the offset optics
  // {image circle, every enabled frame} with ~6% margin. Computed per-axis.
  let halfX = Math.max(target.wDeg / 2, imgW / 2, Math.abs(offX) + circleDeg / 2);
  let halfY = Math.max(target.hDeg / 2, imgH / 2, Math.abs(offY) + circleDeg / 2);
  cams.forEach((c) => {
    halfX = Math.max(halfX, Math.abs(offX) + c.fov.w / 2);
    halfY = Math.max(halfY, Math.abs(offY) + c.fov.h / 2);
  });
  const halfSpanDeg = Math.max(halfX, halfY) / 0.94;   // 6% margin, square frame
  const pxPerDeg = (VB / 2) / halfSpanDeg;             // deg -> viewBox px
  lastPxPerDeg = pxPerDeg;                             // cache for drag-to-pan

  const D = (deg) => deg * pxPerDeg;                   // full extent in px
  const fx = cx + D(offX), fy = cy - D(offY);          // offset optics centre

  // Only intercept touch (disable page scroll over the diagram) when there's
  // an image to pan; otherwise let the page scroll normally.
  svg.style.touchAction = img ? "none" : "auto";
  svg.style.cursor = img ? "grab" : "default";

  if (img) {
    // --- real photo backdrop (replaces schematic + synthetic stars) ---
    const w = D(imgW), h = D(imgH);
    svg.appendChild(svgEl("image", {
      id: "skyImage",
      href: img.dataUrl, x: cx - w / 2, y: cy - h / 2, width: w, height: h,
      preserveAspectRatio: "xMidYMid meet", opacity: 0.96,
      style: "filter: brightness(" + (img.bright || 1) + ")"
    }));
  } else {
    // --- synthetic backdrop: seeded field stars + schematic blob ---
    const rnd = mulberry32(STAR_SEED);
    const starG = svgEl("g", {});
    for (let s = 0; s < 14; s++) {
      const x = rnd() * VB, y = rnd() * VB;
      const r = 1.2 + rnd() * 2.3;
      const op = 0.18 + rnd() * 0.35;
      starG.appendChild(svgEl("circle", { cx: x, cy: y, r, fill: "#cdd6e3", opacity: op.toFixed(3) }));
    }
    svg.appendChild(starG);
    svg.appendChild(drawTarget(target, cx, cy, D));
  }

  // Overlays are dimmed by ~half when a photo is present, so they don't bury
  // a faint backdrop; full strength over the schematic.
  const circleOp = img ? 0.45 : 0.9;
  const strokeOp = img ? 0.5 : 0.95;
  const fillOp = img ? 0.03 : 0.06;

  // --- image circle (dashed grey) — moves with the optics (fx, fy) ---
  svg.appendChild(svgEl("circle", {
    cx: fx, cy: fy, r: D(circleDeg) / 2,
    fill: "none", stroke: "#7f8aa0", "stroke-width": 2.2,
    "stroke-dasharray": "10 9", opacity: circleOp
  }));

  // --- camera rectangles: largest area first so smaller layer on top ---
  const ordered = cams.slice().sort((a, b) =>
    (b.fov.w * b.fov.h) - (a.fov.w * a.fov.h));
  ordered.forEach(({ color, fov }) => {
    const w = D(fov.w), h = D(fov.h);
    svg.appendChild(svgEl("rect", {
      x: fx - w / 2, y: fy - h / 2, width: w, height: h,
      rx: 4, fill: color, "fill-opacity": fillOp,
      stroke: color, "stroke-width": 2.6, "stroke-opacity": strokeOp
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
  camsForScope(scope).forEach(({ cam }) => {
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
function renderVerdict(scope, target, focalMM) {
  const el = $("verdict");
  const active = camsForScope(scope)
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

/* ---- Image panel: fetch a real survey image / upload one / frame it ------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderImagePanel(target) {
  const wrap = $("imagePanel");
  wrap.innerHTML = "";
  wrap.appendChild(el("div", "img-head", "Object image"));

  const rec = targetImages.get(target.name);
  const hasCoords = typeof target.ra === "number" && typeof target.dec === "number";

  // Hidden file input shared by Upload / Replace.
  const file = el("input");
  file.type = "file"; file.accept = "image/*"; file.style.display = "none";
  file.addEventListener("change", async () => {
    if (!file.files || !file.files[0]) return;
    try {
      const { dataUrl, aspect } = await processFile(file.files[0]);
      const prev = targetImages.get(target.name);
      saveImage(target.name, {
        dataUrl, aspect,
        fovWDeg: prev ? prev.fovWDeg : target.wDeg,
        source: "upload", offX: 0, offY: 0,
        bright: prev && prev.bright ? prev.bright : 1
      });
      render();
    } catch (e) {
      console.warn("could not load image:", e);
      alert("Could not read that image.");
    }
    file.value = "";
  });
  wrap.appendChild(file);

  // --- Fetch from a sky survey (needs coordinates) ---
  if (hasCoords) {
    const box = el("div", "img-fetch");

    const surveyField = el("label", "img-field");
    surveyField.appendChild(el("span", null, "Sky survey"));
    const sel = el("select");
    SURVEYS.forEach((s, i) => {
      const o = el("option", null, s.name); o.value = i; sel.appendChild(o);
    });
    surveyField.appendChild(sel);
    box.appendChild(surveyField);

    const fovField = el("label", "img-field");
    fovField.appendChild(el("span", null, "Field width (°)"));
    const fov = el("input");
    fov.type = "number"; fov.min = "0.05"; fov.step = "0.1"; fov.inputMode = "decimal";
    fov.value = rec && rec.source === "survey" ? round2(rec.fovWDeg) : suggestedFov(target);
    fovField.appendChild(fov);
    box.appendChild(fovField);

    const go = el("button", "img-btn primary", "Fetch sky image");
    go.addEventListener("click", async () => {
      const v = parseFloat(fov.value);
      if (!isFinite(v) || v <= 0) { alert("Enter a field width in degrees."); return; }
      const survey = SURVEYS[+sel.value];
      go.disabled = true; go.textContent = "Fetching…";
      try {
        const dataUrl = await fetchSurveyImage(target, survey.hips, v);
        saveImage(target.name, {
          dataUrl, aspect: 1, fovWDeg: v,
          source: "survey", survey: survey.name, offX: 0, offY: 0,
          bright: 2.0   // survey cutouts are dim; start brightened
        });
        render();
      } catch (e) {
        console.warn("survey fetch failed:", e);
        alert("Couldn't fetch the survey image — you need a network connection " +
              "for this step. (" + e.message + ")");
        go.disabled = false; go.textContent = "Fetch sky image";
      }
    });
    box.appendChild(go);
    wrap.appendChild(box);
  }

  // --- Upload your own ---
  const up = el("button", "img-btn", rec ? "Replace with your own photo" : "Upload your own photo");
  up.addEventListener("click", () => file.click());
  wrap.appendChild(up);

  if (!rec) {
    wrap.appendChild(el("p", "img-hint",
      hasCoords
        ? "Fetch a real survey image centred on this object at a field width you " +
          "choose — the scale is known because you set it. Or upload your own."
        : "No coordinates for this target, so survey fetch is off. Upload a photo " +
          "and set its on-sky width, or add ra/dec in data.js to enable fetch."));
    return;
  }

  // --- Current image controls ---
  const label = rec.source === "survey" ? (rec.survey || "survey image") : "uploaded photo";
  wrap.appendChild(el("p", "img-hint",
    `Showing: ${label} · ${round2(rec.fovWDeg)}° × ${round2(rec.fovWDeg * rec.aspect)}° on sky.`));

  // Brightness slider — live, persisted. Survey cutouts (esp. dark nebulae like
  // the Shark) are dim under the overlays; this lifts them. Updates the image
  // filter directly (no panel rebuild) so dragging the slider stays smooth.
  const bField = el("label", "img-field");
  bField.appendChild(el("span", null, "Image brightness"));
  const bRow = el("div", "bright-row");
  const slider = el("input");
  slider.type = "range"; slider.min = "1"; slider.max = "4"; slider.step = "0.1";
  slider.value = String(rec.bright || 1);
  const bVal = el("span", "bright-val", (rec.bright || 1).toFixed(1) + "×");
  slider.addEventListener("input", () => {
    const v = parseFloat(slider.value);
    const cur = targetImages.get(target.name);
    if (cur) cur.bright = v;
    const node = document.getElementById("skyImage");
    if (node) node.style.filter = "brightness(" + v + ")";
    bVal.textContent = v.toFixed(1) + "×";
  });
  slider.addEventListener("change", () => {
    const cur = targetImages.get(target.name);
    if (cur) saveImage(target.name, cur);     // persist on release
  });
  bRow.appendChild(slider);
  bRow.appendChild(bVal);
  bField.appendChild(bRow);
  wrap.appendChild(bField);

  // Width editor (uploaded photos rescale freely; survey fields change by re-fetch).
  if (rec.source !== "survey") {
    const wf = el("label", "img-field");
    wf.appendChild(el("span", null, "Image field width (°)"));
    const num = el("input");
    num.type = "number"; num.min = "0.01"; num.step = "0.01"; num.inputMode = "decimal";
    num.value = round2(rec.fovWDeg);
    num.addEventListener("change", () => {
      const v = parseFloat(num.value);
      if (!isFinite(v) || v <= 0) { num.value = round2(rec.fovWDeg); return; }
      saveImage(target.name, Object.assign({}, rec, { fovWDeg: v }));
      render();
    });
    wf.appendChild(num);
    wrap.appendChild(wf);
  }

  // Framing nudge — slide the sensor/optics over the fixed sky.
  wrap.appendChild(el("span", "img-sublabel", "Drag on the image to move the frame, or nudge:"));
  const step = rec.fovWDeg * 0.1;
  const nudge = (dx, dy) => () => {
    const cur = targetImages.get(target.name);
    saveImage(target.name, Object.assign({}, cur, {
      offX: (cur.offX || 0) + dx * step,
      offY: (cur.offY || 0) + dy * step
    }));
    render();
  };
  const pad = el("div", "img-pad");
  const mk = (txt, fn, cls) => { const b = el("button", "nudge" + (cls ? " " + cls : ""), txt); b.addEventListener("click", fn); return b; };
  pad.appendChild(el("span"));                              // grid spacer
  pad.appendChild(mk("▲", nudge(0, 1)));
  pad.appendChild(el("span"));
  pad.appendChild(mk("◀", nudge(-1, 0)));
  pad.appendChild(mk("◎", () => { const c = targetImages.get(target.name); saveImage(target.name, Object.assign({}, c, { offX: 0, offY: 0 })); render(); }, "center"));
  pad.appendChild(mk("▶", nudge(1, 0)));
  pad.appendChild(el("span"));
  pad.appendChild(mk("▼", nudge(0, -1)));
  pad.appendChild(el("span"));
  wrap.appendChild(pad);

  const remove = el("button", "img-btn danger", "Remove image");
  remove.addEventListener("click", () => { deleteImage(target.name); render(); });
  wrap.appendChild(remove);
}

/* ---- Custom-target editor (size + delete; only for ★ resolved targets) ---- */
function renderCustomPanel(target) {
  const wrap = $("customPanel");
  wrap.innerHTML = "";
  if (!target.custom) { wrap.hidden = true; return; }
  wrap.hidden = false;

  wrap.appendChild(el("div", "img-head", "Custom object — approximate size"));

  const sizeFn = (key, labelText) => {
    const f = el("label", "img-field");
    f.appendChild(el("span", null, labelText));
    const num = el("input");
    num.type = "number"; num.min = "0.01"; num.step = "0.01"; num.inputMode = "decimal";
    num.value = round2(target[key]);
    num.addEventListener("change", () => {
      const v = parseFloat(num.value);
      if (!isFinite(v) || v <= 0) { num.value = round2(target[key]); return; }
      target[key] = v; saveCustomTargets(); render();
    });
    f.appendChild(num);
    return f;
  };
  const row = el("div", "size-row");
  row.appendChild(sizeFn("wDeg", "Width (°)"));
  row.appendChild(sizeFn("hDeg", "Height (°)"));
  wrap.appendChild(row);

  wrap.appendChild(el("p", "img-hint",
    "Sesame gives coordinates, not size — set a rough size for the fit verdict, " +
    "or just fetch a sky image and judge framing visually."));

  const del = el("button", "img-btn danger", "Delete this target");
  del.addEventListener("click", () => {
    const idx = customTargets.indexOf(target);
    if (idx < 0) return;
    deleteImage(target.name);          // drop any cached image too
    customTargets.splice(idx, 1);
    saveCustomTargets();
    targetIdx = 0;                     // fall back to first seeded target
    rebuildTargetSelect();
    $("targetSelect").value = 0;
    $("findStatus").textContent = "";
    render();
  });
  wrap.appendChild(del);
}

/* ---- Drag-to-pan the frame on the diagram (touch / mouse / pencil) --------
 * Pointer Events give one code path for all input types. Dragging sets the
 * same offX/offY the nudge pad uses, so the frame follows your finger over a
 * fixed sky image. Active only when the current target has an image. */
function setupDiagramDrag() {
  const svg = $("diagram");
  let dragging = false, pid = null, sx = 0, sy = 0, sOffX = 0, sOffY = 0;
  let rec = null, target = null;

  svg.addEventListener("pointerdown", (e) => {
    target = allTargets()[targetIdx];
    rec = targetImages.get(target.name);
    if (!rec) return;                       // nothing to pan without an image
    dragging = true; pid = e.pointerId;
    sx = e.clientX; sy = e.clientY;
    sOffX = rec.offX || 0; sOffY = rec.offY || 0;
    try { svg.setPointerCapture(pid); } catch (_) {}
    svg.style.cursor = "grabbing";
    e.preventDefault();
  });

  svg.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pid) return;
    const rect = svg.getBoundingClientRect();
    const scale = 1000 / rect.width;        // viewBox units per CSS pixel
    const dDegX = ((e.clientX - sx) * scale) / lastPxPerDeg;
    const dDegY = ((e.clientY - sy) * scale) / lastPxPerDeg;
    rec.offX = sOffX + dDegX;               // frame follows finger
    rec.offY = sOffY - dDegY;               // screen-down => frame down
    const scope = SCOPES[configIdx];
    renderDiagram(scope, target, scope.focalLength);   // redraw diagram only
  });

  const end = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    try { svg.releasePointerCapture(pid); } catch (_) {}
    svg.style.cursor = "grab";
    if (rec) saveImage(target.name, rec);   // persist final offset to IndexedDB
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
}

/* ---- Master render -------------------------------------------------------- */
function render() {
  const scope = SCOPES[configIdx];
  const target = allTargets()[targetIdx] || allTargets()[0];
  const focalMM = scope.focalLength;

  renderLegend(scope, focalMM);
  renderCustomPanel(target);
  renderDiagram(scope, target, focalMM);
  renderImagePanel(target);
  renderCards(scope, target, focalMM);
  renderVerdict(scope, target, focalMM);
}

/* ---- Boot ----------------------------------------------------------------- */
const verEl = $("ver");
if (verEl) verEl.textContent = APP_VERSION;
loadCustomTargets();
initSelectors();
setupDiagramDrag();
render();                          // paint immediately with schematics
loadAllImages().then(render);      // then re-render once stored photos load
