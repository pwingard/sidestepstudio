// Astro Dust Buster — data
// Dust surveys served via CDS hips2fits (CORS-open, no key).
// Default to the IR dust tracers; DSS2 color kept as a "what your camera sees" reference.
const SURVEYS = [
  { id: "CDS/P/WISE/WSSA",          label: "WISE 12µm dust (WSSA) — recommended", bright: 1.4 },
  { id: "CDS/P/WISE/W3",            label: "WISE W3 12µm (warm dust)",            bright: 1.4 },
  { id: "CDS/P/AKARI/FIS/WideS",    label: "AKARI far-IR 90µm (cold dense dust)", bright: 1.6 },
  { id: "CDS/P/DSS2/color",         label: "DSS2 color (visible — what cameras see)", bright: 1.1 },
];

// A small seed so the dropdown is useful immediately; type anything else to resolve via Sesame.
// `q` is the bare catalog token Sesame understands (the display name's parenthetical breaks it).
const TARGETS = [
  { name: "M31 (Andromeda)",          q: "M31" },
  { name: "M42 (Orion Nebula)",       q: "M42" },
  { name: "M45 (Pleiades)",           q: "M45" },
  { name: "M81 (Bode's Galaxy)",      q: "M81" },
  { name: "M101 (Pinwheel)",          q: "M101" },
  { name: "Barnard 150 (Seahorse)",   q: "Barnard 150" },
  { name: "NGC 7000 (North America)", q: "NGC 7000" },
  { name: "IC 1396 (Elephant Trunk)", q: "IC 1396" },
  { name: "Polaris (IFN field)",      q: "Polaris" },
  { name: "M78",                      q: "M78" },
];
