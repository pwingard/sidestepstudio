/* =============================================================================
 * data.js — editable gear & target lists for the FOV Planner
 * -----------------------------------------------------------------------------
 * This file is intentionally kept separate from app.js so you can add scopes,
 * cameras, and targets WITHOUT touching any rendering or math code.
 *
 * Just edit the arrays below, save, and reload the page (or reinstall on the
 * phone). No build step.
 *
 * ---- COLUMN MEANINGS & UNITS ------------------------------------------------
 *
 * SCOPES (telescope / corrector configurations)
 *   name          : free text shown in the Configuration dropdown
 *   focalLength   : EFFECTIVE focal length in millimetres (already includes
 *                   the reducer/flattener/extender — store the FINAL number,
 *                   not a multiplier)
 *   fRatio        : EFFECTIVE focal ratio for this config (display + cards)
 *   imageCircle   : diameter of the corrector's usable image circle, in mm.
 *                   Defaults to 43.3 (full-frame) if omitted. Drawn as the
 *                   dashed grey circle. Use a smaller value for scopes whose
 *                   correctors don't cover full frame.
 *
 * CAMERAS (sensor geometry)
 *   name          : free text shown in the legend
 *   wMM, hMM      : sensor active area Width & Height in millimetres
 *   pixelMicron   : physical pixel pitch in microns (drives arcsec/pixel)
 *   mp            : megapixels — DISPLAY ONLY, not used in any math
 *   owned         : true => "my gear", sorted/shown first and badged
 *
 * TARGETS (deep-sky objects, schematic only)
 *   name          : free text shown in the Target dropdown
 *   wDeg, hDeg    : angular Width & Height of the object, in DEGREES
 *   kind          : controls the schematic blob's shape/colour. One of:
 *                     'dark'   dark nebula  (tilted grey ellipse + dense nose)
 *                     'neb'    bright/emission nebula (soft bluish ellipse)
 *                     'galaxy' galaxy       (pale ellipse + bright core)
 *                     'pn'     planetary nebula (small teal disc)
 * ============================================================================= */

/* Telescope configurations — Askar V, the six native configs.
 * imageCircle is per-config (default 43.3mm full-frame coverage) so scopes
 * with smaller circles can be added later. */
const SCOPES = [
  { name: "60mm + reducer",   focalLength: 270, fRatio: 4.5,  imageCircle: 43.3 },
  { name: "80mm + reducer",   focalLength: 384, fRatio: 4.8,  imageCircle: 43.3 },
  { name: "60mm + flattener", focalLength: 360, fRatio: 6.0,  imageCircle: 43.3 },
  { name: "60mm + extender",  focalLength: 446, fRatio: 7.43, imageCircle: 43.3 },
  { name: "80mm + flattener", focalLength: 495, fRatio: 6.18, imageCircle: 43.3 },
  { name: "80mm + extender",  focalLength: 600, fRatio: 7.5,  imageCircle: 43.3 },
];

/* Cameras — sensor dimensions in mm, pixel pitch in microns.
 * First three are primary gear (owned: true) and sort first. */
const CAMERAS = [
  { name: "ASI533MC/MM Pro",  wMM: 11.31, hMM: 11.31, pixelMicron: 3.76, mp: 9,  owned: true,  note: "square" },
  { name: "ASI2600MC/MM Pro", wMM: 23.50, hMM: 15.70, pixelMicron: 3.76, mp: 26, owned: true,  note: "APS-C" },
  { name: "ASI6200MC/MM Pro", wMM: 36.00, hMM: 24.00, pixelMicron: 3.76, mp: 62, owned: true,  note: "full frame" },
  { name: "ASI2400MC Pro",    wMM: 36.00, hMM: 24.00, pixelMicron: 5.94, mp: 24, owned: false, note: "full frame, large pixels" },
  { name: "Canon 90D (mod)",  wMM: 22.30, hMM: 14.80, pixelMicron: 3.20, mp: 33, owned: false, note: "APS-C DSLR" },
];

/* Targets — angular size in degrees. kind drives only the schematic drawing. */
const TARGETS = [
  { name: "Shark Nebula (LDN 1235)", wDeg: 3.9,   hDeg: 2.7,   kind: "dark" },
  { name: "Veil Nebula (full)",      wDeg: 3.0,   hDeg: 3.0,   kind: "neb" },
  { name: "Andromeda (M31)",         wDeg: 3.17,  hDeg: 1.0,   kind: "galaxy" },
  { name: "North America (NGC7000)", wDeg: 2.0,   hDeg: 1.7,   kind: "neb" },
  { name: "Iris Nebula (NGC7023)",   wDeg: 0.3,   hDeg: 0.3,   kind: "neb" },
  { name: "M81 / M82 pair",          wDeg: 0.7,   hDeg: 0.5,   kind: "galaxy" },
  { name: "M51 Whirlpool",           wDeg: 0.18,  hDeg: 0.12,  kind: "galaxy" },
  { name: "Ring Nebula (M57)",       wDeg: 0.038, hDeg: 0.038, kind: "pn" },
];
