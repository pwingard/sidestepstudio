// Astro Dust Up
const APP_VERSION = "v5";

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

function applyBrightness() { els.dust.style.filter = `brightness(${els.bright.value})`; }
els.bright.addEventListener("input", applyBrightness);

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
  const url = URL.createObjectURL(f);
  els.user.onload = () => {
    els.user.hidden = false; els.user.style.objectFit = "cover";
    els.opacity.disabled = false; els.blink.disabled = false; els.clearImg.disabled = false;
    els.rot.disabled = false; els.rot.value = "0"; els.rotVal.textContent = "0";
    els.flip.disabled = false;
    els.solve.disabled = false;
    els.opacity.value = "0.5"; els.user.style.opacity = "0.5";
    resetUserTransform();
    setStatus(NOVA_PROXY
      ? "Plate-solve to auto-align, or drag / pinch / rotate to line up the stars."
      : "Drag / pinch / rotate to line up the stars, then Blink.");
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
  stopBlink();
});

// Blink: rapidly toggle your image's opacity 0↔set value for A/B comparison.
let blinkTimer = null;
els.blink.addEventListener("click", () => {
  if (blinkTimer) { stopBlink(); return; }
  els.blink.textContent = "Stop blink ▣";
  let on = true;
  const setVal = parseFloat(els.opacity.value) || 1;
  blinkTimer = setInterval(() => { els.user.style.opacity = (on ? setVal : 0); on = !on; }, 650);
});
function stopBlink() {
  clearInterval(blinkTimer); blinkTimer = null;
  els.blink.textContent = "Blink ▣";
  els.user.style.opacity = els.opacity.value;
}

// Drag + pinch + wheel over the viewer move/scale the user image (only when one is loaded).
const pointers = new Map();
let pinchStart = null;
els.viewer.addEventListener("pointerdown", (e) => {
  if (els.user.hidden) return;
  els.viewer.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: dist(a, b), scale: xform.scale };
  }
});
els.viewer.addEventListener("pointermove", (e) => {
  if (els.user.hidden || !pointers.has(e.pointerId)) return;
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
  if (els.user.hidden) return;
  e.preventDefault();
  xform.scale = clamp(xform.scale * (e.deltaY < 0 ? 1.06 : 0.94), 0.2, 6);
  applyUserTransform();
}, { passive: false });

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- find triggers ----
els.find.addEventListener("click", showDust);
els.target.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); showDust(); } });
els.survey.addEventListener("change", () => { if (current) showDust(); });
els.fov.addEventListener("change", () => { if (current) showDust(); });

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

async function novaJSON(path, opts) {
  const r = await fetch(NOVA_PROXY.replace(/\/$/, "") + path, opts);
  return r.json();
}

els.solve.addEventListener("click", async () => {
  if (!NOVA_PROXY) { solveStatus("Plate-solve isn't configured yet (the nova proxy URL is unset)."); return; }
  const key = els.novaKey.value.trim() || savedKey();
  if (!key) { solveStatus("Paste your astrometry.net API key first."); return; }
  if (!userFile) { solveStatus("Load your image first."); return; }
  saveKey(key);
  els.solve.disabled = true;
  try {
    // 1) login → session
    solveStatus("Signing in to astrometry.net…");
    const login = await novaJSON("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "request-json=" + encodeURIComponent(JSON.stringify({ apikey: key })),
    });
    if (login.status !== "success") throw new Error(login.errormessage || "login failed");
    const session = login.session;

    // 2) upload image → submission id
    solveStatus("Uploading your image…");
    const fd = new FormData();
    fd.append("request-json", JSON.stringify({
      session, publicly_visible: "n", allow_modifications: "d", allow_commercial_use: "d",
    }));
    fd.append("file", userFile, userFile.name || "image.jpg");
    const up = await novaJSON("/api/upload", { method: "POST", body: fd });
    if (up.status !== "success") throw new Error(up.errormessage || "upload failed");
    const subid = up.subid;

    // 3) wait for a job to be created
    let jobid = null;
    for (let i = 0; i < 60; i++) {
      const s = await novaJSON("/api/submissions/" + subid);
      if (s.jobs && s.jobs.length && s.jobs[0] != null) { jobid = s.jobs[0]; break; }
      solveStatus(`Queued at astrometry.net… (${i * 5}s)`);
      await sleep(5000);
    }
    if (jobid == null) throw new Error("Timed out waiting in the queue. Try again.");

    // 4) wait for the solve to finish
    let solved = false;
    for (let i = 0; i < 72; i++) {
      const j = await novaJSON("/api/jobs/" + jobid);
      if (j.status === "success") { solved = true; break; }
      if (j.status === "failure") throw new Error("Couldn't solve this image — try a wider field with more stars.");
      solveStatus(`Solving… (${i * 5}s)`);
      await sleep(5000);
    }
    if (!solved) throw new Error("Solve timed out. Try a wider field with more stars.");

    // 5) calibration → auto-align
    const cal = await novaJSON("/api/jobs/" + jobid + "/calibration/");
    if (cal.ra == null || cal.pixscale == null) throw new Error("No calibration returned.");
    await autoAlign(cal);
    solveStatus(`Solved: ${fmtRA(cal.ra)} ${fmtDec(cal.dec)} · ${cal.pixscale.toFixed(2)}″/px · rot ${cal.orientation.toFixed(1)}°. ` +
                `If it's mirrored or rotated wrong, tap Flip / nudge Rotate.`);
  } catch (e) {
    solveStatus(e.message || "Plate-solve failed.");
  } finally {
    els.solve.disabled = false;
  }
});

// Re-fetch the dust map to exactly cover the solved image, centred + scaled to match,
// then orient the user image north-up so the two overlay. (Sign of rotation/parity is
// nova's convention; Flip + Rotate let the user correct if a frame lands mirrored.)
async function autoAlign(cal) {
  const natW = els.user.naturalWidth, natH = els.user.naturalHeight;
  const fovDeg = (Math.max(natW, natH) * cal.pixscale) / 3600; // larger image dim → field width
  solveStatus("Fetching matching dust map…");
  await loadImageInto(els.dust, hips2fitsURL(els.survey.value, cal.ra, cal.dec, fovDeg));
  current = { ra: cal.ra, dec: cal.dec, fov: fovDeg };
  els.dust.hidden = false; els.placeholder.hidden = true; applyBrightness();
  // both images: fit whole frame (contain) so their angular scales match
  els.dust.style.objectFit = "contain";
  els.user.style.objectFit = "contain";
  xform.x = 0; xform.y = 0; xform.scale = 1;
  xform.rot = -cal.orientation;
  xform.flip = (cal.parity < 0) ? -1 : 1;
  els.rot.value = xform.rot.toFixed(1); els.rotVal.textContent = xform.rot.toFixed(1);
  els.opacity.value = "0.5"; els.user.style.opacity = "0.5";
  applyUserTransform();
}

// ---- service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
