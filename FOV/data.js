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
 *   system        : OPTIONAL. Tag a fixed scope+camera unit (e.g. a smart
 *                   telescope) with a string. A config with a `system` only
 *                   shows cameras carrying the SAME `system` string, and those
 *                   cameras are hidden from all other configs. Omit for normal
 *                   interchangeable scopes (the Askar configs).
 *
 * CAMERAS (sensor geometry)
 *   name          : free text shown in the legend
 *   wMM, hMM      : sensor active area Width & Height in millimetres
 *   pixelMicron   : physical pixel pitch in microns (drives arcsec/pixel)
 *   mp            : megapixels — DISPLAY ONLY, not used in any math
 *   owned         : true => "my gear", sorted/shown first and badged
 *   system        : OPTIONAL. Match the `system` string on a fixed-unit scope
 *                   (see SCOPES above). A camera with a `system` only appears
 *                   when its matching config is selected. Omit for normal
 *                   interchangeable cameras.
 *
 * TARGETS (deep-sky objects)
 *   name          : free text shown in the Target dropdown
 *   wDeg, hDeg    : angular Width & Height of the object, in DEGREES
 *   kind          : controls the schematic blob's shape/colour. One of:
 *                     'dark'   dark nebula  (tilted grey ellipse + dense nose)
 *                     'neb'    bright/emission nebula (soft bluish ellipse)
 *                     'galaxy' galaxy       (pale ellipse + bright core)
 *                     'pn'     planetary nebula (small teal disc)
 *   ra, dec       : OPTIONAL J2000/ICRS coordinates in DEGREES. If present, the
 *                   app can fetch a real survey image centred here at a field
 *                   width you choose ("Fetch sky image"), so you can frame an
 *                   object you don't own. RA hours -> deg = hours * 15.
 *
 * SURVEYS (HiPS image surveys for the "Fetch sky image" feature)
 *   name : label shown in the survey dropdown
 *   hips : CDS HiPS identifier passed to hips2fits (the alasky service)
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

  // Celestron Origin — fixed RASA 6" (152mm) f/2.2 smart telescope. Sealed
  // unit: can't swap correctors or cameras, so it's tagged system:"origin"
  // and only ever pairs with its built-in sensor below. imageCircle here is
  // ~the sensor diagonal (no separate corrector circle to plan around).
  { name: "Celestron Origin (RASA 6)", focalLength: 335, fRatio: 2.2, imageCircle: 8.9, system: "origin" },
];

/* Cameras — sensor dimensions in mm, pixel pitch in microns.
 * First three are primary gear (owned: true) and sort first. */
const CAMERAS = [
  { name: "ASI533MC/MM Pro",  wMM: 11.31, hMM: 11.31, pixelMicron: 3.76, mp: 9,  owned: true,  note: "square" },
  { name: "ASI2600MC/MM Pro", wMM: 23.50, hMM: 15.70, pixelMicron: 3.76, mp: 26, owned: true,  note: "APS-C" },
  { name: "ASI6200MC/MM Pro", wMM: 36.00, hMM: 24.00, pixelMicron: 3.76, mp: 62, owned: true,  note: "full frame" },
  { name: "ASI2400MC Pro",    wMM: 36.00, hMM: 24.00, pixelMicron: 5.94, mp: 24, owned: false, note: "full frame, large pixels" },
  { name: "Canon 90D (mod)",  wMM: 22.30, hMM: 14.80, pixelMicron: 3.20, mp: 33, owned: false, note: "APS-C DSLR" },

  // Built-in sensor of the Celestron Origin (Sony IMX178 colour CMOS).
  // Only shown when the "Celestron Origin (RASA 6)" config is selected.
  // 3096 x 2080 px @ 2.4µm => ~7.43 x 4.99 mm active area, ~6.4 MP.
  { name: "Origin sensor (IMX178)", wMM: 7.43, hMM: 4.99, pixelMicron: 2.4, mp: 6.4, owned: true, note: "built-in, fixed", system: "origin" },
];

/* Targets — angular size in degrees; ra/dec (deg, J2000) enable survey fetch.
 * `aliases` are extra search terms (common names + alternate catalog numbers) so
 * the Target box finds the object however you type it (e.g. "Caldwell 4", "NGC 224"). */
const TARGETS = [
  { name: "Shark Nebula (LDN 1235)", wDeg: 3.9,   hDeg: 2.7,   kind: "dark",   ra: 333.30, dec: 73.37,
    aliases: ["LDN 1235", "vdB 149", "vdB 150", "Shark Nebula"] },
  { name: "Veil Nebula (full)",      wDeg: 3.0,   hDeg: 3.0,   kind: "neb",    ra: 312.75, dec: 30.70,
    aliases: ["Cygnus Loop", "NGC 6960", "NGC 6992", "NGC 6995", "Caldwell 33", "Caldwell 34",
              "Sh2-103", "Sharpless 103", "Western Veil", "Eastern Veil", "Witch's Broom"] },
  { name: "Andromeda (M31)",         wDeg: 3.17,  hDeg: 1.0,   kind: "galaxy", ra: 10.68,  dec: 41.27,
    aliases: ["M31", "Messier 31", "NGC 224", "Andromeda Galaxy"] },
  { name: "North America (NGC7000)", wDeg: 2.0,   hDeg: 1.7,   kind: "neb",    ra: 314.70, dec: 44.33,
    aliases: ["NGC 7000", "Caldwell 20", "Sh2-117", "Sharpless 117", "North America Nebula"] },
  { name: "Iris Nebula (NGC7023)",   wDeg: 0.3,   hDeg: 0.3,   kind: "neb",    ra: 315.40, dec: 68.17,
    aliases: ["NGC 7023", "Caldwell 4", "LBN 487", "vdB 139", "Iris Nebula"] },
  { name: "M81 / M82 pair",          wDeg: 0.7,   hDeg: 0.5,   kind: "galaxy", ra: 148.97, dec: 69.40,
    aliases: ["M81", "M82", "Messier 81", "Messier 82", "NGC 3031", "NGC 3034",
              "Bode's Galaxy", "Cigar Galaxy"] },
  { name: "M51 Whirlpool",           wDeg: 0.18,  hDeg: 0.12,  kind: "galaxy", ra: 202.47, dec: 47.20,
    aliases: ["M51", "Messier 51", "NGC 5194", "NGC 5195", "Whirlpool Galaxy"] },
  { name: "Ring Nebula (M57)",       wDeg: 0.038, hDeg: 0.038, kind: "pn",     ra: 283.40, dec: 33.03,
    aliases: ["M57", "Messier 57", "NGC 6720", "Ring Nebula"] },
  { name: "Seahorse (Barnard 150)",  wDeg: 1.5,   hDeg: 1.0,   kind: "dark",   ra: 312.60, dec: 60.30,
    aliases: ["Barnard 150", "B150", "LDN 1082", "Seahorse Nebula", "Dark Seahorse"] },
  { name: "Flying Bat (Sh2-129)",    wDeg: 2.5,   hDeg: 2.0,   kind: "neb",    ra: 317.42, dec: 59.97,
    aliases: ["Sh2-129", "Sharpless 129", "Flying Bat", "Flying Bat Nebula",
              "Ou4", "Squid Nebula", "vdB 140"] },
  { name: "LBN 446",                 wDeg: 0.2,   hDeg: 0.2,   kind: "neb",    ra: 319.25, dec: 58.58,
    aliases: ["LBN 446"] },
];

/* HiPS surveys offered by the "Fetch sky image" feature. DSS2 color is a safe
 * default; Mellinger is true-colour and great for wide bright regions;
 * Finkbeiner is all-sky H-alpha (emission nebulae pop); 2MASS is near-IR. */
const SURVEYS = [
  { name: "DSS2 color",        hips: "CDS/P/DSS2/color" },
  { name: "Mellinger (color)", hips: "CDS/P/Mellinger/color" },
  { name: "H-alpha (Finkbeiner)", hips: "CDS/P/Finkbeiner" },
  { name: "2MASS (near-IR)",   hips: "CDS/P/2MASS/color" },
];
