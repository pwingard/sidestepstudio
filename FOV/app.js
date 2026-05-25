/* =============================================================================
 * app.js — math, rendering, and event wiring for the FOV Planner.
 * Reads SCOPES / TARGETS / SURVEYS from data.js and the camera/sensor table
 * (CAMERA_DB) from cameras.js. No framework, no build step.
 * ============================================================================= */

"use strict";

const APP_VERSION = "v19";   // shown in the title bar; bump with sw.js CACHE_VERSION
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

/* ---- Palette: one colour per active camera frame (cycled if list grows) --- */
const CAM_COLORS = ["#6db3f2", "#57d18a", "#f2b84b", "#c887f0", "#f2785c"];
function camColor(i) { return CAM_COLORS[i % CAM_COLORS.length]; }

/* ---- Smart scopes: sealed all-in-one scope + camera units ----------------
 * Each carries a FIXED focal length and a sensor key that joins into
 * CAMERA_DB.sensors. Selecting one in the Smart-scope dropdown adds a LOCKED
 * compare entry (camFromSensorKey + this focalMM). Specs below are web-verified
 * (focal length + sensor model); units whose sensor isn't in CAMERA_DB are
 * skipped at build time. These are NOT the same as the Askar focal-length
 * shortcuts in the #focalInput datalist.
 * ------------------------------------------------------------------------- */
const SMART_SCOPES = [
  { name: "Celestron Origin",        focalMM: 335, sensor: "IMX678" }, // RASA 6", f/2.2
  { name: "ZWO Seestar S50",         focalMM: 250, sensor: "IMX462" }, // 50mm f/5
  { name: "ZWO Seestar S30",         focalMM: 150, sensor: "IMX662" }, // 30mm f/5
  { name: "Vaonis Vespera",          focalMM: 200, sensor: "IMX462" }, // 50mm f/4
  { name: "Vaonis Vespera II",       focalMM: 250, sensor: "IMX585" }, // 50mm f/5
  { name: "DwarfLab Dwarf 3",        focalMM: 150, sensor: "IMX678" }, // 35mm tele f/4.3
  { name: "Unistellar eVscope eQuinox", focalMM: 450, sensor: "IMX224" }, // 114mm f/4
];

/* ---- Camera model -> internal cam object ---------------------------------
 * The renderer/cards/verdict expect a cam shaped like:
 *   { name, wMM, hMM, pixelMicron|null, mp|null, format }
 * We build these on the fly from CAMERA_DB (sensors joined to models) or from
 * the Custom width/height inputs. pixelMicron may be null for generic formats
 * (Full Frame, APS-C, …) — the sampling card is hidden in that case.
 * ------------------------------------------------------------------------- */
function camFromSensorKey(name, sensorKey) {
  const s = CAMERA_DB.sensors[sensorKey];
  if (!s) return null;
  return {
    name,
    wMM: s.width_mm,
    hMM: s.height_mm,
    pixelMicron: (typeof s.pixel_um === "number") ? s.pixel_um : null,
    mp: (typeof s.megapixels === "number") ? s.megapixels : null,
    format: s.format || sensorKey,
  };
}

/* ---- State ---------------------------------------------------------------- */
// Active compare list. Each entry is one camera being overlaid/judged:
//   { key, cam, focalMM, locked }
// where `cam` is a cam object (see camFromSensorKey) and `key` is a stable
// dedupe id derived from the <select> value (e.g. "model:42", "sensor:IMX571",
// or "custom:36x24"). The frame colour is the entry's index in this list,
// via camColor(i) — so removing one re-flows colours but stays consistent.
//   focalMM : this camera's OWN focal length. Normal adds inherit the top
//             #focalInput value at add-time and stay user-editable per chip.
//   locked  : true for a smart-scope add (sealed scope+camera). Its focal
//             length is fixed and shown read-only with a lock indicator.
const activeList = [];
const MAX_CAMS = CAM_COLORS.length;   // cap = palette size (5)

// When the camera <select> value is "custom", we synthesise from custom W/H.
let customCam = { name: "Custom sensor", wMM: 36, hMM: 24, pixelMicron: null, mp: null, format: "Custom" };
let isCustom = false;

let focalMM = 335;           // DEFAULT focal length for the next camera added (mm)
let imageCircleMM = 43.3;    // advanced: dashed coverage circle diameter (mm)
let apertureMM = null;       // advanced: optional, enables f-ratio when set

let targetIdx = 0;
let lastPxPerDeg = 1;   // deg->viewBox scale from the last diagram render (for drag)

// ---- Zoom (applied as a CSS transform on the <svg>, on top of the auto-fit
// viewBox). zoom=1 == auto-fit. panX/panY are in CSS pixels of the stage and
// shift the scaled diagram so we can zoom toward a focal point. ----
let zoom = 1, panX = 0, panY = 0;
const ZOOM_MIN = 1, ZOOM_MAX = 12;

// The active cameras paired with their overlay colour + own focal length, for
// the render code. Each item: { cam, color, focalMM }.
function activeCams() {
  return activeList.map((e, i) => ({ cam: e.cam, color: camColor(i), focalMM: e.focalMM }));
}

// Add a camera (cam object + dedupe key) to the compare list. No duplicates,
// capped at MAX_CAMS. Returns true if it was added.
//   fMM   : the focal length this camera is shot at. Defaults to the current
//           top-level `focalMM` (the "default for next added").
//   locked: true for sealed smart-scope units (focal length not editable).
function addCam(key, cam, fMM, locked) {
  if (!cam) return false;
  if (activeList.length >= MAX_CAMS) return false;
  if (activeList.some((e) => e.key === key)) return false;
  activeList.push({
    key, cam,
    focalMM: (isFinite(fMM) && fMM > 0) ? fMM : focalMM,
    locked: !!locked,
  });
  return true;
}
function removeCamAt(i) {
  if (i >= 0 && i < activeList.length) activeList.splice(i, 1);
}

// Synthetic scope-shaped object so renderDiagram/renderCards/renderVerdict need
// minimal change from the old per-config code.
function currentScope() {
  return {
    name: "scope",
    focalLength: focalMM,
    imageCircle: imageCircleMM,
    fRatio: (apertureMM && apertureMM > 0) ? (focalMM / apertureMM) : null,
  };
}

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

/* ---- Build the Camera dropdown ------------------------------------------- *
 * Option values encode how to resolve the camera:
 *   "model:<index into CAMERA_DB.models>"  -> join sensor, label MODEL (FORMAT)
 *   "sensor:<KEY>"                          -> a generic sensor format directly
 *   "custom"                                -> reveal custom W/H inputs
 * Groups: My gear, Sensor formats, then one optgroup per brand.
 * ------------------------------------------------------------------------- */
const BRAND_ORDER = ["ZWO", "QHY", "Player One", "Altair Astro", "SVBony", "ToupTek", "Atik"];

// Pin a few owned rigs to "My gear" by brand+model match.
const MY_GEAR = [
  { brand: "ZWO", model: "ASI533MC Pro" },
  { brand: "ZWO", model: "ASI2600MC Pro" },
  { brand: "ZWO", model: "ASI6200MC Pro" },
];

function modelIndex(brand, model) {
  return CAMERA_DB.models.findIndex((m) => m.brand === brand && m.model === model);
}
function modelLabel(m) {
  const s = CAMERA_DB.sensors[m.sensor];
  const fmt = s && s.format ? s.format : m.sensor;
  return `${m.model} (${fmt})`;
}

// Case-insensitive match of a model against a search query, testing brand,
// model name, sensor format, and the bare sensor key (so "IMX571", "2600",
// "full frame", or "qhy" all work).
function camMatchesQuery(m, q) {
  if (!q) return true;
  const s = CAMERA_DB.sensors[m.sensor];
  const fmt = s && s.format ? s.format : "";
  return (m.brand + " " + m.model + " " + fmt + " " + m.sensor).toLowerCase().includes(q);
}

// Build the camera <select>, optionally filtered by a search query. Empty
// groups are skipped; the Custom entry is always present. Native select is
// rebuilt (rather than hiding <option>s, which iOS ignores).
function buildCameraSelect(query) {
  const q = (query || "").trim().toLowerCase();
  const sel = $("cameraSelect");
  sel.innerHTML = "";
  const grp = (label) => { const g = document.createElement("optgroup"); g.label = label; sel.appendChild(g); return g; };
  const opt = (parent, value, text) => {
    const o = document.createElement("option");
    o.value = value; o.textContent = text; parent.appendChild(o); return o;
  };
  let matches = 0;

  // My gear (pinned) — only entries matching the query.
  const mine = MY_GEAR
    .map(({ brand, model }) => modelIndex(brand, model))
    .filter((idx) => idx >= 0 && camMatchesQuery(CAMERA_DB.models[idx], q));
  if (mine.length) {
    const gMine = grp("My gear");
    mine.forEach((idx) => { opt(gMine, "model:" + idx, modelLabel(CAMERA_DB.models[idx]) + " — mine"); matches++; });
  }

  // Generic sensor formats (match against label + key).
  const fmts = [
    ["FULLFRAME_35MM", "Full Frame (36 x 24)"],
    ["APS-C", "APS-C (23.6 x 15.7)"],
    ["MICRO_FOURTHIRDS", "Micro 4/3 (17.3 x 13)"],
    ["IMX183", "1\" (13.2 x 8.8)"],
  ].filter(([key, label]) => CAMERA_DB.sensors[key] && (!q || (label + " " + key).toLowerCase().includes(q)));
  if (fmts.length) {
    const gFmt = grp("Sensor formats");
    fmts.forEach(([key, label]) => { opt(gFmt, "sensor:" + key, label); matches++; });
  }

  // One optgroup per brand; skip brands with no matches.
  const byBrand = new Map();
  CAMERA_DB.models.forEach((m, i) => {
    if (!byBrand.has(m.brand)) byBrand.set(m.brand, []);
    byBrand.get(m.brand).push(i);
  });
  const brands = BRAND_ORDER.filter((b) => byBrand.has(b))
    .concat([...byBrand.keys()].filter((b) => !BRAND_ORDER.includes(b)));
  brands.forEach((b) => {
    const hits = byBrand.get(b)
      .filter((i) => camMatchesQuery(CAMERA_DB.models[i], q))
      .sort((a, c) => CAMERA_DB.models[a].model.localeCompare(CAMERA_DB.models[c].model));
    if (!hits.length) return;
    const g = grp(b);
    hits.forEach((i) => { opt(g, "model:" + i, modelLabel(CAMERA_DB.models[i])); matches++; });
  });

  // No matches: a disabled hint so the box isn't just "Custom".
  if (q && matches === 0) {
    const o = opt(sel, "", "No cameras match “" + query.trim() + "”");
    o.disabled = true;
  }

  // Custom entry always available, last.
  const gCustom = grp("Custom");
  opt(gCustom, "custom", "Custom (enter W x H)…");

  return sel;
}

// Toggle the custom W/H fields when "custom" is picked in the <select>.
function applyCameraSelection(value) {
  isCustom = (value === "custom");
  $("customCamFields").hidden = !isCustom;
}

// Resolve a <select> value into a { key, cam } pair to add to the compare list.
// "custom" reads the current custom W/H inputs. Returns null if unresolvable.
function camFromSelectValue(value) {
  if (value === "custom") {
    return {
      key: `custom:${customCam.wMM}x${customCam.hMM}`,
      cam: Object.assign({}, customCam),   // snapshot so later edits don't mutate it
    };
  }
  if (value.startsWith("model:")) {
    const m = CAMERA_DB.models[+value.slice(6)];
    return m
      ? { key: value, cam: camFromSensorKey(`${m.brand} ${m.model}`, m.sensor) }
      : null;
  }
  if (value.startsWith("sensor:")) {
    const key = value.slice(7);
    const s = CAMERA_DB.sensors[key];
    return { key: value, cam: camFromSensorKey(s && s.format ? s.format : key, key) };
  }
  return null;
}

/* ---- Populate dropdowns --------------------------------------------------- */
function initSelectors() {
  // Camera dropdown.
  const cam = buildCameraSelect();
  // Default selection = first My-gear entry (ASI533) if present, else first option.
  const firstMine = $("cameraSelect").querySelector("optgroup[label='My gear'] option");
  cam.value = firstMine ? firstMine.value : cam.options[0].value;
  applyCameraSelection(cam.value);                 // toggle custom fields only
  // Selecting a camera no longer adds it — the explicit Add button does.
  cam.addEventListener("change", () => { applyCameraSelection(cam.value); });

  // Search box filters the dropdown (rebuilds it with matches only). Keeps the
  // current pick if it survives the filter, else selects the first match.
  const search = $("cameraSearch");
  search.addEventListener("input", () => {
    const prev = cam.value;
    buildCameraSelect(search.value);
    const stillThere = [...cam.options].some((o) => o.value === prev && !o.disabled);
    cam.value = stillThere ? prev
              : (([...cam.options].find((o) => o.value && o.value !== "custom" && !o.disabled) || cam.options[0]).value);
    applyCameraSelection(cam.value);
  });

  // Seed the compare list with one camera by default (ASI533).
  const seed = camFromSelectValue(cam.value);
  if (seed) addCam(seed.key, seed.cam);

  // "Add" button — append the currently selected camera to the compare list.
  const addBtn = $("addCamBtn");
  const refreshAddState = () => {
    addBtn.disabled = activeList.length >= MAX_CAMS;
    addBtn.textContent = activeList.length >= MAX_CAMS ? "Full" : "Add";
  };
  addBtn.addEventListener("click", () => {
    const picked = camFromSelectValue(cam.value);
    if (picked) addCam(picked.key, picked.cam);
    refreshAddState();
    render();
  });

  // Custom sensor W/H — just keep customCam current; Add snapshots it.
  const cw = $("customW"), ch = $("customH");
  const syncCustom = () => {
    const w = parseFloat(cw.value), h = parseFloat(ch.value);
    if (isFinite(w) && w > 0) customCam.wMM = w;
    if (isFinite(h) && h > 0) customCam.hMM = h;
  };
  cw.addEventListener("change", syncCustom);
  ch.addEventListener("change", syncCustom);

  // Default focal length input — this is the focal length the NEXT added
  // camera will inherit (not a global override of existing chips).
  const focal = $("focalInput");
  focal.value = String(focalMM);
  const applyFocal = () => {
    const v = parseFloat(focal.value);
    // Only the default + the image-circle guide depend on this; per-camera
    // chips keep their own focal length, so a redraw refreshes the guide.
    if (isFinite(v) && v >= 50 && v <= 4000) { focalMM = v; render(); }
  };
  focal.addEventListener("change", applyFocal);
  focal.addEventListener("input", applyFocal);

  // Smart scopes — sealed all-in-one scope+camera units. Selecting one ADDS a
  // locked compare entry carrying that unit's sensor (joined from CAMERA_DB)
  // AND its fixed focal length. Specs are web-verified (see SMART_SCOPES).
  const rig = $("rigPreset");
  const ropt = (value, text) => { const o = document.createElement("option"); o.value = value; o.textContent = text; rig.appendChild(o); return o; };
  ropt("", "Choose a smart scope…");
  SMART_SCOPES.forEach((s, i) => {
    if (!CAMERA_DB.sensors[s.sensor]) return;   // skip if its sensor is unknown
    ropt("smart:" + i, `${s.name} — ${s.focalMM}mm (${s.sensor})`);
  });
  rig.addEventListener("change", () => {
    const v = rig.value;
    rig.value = "";                         // reset to placeholder (one-tap action)
    if (!v || !v.startsWith("smart:")) return;
    const s = SMART_SCOPES[+v.slice(6)];
    if (!s) return;
    const cam = camFromSensorKey(s.name, s.sensor);
    if (cam) addCam("smart:" + s.name, cam, s.focalMM, true);
    refreshAddState();
    render();
  });

  // Advanced: image circle + aperture.
  const circ = $("circleInput");
  circ.value = String(imageCircleMM);
  circ.addEventListener("change", () => {
    const v = parseFloat(circ.value);
    if (isFinite(v) && v > 0) { imageCircleMM = v; render(); }
  });
  const ap = $("apertureInput");
  ap.addEventListener("change", () => {
    const v = parseFloat(ap.value);
    apertureMM = (isFinite(v) && v > 0) ? v : null;
    render();
  });

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

/* ---- Active-cameras list (compare chips, each removable) ------------------ */
function renderCamInfo(scope, focalMM) {
  const wrap = $("camInfo");
  wrap.innerHTML = "";

  // Keep the Add button in sync (re-enable after a removal frees a slot).
  const addBtn = $("addCamBtn");
  if (addBtn) {
    addBtn.disabled = activeList.length >= MAX_CAMS;
    addBtn.textContent = activeList.length >= MAX_CAMS ? "Full" : "Add";
  }

  if (activeList.length === 0) {
    wrap.appendChild(el("p", "img-hint", "No cameras yet — pick one above and tap Add."));
    return;
  }

  activeList.forEach((entry, i) => {
    const cam = entry.cam;
    const color = camColor(i);
    const fov = camFov(cam, entry.focalMM);

    const row = document.createElement("div");
    row.className = "cam";

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.color = color;
    sw.style.background = color;

    const main = document.createElement("div");
    main.className = "cam-main";
    const name = document.createElement("div");
    name.className = "cam-name";
    name.textContent = cam.name;
    if (cam.format) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = cam.format;
      name.appendChild(b);
    }
    const dims = `${round2(cam.wMM)} × ${round2(cam.hMM)} mm`;
    const fovEl = document.createElement("div");
    fovEl.className = "cam-fov";
    fovEl.textContent = `${dims} · ${round2(fov.w)}° × ${round2(fov.h)}° on sky`;
    main.appendChild(name);
    main.appendChild(fovEl);

    // Per-camera focal length: editable for normal cameras, read-only (with a
    // lock indicator) for sealed smart-scope entries.
    const fl = document.createElement("div");
    fl.className = "cam-focal";
    fl.appendChild(el("span", null, "Focal length"));
    if (entry.locked) {
      fl.appendChild(el("span", "locked-val", `${entry.focalMM} mm`));
      fl.appendChild(el("span", "lock", "🔒 fixed"));
    } else {
      const fInput = document.createElement("input");
      fInput.type = "number";
      fInput.min = "50"; fInput.max = "4000"; fInput.step = "1";
      fInput.inputMode = "numeric";
      fInput.value = String(entry.focalMM);
      fInput.setAttribute("aria-label", `Focal length for ${cam.name} (mm)`);
      const applyEntryFocal = () => {
        const v = parseFloat(fInput.value);
        if (isFinite(v) && v >= 50 && v <= 4000) { entry.focalMM = v; render(); }
      };
      fInput.addEventListener("change", applyEntryFocal);
      fl.appendChild(fInput);
      fl.appendChild(el("span", null, "mm"));
    }
    main.appendChild(fl);

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "cam-remove";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${cam.name}`);
    rm.addEventListener("click", () => { removeCamAt(i); render(); });

    row.appendChild(sw);
    row.appendChild(main);
    row.appendChild(rm);
    wrap.appendChild(row);
  });
}

/* ---- Diagram -------------------------------------------------------------- */
function renderDiagram(scope, target, focalMM) {
  const svg = $("diagram");
  svg.innerHTML = "";

  const VB = 1000;            // viewBox is 1000 x 1000
  const cx = VB / 2, cy = VB / 2;

  // Every active camera's FOV (deg), each at ITS OWN focal length.
  const cams = activeCams().map(({ cam, color, focalMM: f }) => ({ cam, color, fov: camFov(cam, f) }));

  // Image circle is a coverage guide drawn at the top-level default focal length.
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

  // Always intercept touch over the diagram so pinch-to-zoom works (and frame
  // pan when an image is present). The cursor still hints draggability.
  svg.style.touchAction = "none";
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

  cards.appendChild(card("Default focal length", `${focalMM} mm`, "for the next camera added"));
  if (scope.fRatio) cards.appendChild(card("f-ratio", `f/${round2(scope.fRatio)}`));
  cards.appendChild(card("Target size", `${round2(target.wDeg)}° × ${round2(target.hDeg)}°`,
    target.kind));

  // Sampling: arcsec/pixel per active camera — only for cameras with a real
  // pixel size (generic formats carry null, so they're skipped to avoid NaN).
  // Each camera samples at ITS OWN focal length.
  const sampled = activeList.filter((e) => typeof e.cam.pixelMicron === "number");
  if (sampled.length) {
    const samp = document.createElement("div");
    samp.className = "card sampling";
    samp.innerHTML = `<div class="k">Sampling — arcsec / pixel</div>
      <div class="sub">Pixel-size dependent; computed at each camera's own focal length.</div>`;
    const list = document.createElement("div");
    list.className = "samp-list";
    sampled.forEach((e) => {
      const cam = e.cam;
      const row = document.createElement("div");
      row.className = "samp-row";
      const aspp = arcsecPerPx(cam.pixelMicron, e.focalMM);
      row.innerHTML = `<span class="sname">${cam.name} · ${cam.pixelMicron}µm · ${e.focalMM}mm</span>` +
                      `<span class="sval">${round2(aspp)}″/px</span>`;
      list.appendChild(row);
    });
    samp.appendChild(list);
    cards.appendChild(samp);
  }
}

/* ---- Verdict -------------------------------------------------------------- */
function renderVerdict(scope, target, focalMM) {
  const node = $("verdict");
  node.innerHTML = "";

  const cams = activeCams().map(({ cam, focalMM: f }) => ({ cam, fov: camFov(cam, f), focalMM: f }));
  if (cams.length === 0) {
    node.className = "verdict";
    node.textContent = "No cameras selected — pick one above and tap Add.";
    return;
  }

  const fitting = cams.filter(({ fov }) => fits(fov, target));
  // Whether every camera is at the same focal length (lets the headline name one).
  const sameFocal = cams.every((c) => c.focalMM === cams[0].focalMM);
  const fl = sameFocal ? `${cams[0].focalMM}mm` : "their focal lengths";

  // Headline (tri-state across the compare set).
  let headline;
  if (fitting.length === cams.length && cams.length > 1) {
    node.className = "verdict good";
    const smallest = fitting.slice()
      .sort((a, b) => (a.cam.wMM * a.cam.hMM) - (b.cam.wMM * b.cam.hMM))[0];
    headline = `All cameras frame ${target.name} at ${fl}. ` +
      `Smallest fitting sensor (${smallest.cam.name}) is the efficient pick.`;
  } else if (fitting.length === cams.length) {
    node.className = "verdict good";
    headline = `${cams[0].cam.name} frames ${target.name} at ${cams[0].focalMM}mm.`;
  } else if (fitting.length === 0) {
    node.className = "verdict bad";
    headline = `${target.name} overflows ${cams.length > 1 ? "every selected sensor" : "the sensor"} at ${fl}. ` +
      `Shorten the focal length, use a bigger sensor, or shoot a mosaic.`;
  } else {
    node.className = "verdict some";
    headline = `${target.name} fits some cameras at ${fl}, but not all — smaller sensors crop it.`;
  }
  node.appendChild(el("p", "verdict-head", headline));

  // Per-camera breakdown: fill % when it fits, overflow axis when it doesn't.
  const list = el("div", "verdict-list");
  cams.forEach(({ cam, fov, focalMM: f }, i) => {
    const row = el("div", "verdict-row");
    const sw = el("span", "swatch");
    sw.style.color = camColor(i);
    sw.style.background = camColor(i);
    const txt = el("span", "verdict-txt");
    if (fits(fov, target)) {
      const fillW = Math.round((target.wDeg / fov.w) * 100);
      const fillH = Math.round((target.hDeg / fov.h) * 100);
      txt.textContent = `${cam.name} @ ${f}mm: fits — fills ~${fillW}% × ${fillH}% of frame.`;
    } else {
      const axis = target.wDeg > fov.w && target.hDeg > fov.h ? "both axes"
        : target.wDeg > fov.w ? "width" : "height";
      txt.textContent = `${cam.name} @ ${f}mm: overflows on ${axis} (field ${round2(fov.w)}° × ${round2(fov.h)}°).`;
    }
    row.appendChild(sw);
    row.appendChild(txt);
    list.appendChild(row);
  });
  node.appendChild(list);
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
    fovField.appendChild(el("span", null, "Image field width (°)"));
    const fov = el("input");
    fov.type = "number"; fov.min = "0.05"; fov.step = "0.1"; fov.inputMode = "decimal";
    fov.value = rec && rec.source === "survey" ? round2(rec.fovWDeg) : suggestedFov(target);
    fovField.appendChild(fov);
    fovField.appendChild(el("p", "img-hint",
      "How wide the fetched picture is on the sky — THIS sizes the image. " +
      "Use a value bigger than your object to leave room to frame."));
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

  wrap.appendChild(el("div", "img-head", "Custom object — approximate size (verdict only)"));

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
    "Sesame gives coordinates, not size. This only affects the fit verdict and " +
    "the schematic — it does NOT size the fetched picture (use “Image field " +
    "width” in the Object image panel for that)."));

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

/* ---- Zoom (CSS transform layered over the auto-fit viewBox) ---------------
 * The SVG keeps its auto-fit viewBox (zoom=1 == fit). We apply a CSS transform
 * `translate(panX,panY) scale(zoom)` with transform-origin at the top-left, so
 * everything inside — survey/uploaded image backdrop, frames, circle — scales
 * together. panX/panY are in CSS pixels of the stage. Drag-pan/nudge stays in
 * deg-space (it edits the image offset) and is divided by `zoom` so a finger
 * drag tracks the cursor at any zoom level. */
function applyZoom() {
  const svg = $("diagram");
  if (!svg) return;
  svg.style.transformOrigin = "0 0";
  svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

// Clamp zoom and keep the stage point (sx, sy) — in CSS px relative to the
// SVG's untransformed top-left — fixed on screen while scaling.
function zoomAtPoint(newZoom, sx, sy) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  if (newZoom === zoom) return;
  // World point under (sx,sy): (sx - panX)/zoom. Keep it under the cursor.
  const wx = (sx - panX) / zoom, wy = (sy - panY) / zoom;
  zoom = newZoom;
  panX = sx - wx * zoom;
  panY = sy - wy * zoom;
  clampPan();
  applyZoom();
}

// The UNTRANSFORMED reference box. The <svg> itself is CSS-transformed, so its
// own getBoundingClientRect moves with the zoom/pan — useless as a stable
// origin. Its parent `.diagram-stage` is NOT transformed and keeps the
// untransformed layout size/position, so we measure everything against it.
function stageBox(svg) { return (svg.parentElement || svg).getBoundingClientRect(); }

// Don't let the scaled diagram drift entirely off its stage.
function clampPan() {
  const svg = $("diagram");
  if (!svg) return;
  const r = stageBox(svg);
  const w = r.width, h = r.height;
  if (!w || !h) return;
  const maxX = 0, minX = w - w * zoom;     // scaled width = w*zoom
  const maxY = 0, minY = h - h * zoom;
  panX = Math.min(maxX, Math.max(minX, panX));
  panY = Math.min(maxY, Math.max(minY, panY));
}

function resetZoom() {
  zoom = 1; panX = 0; panY = 0;
  applyZoom();
}

// Pointer position relative to the SVG's untransformed box, in CSS px. Because
// the transform-origin is the top-left corner, that corner doesn't move under
// translate/scale, so the element's current bounding-rect left/top still marks
// the untransformed origin and this stays correct at any zoom.
function pointerStagePos(svg, clientX, clientY) {
  const r = stageBox(svg);   // untransformed wrapper, stable under zoom/pan
  return { x: clientX - r.left, y: clientY - r.top };
}

/* Wire wheel + pinch + on-screen buttons to the zoom. Pinch and pan-drag both
 * use Pointer Events and coexist with setupDiagramDrag (that handler bails when
 * two pointers are down, see `zoomPointers`). */
const zoomPointers = new Map();   // pointerId -> {x,y} (shared with drag guard)

function setupZoom() {
  const svg = $("diagram");
  if (!svg) return;

  // Desktop wheel-zoom, centred on the cursor.
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const { x, y } = pointerStagePos(svg, e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * 0.0015);   // smooth, direction-correct
    zoomAtPoint(zoom * factor, x, y);
  }, { passive: false });

  // Pinch: track pointers; with two down, scale by the change in their spread,
  // centred on their midpoint.
  let pinchStartDist = 0, pinchStartZoom = 1;
  svg.addEventListener("pointerdown", (e) => {
    zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zoomPointers.size === 2) {
      const [a, b] = [...zoomPointers.values()];
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchStartZoom = zoom;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!zoomPointers.has(e.pointerId)) return;
    zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zoomPointers.size === 2) {
      const [a, b] = [...zoomPointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = pointerStagePos(svg, (a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAtPoint(pinchStartZoom * (dist / pinchStartDist), mid.x, mid.y);
    }
  });
  const drop = (e) => { zoomPointers.delete(e.pointerId); };
  svg.addEventListener("pointerup", drop);
  svg.addEventListener("pointercancel", drop);

  // On-screen buttons: zoom toward the centre of the diagram.
  const stepZoom = (mult) => {
    const r = stageBox(svg);
    zoomAtPoint(zoom * mult, r.width / 2, r.height / 2);
  };
  const inBtn = $("zoomInBtn"), outBtn = $("zoomOutBtn"), fitBtn = $("zoomFitBtn");
  if (inBtn) inBtn.addEventListener("click", () => stepZoom(1.4));
  if (outBtn) outBtn.addEventListener("click", () => stepZoom(1 / 1.4));
  if (fitBtn) fitBtn.addEventListener("click", resetZoom);
}

/* ---- Drag-to-pan the frame on the diagram (touch / mouse / pencil) --------
 * Pointer Events give one code path for all input types. Dragging sets the
 * same offX/offY the nudge pad uses, so the frame follows your finger over a
 * fixed sky image. Active only when the current target has an image. */
function setupDiagramDrag() {
  const svg = $("diagram");
  let dragging = false, pid = null, sx = 0, sy = 0;
  let mode = null;                          // "zoom" (pan the view) | "image" (nudge frame)
  let sPanX = 0, sPanY = 0;                 // zoom-pan start
  let rec = null, target = null, sOffX = 0, sOffY = 0;

  svg.addEventListener("pointerdown", (e) => {
    // Two fingers down = a pinch-zoom gesture; let setupZoom own it.
    if (zoomPointers.size >= 2) { dragging = false; return; }
    sx = e.clientX; sy = e.clientY; pid = e.pointerId;
    if (zoom > 1) {
      // Zoomed in: one-finger drag pans the zoomed view.
      mode = "zoom"; dragging = true; sPanX = panX; sPanY = panY;
    } else {
      // At fit: drag nudges the frame over the photo (only if there is one).
      target = allTargets()[targetIdx];
      rec = targetImages.get(target.name);
      if (!rec) return;
      mode = "image"; dragging = true; sOffX = rec.offX || 0; sOffY = rec.offY || 0;
    }
    try { svg.setPointerCapture(pid); } catch (_) {}
    svg.style.cursor = "grabbing";
    e.preventDefault();
  });

  svg.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pid) return;
    if (zoomPointers.size >= 2) { dragging = false; return; }  // pinch took over
    if (mode === "zoom") {
      // Pan is in CSS px (same space as the transform), 1:1 with the finger.
      panX = sPanX + (e.clientX - sx);
      panY = sPanY + (e.clientY - sy);
      clampPan();
      applyZoom();
      return;
    }
    // image-nudge: deg per CSS px (zoom==1 here, so stage box == on-screen size).
    const rect = stageBox(svg);
    const scale = 1000 / rect.width;        // viewBox units per CSS pixel
    const dDegX = ((e.clientX - sx) * scale) / lastPxPerDeg;
    const dDegY = ((e.clientY - sy) * scale) / lastPxPerDeg;
    rec.offX = sOffX + dDegX;               // frame follows finger
    rec.offY = sOffY - dDegY;               // screen-down => frame down
    renderDiagram(currentScope(), target, focalMM);   // redraw diagram only
  });

  const end = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    try { svg.releasePointerCapture(pid); } catch (_) {}
    svg.style.cursor = "grab";
    if (mode === "image" && rec) saveImage(target.name, rec);  // persist offset
    mode = null;
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
}

/* ---- Master render -------------------------------------------------------- */
function render() {
  const scope = currentScope();
  const target = allTargets()[targetIdx] || allTargets()[0];

  renderCamInfo(scope, focalMM);
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
setupZoom();
applyZoom();                       // establish the (identity) transform
render();                          // paint immediately with schematics
loadAllImages().then(render);      // then re-render once stored photos load
