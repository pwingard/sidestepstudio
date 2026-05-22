# FOV Planner

An offline-capable, installable PWA that draws — to scale — how different camera
sensors frame a deep-sky target through a given telescope/corrector config. It
overlays sensor rectangles and the image circle on a schematic of the target,
and reports field of view, pixel scale (arcsec/pixel), and a plain-language
"does it fit" verdict.

No build step, no framework, no npm — plain HTML/CSS/vanilla JS. Host it on
GitHub Pages or open it from any static server.

## Run locally

From the project directory:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/> on this computer.

> **Service workers (offline + install) require HTTPS or `localhost`.** Over a
> plain `http://<lan-ip>:8000` address the service worker will **not** register,
> so the app runs but won't install or cache offline. To install on your phone,
> use an HTTPS host — see below.

## Install on iPhone (full-screen, offline)

iOS only honors PWA install from **Safari** (not Chrome).

1. Serve the app from an **HTTPS** URL — the simplest is GitHub Pages (push this
   folder to a repo, enable Pages on the branch root), or any static host.
2. Open that URL in **Safari** on the iPhone.
3. Tap **Share → "Add to Home Screen."**
4. Launch from the new icon: it opens full-screen, portrait, and works offline
   after the first load (all assets are precached by `sw.js`).

If you change any asset later, bump `CACHE_VERSION` in `sw.js` so phones pull
the new version.

## Editing the data (scopes / cameras / targets)

All gear and targets live in **`data.js`**, kept separate from the logic so you
never have to touch `app.js`. The top of that file documents every column and
unit. In short:

- **`SCOPES`** — each row is a final `(focalLength mm, fRatio)` pair (the
  reducer/flattener/extender is already baked in — store the *resulting* numbers,
  not multipliers). `imageCircle` is per-config in mm (default 43.3 full-frame).
- **`CAMERAS`** — `wMM`/`hMM` sensor size in mm, `pixelMicron` pixel pitch,
  `mp` for display only, `owned: true` to sort/badge your gear first.
- **`TARGETS`** — `wDeg`/`hDeg` angular size in degrees, `kind` is one of
  `dark` / `neb` / `galaxy` / `pn` (controls only the schematic blob).

Save and reload (or reinstall on the phone).

## The math

- Sensor FOV per axis (deg): `2 * atan((dim_mm/2) / focal_mm) * 180/π`
- Pixel scale: `(pixel_micron / focal_mm) * 206.265` arcsec/pixel
- Image-circle angular diameter: same arctangent form on the circle's mm diameter
- "Fits": `sensor_fov_w >= target_w AND sensor_fov_h >= target_h` (rotation
  ignored in v1)

## Files

| File | Purpose |
|------|---------|
| `index.html` | markup, meta tags, service-worker registration |
| `styles.css` | all styling (dark theme) |
| `data.js` | the three editable arrays — **edit this one** |
| `app.js` | math, rendering, event wiring |
| `manifest.webmanifest` | PWA manifest |
| `sw.js` | precache service worker (cache-first) |
| `icons/` | 192px + 512px app icons |

## Object images (optional)

Each target can show a **real sky image** behind the sensor frames instead of
the schematic blob — so you can see how your camera frames an object you don't
own. Two ways, in the **Object image** panel under the diagram:

### Find any object by name
Not limited to the seeded list. In **Find object by name**, type an identifier
(`M42`, `NGC 7000`, `Sh2-129`, `vdB 152`…) and tap **Find**. The app resolves it
to coordinates via **CDS Sesame** (SIMBAD/NED/VizieR), adds it as a **★ custom
target** (saved in `localStorage`), and selects it. Sesame returns coordinates
but not size, so set an **approximate size** in the custom-target editor (for
the fit verdict) — then fetch a sky image to judge framing visually. **Delete
this target** removes it. Needs network for the name lookup.

### Fetch from a sky survey (recommended)
For any target with `ra`/`dec` in `data.js`, pick a **Sky survey**, set a
**Field width (°)**, and tap **Fetch sky image**. The app pulls a real cutout
from CDS **hips2fits** centred on the object at *exactly* that field — so the
scale is known by construction, **no plate-solving needed**. Surveys offered:
DSS2 colour, Mellinger (colour), H-alpha (Finkbeiner), 2MASS (near-IR). Edit
the `SURVEYS` array to add more HiPS.

- Requires **network at fetch time** (do it on wifi). The result is cached
  **offline in IndexedDB**, so afterwards it works with no connection.
- **Move frame** arrows slide your sensor/optics over the fixed sky to hunt the
  best composition; **◎** re-centres.
- **Image brightness** slider lifts dim cutouts (DSS dark nebulae start
  brightened); the frame/circle overlays are dimmed over any photo so they don't
  bury a faint backdrop.

### Upload your own
Tap **Upload your own photo**, then set **Image field width (°)** — how wide the
photo is on the sky. The app scales it to match. If you know the capture scale:
`width(°) = (arcsec/px × pixels_wide) / 3600`. Uploaded photos are downscaled
and cached offline per target.

`Remove image` clears either kind for the current target.

## Out of scope for v1 (future work)

- Frame rotation / position-angle.
- Automatic plate-solving of *uploaded* images (for survey fetch the scale is
  already known; for an arbitrary uploaded image you enter the field width by
  hand, since blind solving needs a network service or heavy in-browser
  indexes). Solve such images on the desktop (ASTAP / Siril) if needed.
- Frame offset is a free 2-D nudge, not true RA/Dec repointing.
- Mosaic panel calculation.
- Saved / favorite setups.
- A larger target catalog — extend `data.js` as needed.
