// Astro Dust Up
const APP_VERSION = "v21";

// Cloudflare Worker that relays nova.astrometry.net (CORS). Set after deploying
// nova-proxy/ (see its README). Empty = plate-solve disabled, manual align only.
const NOVA_PROXY = "https://astro-dust-up-nova.bizpfw.workers.dev";

const $ = (id) => document.getElementById(id);
const els = {
  target: $("targetInput"), list: $("targetList"), find: $("findBtn"),
  survey: $("surveySel"), fov: $("fovSel"),
  status: $("status"), surveyNote: $("surveyNote"),
  viewer: $("viewer"), dust: $("dustImg"), user: $("userImg"), placeholder: $("placeholder"),
  bright: $("brightRange"),
  layerToggle: $("layerToggle"), layerStars: $("layerStars"), layerDust: $("layerDust"),
  solvedBanner: $("solvedBanner"),
  file: $("fileInput"), opacity: $("opacityRange"), rot: $("rotRange"), rotVal: $("rotVal"),
  blink: $("blinkBtn"), flip: $("flipBtn"), clearImg: $("clearImgBtn"),
  novaKey: $("novaKey"), novaKeyRow: $("novaKeyRow"), novaKeySaved: $("novaKeySaved"),
  novaKeyChange: $("novaKeyChange"), solve: $("solveBtn"), solveStatus: $("solveStatus"),
  ver: $("ver"),
};

// ---- survey + target seeding ----
SURVEYS.forEach((s, i) => {
  const o = document.createElement("option");
  o.value = s.id; o.textContent = s.label; if (i === 0) o.selected = true;
  els.survey.appendChild(o);
});
TARGETS.forEach((t) => {
  const o = document.createElement("option"); o.value = t.name; els.list.appendChild(o);
});
els.ver.textContent = "Astro Dust Up " + APP_VERSION;

// Plate-solve depends on the nova proxy; hide that whole block until it's configured.
if (!NOVA_PROXY) { const sb = document.querySelector(".solvebox"); if (sb) sb.hidden = true; }

function setStatus(msg) { els.status.textContent = msg || ""; }
function surveyBright(id) { const s = SURVEYS.find((x) => x.id === id); return s ? s.bright : 1.4; }

// Lightweight GA4 event helper — silently no-ops if gtag isn't loaded (ad-blocker, offline, etc.)
function track(name, params) {
  if (typeof gtag === "function") {
    try { gtag("event", name, params || {}); } catch {}
  }
}
function categorizeSolveFailure(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("queue")) return "queue_timeout";
  if (m.includes("still solving") || m.includes("solve timed")) return "solve_timeout";
  if (m.includes("couldn't solve") || m.includes("solve failed")) return "nova_failure";
  if (m.includes("apikey") || m.includes("login failed") || m.includes("paste your")) return "auth";
  if (m.includes("upload failed")) return "upload";
  if (m.includes("no calibration")) return "no_calibration";
  if (m.includes("load your image")) return "no_image";
  return "other";
}

// ---- coordinate parsing / name resolve ----
// Accept "ra dec" in decimal degrees, or resolve a name via CDS Sesame.
function parseCoords(text) {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const ra = parseFloat(m[1]), dec = parseFloat(m[2]);
  if (ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90) return { ra, dec };
  return null;
}

async function resolveName(name) {
  const url = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/SNV?" + encodeURIComponent(name);
  const r = await fetch(url);
  if (!r.ok) throw new Error("Sesame " + r.status);
  const txt = await r.text();
  const m = txt.match(/%J\s+([\d.+-]+)\s+([\d.+-]+)/);
  if (!m) throw new Error("Couldn't find “" + name + "”.");
  return { ra: parseFloat(m[1]), dec: parseFloat(m[2]) };
}

// ---- dust map fetch (hips2fits) ----
function hips2fitsURL(hips, ra, dec, fovDeg) {
  const p = new URLSearchParams({
    hips, width: "1000", height: "1000", fov: String(fovDeg),
    projection: "TAN", coordsys: "icrs", ra: String(ra), dec: String(dec), format: "jpg",
  });
  return "https://alasky.cds.unistra.fr/hips-image-services/hips2fits?" + p.toString();
}

let current = null; // {ra, dec, fov}

async function showDust() {
  const text = els.target.value.trim();
  if (!text) { setStatus("Type a target first."); return; }
  const fov = parseFloat(els.fov.value);
  const hips = els.survey.value;
  els.find.disabled = true;
  try {
    let coords = parseCoords(text);
    if (!coords) {
      // Seeded targets resolve by their bare catalog token; otherwise strip any parenthetical.
      const seed = TARGETS.find((t) => t.name.toLowerCase() === text.toLowerCase());
      const query = seed ? seed.q : text.replace(/\s*\(.*?\)\s*/g, " ").trim();
      setStatus("Resolving “" + query + "”…");
      coords = await resolveName(query);
    }
    setStatus("Fetching dust map…");
    const url = hips2fitsURL(hips, coords.ra, coords.dec, fov);
    await loadImageInto(els.dust, url);
    current = { ...coords, fov };
    // Loading by target re-centers the view → drop any solved-frame lock/toggle.
    solvedView = null; solvedLock = false; els.layerToggle.hidden = true; els.solvedBanner.hidden = true;
    els.dust.style.objectFit = "cover";
    els.dust.hidden = false; els.placeholder.hidden = true;
    applyBrightness();
    setStatus(`${fmtRA(coords.ra)}  ${fmtDec(coords.dec)} · ${fov}° field`);
    els.surveyNote.textContent = SURVEYS.find((s) => s.id === hips)?.label || "";
  } catch (e) {
    setStatus(e.message || "Couldn't load that.");
  } finally {
    els.find.disabled = false;
  }
}

function loadImageInto(img, url) {
  return new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Image failed to load."));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

// Black-point clip (drop the noise floor) then gamma lift — reveals faint dust/filaments
// without graying the background, which a linear brightness can't do. Drives the #dustStretch SVG filter.
const bpFuncs = document.querySelectorAll("#dustBP feFuncR, #dustBP feFuncG, #dustBP feFuncB");
const gammaFuncs = document.querySelectorAll("#dustGamma feFuncR, #dustGamma feFuncG, #dustGamma feFuncB");
function applyBrightness() {
  const stretch = parseFloat(els.bright.value) || 2.4;
  const bp = 0.06;                       // clip the bottom 6% (sky noise floor)
  const slope = 1 / (1 - bp), intercept = -bp * slope;
  const exponent = 1 / stretch;          // <1 → lifts faint signal
  bpFuncs.forEach((f) => { f.setAttribute("slope", slope.toFixed(4)); f.setAttribute("intercept", intercept.toFixed(4)); });
  gammaFuncs.forEach((f) => f.setAttribute("exponent", exponent.toFixed(4)));
}
els.bright.addEventListener("input", applyBrightness);
applyBrightness();

// ---- coordinate formatting ----
function fmtRA(deg) {
  let h = deg / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.round(((h - hh) * 60 - mm) * 60);
  if (ss === 60) { ss = 0; mm++; } if (mm === 60) { mm = 0; hh++; }
  return `${String(hh).padStart(2,"0")}h${String(mm).padStart(2,"0")}m${String(ss).padStart(2,"0")}s`;
}
function fmtDec(deg) {
  const sign = deg < 0 ? "−" : "+"; const a = Math.abs(deg);
  let dd = Math.floor(a), mm = Math.floor((a - dd) * 60), ss = Math.round(((a - dd) * 60 - mm) * 60);
  if (ss === 60) { ss = 0; mm++; } if (mm === 60) { mm = 0; dd++; }
  return `${sign}${String(dd).padStart(2,"0")}°${String(mm).padStart(2,"0")}′${String(ss).padStart(2,"0")}″`;
}

// ---- your image: load + align (manual drag/rotate, or plate-solve) + blink ----
const xform = { x: 0, y: 0, scale: 1, rot: 0, flip: 1 }; // px offset, scale, degrees, mirror
let solvedLock = false; // once plate-solved, the app owns the alignment — no manual drag/pinch
let solvedView = null;  // {ra,dec,fov} of a solved frame — lets us swap the background layer in place
let currentLayer = "dust"; // which background is showing: "stars" (DSS2 reference) or "dust" (WISE/IR)
const STAR_HIPS = "CDS/P/DSS2/color"; // visible star reference for the stars-vs-stars alignment check
function applyUserTransform() {
  // flip first (in image space), then rotate, then scale/translate
  els.user.style.transform =
    `translate(${xform.x}px,${xform.y}px) scale(${xform.scale}) rotate(${xform.rot}deg) scaleX(${xform.flip})`;
}
function resetUserTransform() { xform.x = 0; xform.y = 0; xform.scale = 1; xform.rot = 0; xform.flip = 1; applyUserTransform(); }

let userFile = null; // the actual File, needed for plate-solve upload
els.file.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  userFile = f;
  clearPending(); // a new image starts a fresh solve
  solvedLock = false; solvedView = null; els.layerToggle.hidden = true; els.solvedBanner.hidden = true;
  const url = URL.createObjectURL(f);
  els.user.onload = () => {
    els.user.hidden = false; els.user.style.objectFit = "cover";
    els.opacity.disabled = false; els.blink.disabled = false; els.clearImg.disabled = false;
    els.rot.disabled = false; els.rot.value = "0"; els.rotVal.textContent = "0";
    els.flip.disabled = false;
    els.solve.disabled = false;
    els.opacity.value = "1"; els.user.style.opacity = "1";
    resetUserTransform();
    // If we've solved this exact file before, reuse it — no nova queue.
    const cached = getCachedSolve(fileKey(userFile));
    if (cached) {
      autoAlign(cached)
        .then(() => {
          track("solve_success", { target: els.target.value.trim() || "(none)", source: "cached", survey: els.survey.value });
          solveStatus("Reused your saved plate-solve for this image — no re-solving needed. (Tap Plate-solve to redo.)");
        })
        .catch(() => {});
    } else {
      setStatus(NOVA_PROXY
        ? "Tap Plate-solve to align your image to the dust map, then Blink to compare."
        : "Drag / pinch / rotate to line up the stars, then Blink.");
    }
  };
  els.user.src = url;
});
els.opacity.addEventListener("input", () => { els.user.style.opacity = els.opacity.value; });
els.rot.addEventListener("input", () => { xform.rot = parseFloat(els.rot.value); els.rotVal.textContent = els.rot.value; applyUserTransform(); });
els.flip.addEventListener("click", () => { xform.flip *= -1; applyUserTransform(); });
els.clearImg.addEventListener("click", () => {
  els.user.hidden = true; els.user.src = ""; userFile = null;
  els.file.value = "";
  els.opacity.disabled = true; els.blink.disabled = true; els.clearImg.disabled = true;
  els.rot.disabled = true; els.flip.disabled = true; els.solve.disabled = true;
  els.solveStatus.textContent = "";
  clearPending();
  solvedLock = false; solvedView = null; els.layerToggle.hidden = true; els.solvedBanner.hidden = true;
  stopBlink();
});

// Blink: hard A/B between your image (full) and the dust map (your image hidden).
// Deliberately ignores the blend slider — a clean flip is what reveals whether your
// glow tracks the dust. Resting state shows your image fully.
let blinkTimer = null;
function blinkRestingLabel() { return currentLayer === "stars" ? "Blink your image with stars" : "Blink your image with dust"; }
function updateBlinkLabel() { if (!blinkTimer) els.blink.textContent = blinkRestingLabel(); }
els.blink.addEventListener("click", () => {
  if (blinkTimer) { stopBlink(); return; }
  track("blink_start", { layer: currentLayer });
  els.blink.textContent = "Stop blinking";
  let on = true;
  els.user.style.opacity = "1";
  blinkTimer = setInterval(() => { els.user.style.opacity = on ? "0" : "1"; on = !on; }, 650);
});
function stopBlink() {
  if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
  els.blink.textContent = blinkRestingLabel();
  // Back to the static blend value (full unless the user dialed it down).
  els.user.style.opacity = els.opacity.value;
}

// Drag + pinch + wheel over the viewer move/scale the user image (only when one is loaded).
const pointers = new Map();
let pinchStart = null;
els.viewer.addEventListener("pointerdown", (e) => {
  if (els.user.hidden || solvedLock) return;
  els.viewer.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: dist(a, b), scale: xform.scale };
  }
});
els.viewer.addEventListener("pointermove", (e) => {
  if (els.user.hidden || solvedLock || !pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  if (pointers.size === 1) {
    xform.x += e.clientX - prev.x; xform.y += e.clientY - prev.y;
    applyUserTransform();
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    xform.scale = clamp(pinchStart.scale * (dist(a, b) / pinchStart.dist), 0.2, 6);
    applyUserTransform();
  }
});
function endPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null; }
els.viewer.addEventListener("pointerup", endPointer);
els.viewer.addEventListener("pointercancel", endPointer);
els.viewer.addEventListener("wheel", (e) => {
  if (els.user.hidden || solvedLock) return;
  e.preventDefault();
  xform.scale = clamp(xform.scale * (e.deltaY < 0 ? 1.06 : 0.94), 0.2, 6);
  applyUserTransform();
}, { passive: false });

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- find triggers ----
els.find.addEventListener("click", showDust);
els.target.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); showDust(); } });
els.survey.addEventListener("change", () => {
  if (solvedView) { if (currentLayer === "dust") loadLayer("dust"); }  // keep the solved alignment
  else if (current) showDust();
});
els.fov.addEventListener("change", () => { if (current && !solvedView) showDust(); });

// ---- stars/dust background toggle (works on a solved frame, in place) ----
// Stars = visible reference at the same WCS, for the stars-vs-stars alignment check.
// Dust = the selected WISE/IR survey at the same WCS, for the real-dust-vs-gradient check.
async function loadLayer(kind) {
  const v = solvedView || current;
  if (!v) return;
  const hips = kind === "stars" ? STAR_HIPS : els.survey.value;
  currentLayer = kind;
  els.layerStars.classList.toggle("active", kind === "stars");
  els.layerDust.classList.toggle("active", kind === "dust");
  updateBlinkLabel(); // reflect the chosen layer right away, before the image loads
  setStatus(kind === "stars" ? "Loading star reference…" : "Loading dust map…");
  try {
    await loadImageInto(els.dust, hips2fitsURL(hips, v.ra, v.dec, v.fov));
    els.dust.hidden = false; els.placeholder.hidden = true;
    els.dust.style.objectFit = "contain"; applyBrightness();
    setStatus(kind === "stars"
      ? "Blink: your stars should land on the reference stars. If not, tap Flip or nudge Rotate."
      : "Blink: glow that tracks the dust is real nebulosity; smooth glow that doesn't is a gradient.");
  } catch (e) { setStatus(e.message || "Couldn't load that layer."); }
}
els.layerStars.addEventListener("click", () => { track("layer_switch", { to: "stars" }); loadLayer("stars"); });
els.layerDust.addEventListener("click",  () => { track("layer_switch", { to: "dust"  }); loadLayer("dust"); });

// ---- plate-solve (nova.astrometry.net via the CORS proxy) ----
// Remember the user's key locally (their own key, never sent anywhere but nova).
// Once saved, collapse the field to a "key saved" row so it isn't left exposed.
function savedKey() { return (localStorage.getItem("dustNovaKey") || "").trim(); }
function refreshKeyUI() {
  const have = !!savedKey();
  els.novaKeyRow.hidden = have;       // hide the input once a key is stored
  els.novaKeySaved.hidden = !have;    // show the "saved / change" row instead
}
function saveKey(value) {
  const v = (value || "").trim();
  if (v) localStorage.setItem("dustNovaKey", v); else localStorage.removeItem("dustNovaKey");
  els.novaKey.value = v;
  refreshKeyUI();
}
els.novaKey.value = savedKey();
refreshKeyUI();
// Save + collapse as soon as a key is entered/pasted (on blur, or after a paste settles).
els.novaKey.addEventListener("change", () => saveKey(els.novaKey.value));
els.novaKey.addEventListener("paste", () => setTimeout(() => saveKey(els.novaKey.value), 0));
els.novaKeyChange.addEventListener("click", () => {
  els.novaKeySaved.hidden = true;
  els.novaKeyRow.hidden = false;
  els.novaKey.value = "";
  els.novaKey.focus();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function solveStatus(msg) { els.solveStatus.textContent = msg || ""; }

// Plate-solving the same file always gives the same answer, and nova's queue is slow —
// so cache the calibration by file identity and reuse it (no re-solve) for a while.
const SOLVE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function fileKey(f) { return f ? `${f.name}|${f.size}|${f.lastModified}` : ""; }
function loadSolveCache() { try { return JSON.parse(localStorage.getItem("dustSolveCache") || "{}"); } catch { return {}; } }
function pruneSolveCache(c) { const now = Date.now(); for (const k in c) if (now - (c[k].t || 0) > SOLVE_TTL_MS) delete c[k]; return c; }
function getCachedSolve(key) { const c = pruneSolveCache(loadSolveCache()); return key && c[key] ? c[key].cal : null; }
function setCachedSolve(key, cal) {
  if (!key) return;
  const c = pruneSolveCache(loadSolveCache());
  c[key] = { cal, t: Date.now() };
  try { localStorage.setItem("dustSolveCache", JSON.stringify(c)); } catch {}
}

async function novaJSON(path, opts) {
  const r = await fetch(NOVA_PROXY.replace(/\/$/, "") + path, opts);
  return r.json();
}

// nova's free queue can run many minutes when busy. Keep the in-flight job so a
// slow queue (or a give-up) lets the user resume polling instead of re-uploading.
let pendingSolve = null; // { subid, jobid }
const QUEUE_BUDGET_MS = 20 * 60 * 1000;
const SOLVE_BUDGET_MS = 15 * 60 * 1000;

function fmtElapsed(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; }
// Poll quickly at first, then ease off so long waits don't hammer nova.
function pollInterval(ms) { return ms < 60000 ? 5000 : ms < 300000 ? 10000 : 15000; }
function updateSolveLabel() { els.solve.textContent = pendingSolve ? "Keep checking solve" : "Plate-solve & auto-align"; }
function clearPending() { pendingSolve = null; updateSolveLabel(); }

async function waitForJob(subid) {
  const start = Date.now();
  while (Date.now() - start < QUEUE_BUDGET_MS) {
    const s = await novaJSON("/api/submissions/" + subid);
    if (s.jobs && s.jobs.length && s.jobs[0] != null) return s.jobs[0];
    solveStatus(`Queued at astrometry.net (their server is busy)… ${fmtElapsed(Date.now() - start)}. You can leave this open.`);
    await sleep(pollInterval(Date.now() - start));
  }
  return null; // gave up for now — caller keeps the pending job so it can resume
}
async function waitForSolve(jobid) {
  const start = Date.now();
  while (Date.now() - start < SOLVE_BUDGET_MS) {
    const j = await novaJSON("/api/jobs/" + jobid);
    if (j.status === "success") return "success";
    if (j.status === "failure") return "failure";
    solveStatus(`Solving your image… ${fmtElapsed(Date.now() - start)}.`);
    await sleep(pollInterval(Date.now() - start));
  }
  return "timeout";
}

els.solve.addEventListener("click", runSolve);
async function runSolve() {
  if (!NOVA_PROXY) { solveStatus("Plate-solve isn't configured yet (the nova proxy URL is unset)."); return; }
  const key = els.novaKey.value.trim() || savedKey();
  if (!key) { solveStatus("Paste your astrometry.net API key first."); return; }
  if (!userFile) { solveStatus("Load your image first."); return; }
  saveKey(key);
  els.solve.disabled = true;
  try {
    let subid = pendingSolve && pendingSolve.subid;
    let jobid = pendingSolve && pendingSolve.jobid;

    if (!subid) {
      // login → session
      solveStatus("Signing in to astrometry.net…");
      const login = await novaJSON("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "request-json=" + encodeURIComponent(JSON.stringify({ apikey: key })),
      });
      if (login.status !== "success") throw new Error(login.errormessage || "login failed");

      // upload image → submission id
      solveStatus("Uploading your image…");
      const fd = new FormData();
      fd.append("request-json", JSON.stringify({
        session: login.session, publicly_visible: "n", allow_modifications: "d", allow_commercial_use: "d",
      }));
      fd.append("file", userFile, userFile.name || "image.jpg");
      const up = await novaJSON("/api/upload", { method: "POST", body: fd });
      if (up.status !== "success") throw new Error(up.errormessage || "upload failed");
      subid = up.subid; jobid = null;
      pendingSolve = { subid, jobid: null };
    } else {
      solveStatus("Resuming your solve…");
    }

    // wait for a job to be created (the queue)
    if (jobid == null) {
      jobid = await waitForJob(subid);
      if (jobid == null) {
        updateSolveLabel();
        throw new Error("Still in nova's queue (busy). Your upload is saved — tap “Keep checking solve” to resume.");
      }
      pendingSolve = { subid, jobid };
    }

    // wait for the solve to finish
    const result = await waitForSolve(jobid);
    if (result === "timeout") throw new Error("Still solving — tap “Keep checking solve” to resume.");
    if (result === "failure") { clearPending(); throw new Error("nova couldn't solve this image — try a wider field with more stars."); }

    // calibration → auto-align
    const cal = await novaJSON("/api/jobs/" + jobid + "/calibration/");
    if (cal.ra == null || cal.pixscale == null) throw new Error("No calibration returned.");
    clearPending();
    setCachedSolve(fileKey(userFile), cal); // remember it so re-loading this image skips the queue
    await autoAlign(cal);
    track("solve_success", { target: els.target.value.trim() || "(none)", source: "fresh", survey: els.survey.value });
    solveStatus(`Aligned & locked: ${fmtRA(cal.ra)} ${fmtDec(cal.dec)} · ${cal.pixscale.toFixed(2)}″/px. ` +
                `Tap Blink to compare. (If it lands mirrored or rotated, tap Flip / nudge Rotate.)`);
  } catch (e) {
    solveStatus(e.message || "Plate-solve failed.");
    track("solve_failure", { reason: categorizeSolveFailure(e.message) });
  } finally {
    els.solve.disabled = false;
    updateSolveLabel();
  }
}

// Re-fetch the dust map to exactly cover the solved image, centred + scaled to match,
// then orient the user image north-up so the two overlay. (Sign of rotation/parity is
// nova's convention; Flip + Rotate let the user correct if a frame lands mirrored.)
async function autoAlign(cal) {
  const natW = els.user.naturalWidth, natH = els.user.naturalHeight;
  const fovDeg = (Math.max(natW, natH) * cal.pixscale) / 3600; // larger image dim → field width
  solvedView = { ra: cal.ra, dec: cal.dec, fov: fovDeg };
  current = solvedView;
  // both images: fit whole frame (contain) so their angular scales match
  els.user.style.objectFit = "contain";
  xform.x = 0; xform.y = 0; xform.scale = 1;
  xform.rot = -cal.orientation;
  xform.flip = (cal.parity < 0) ? -1 : 1;
  els.rot.value = xform.rot.toFixed(1); els.rotVal.textContent = xform.rot.toFixed(1);
  els.opacity.value = "1"; els.user.style.opacity = "1"; // rest showing your image, full
  solvedLock = true; // app owns the alignment now — manual drag/pinch is off
  applyUserTransform();
  // Big green confirmation that the solve landed.
  els.solvedBanner.hidden = false;
  els.solvedBanner.style.animation = "none"; void els.solvedBanner.offsetWidth; els.solvedBanner.style.animation = "";
  // Start on the STAR reference so verifying the alignment is the first thing you do.
  els.layerToggle.hidden = false;
  await loadLayer("stars");
}

// ---- footer Moondance click tracking ----
document.querySelectorAll('.foot a[href*="/moondance/"]').forEach((a) => {
  a.addEventListener("click", () => track("moondance_click", { where: "footer" }));
});

// ---- how-to video link: friendly placeholder until the YouTube URL is wired in ----
const howto = document.getElementById("howtoLink");
if (howto) {
  howto.addEventListener("click", (e) => {
    const href = howto.getAttribute("href");
    track("howto_click", { ready: href && href !== "#" });
    if (!href || href === "#") {
      e.preventDefault();
      alert("How-to video coming soon — check back!");
    }
  });
}

// ---- service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
