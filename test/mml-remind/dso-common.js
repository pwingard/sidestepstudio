// See the Show! DSOs — shared by object.html, browse.html and the planner pages (dome/animate): names, page addresses, and the sky-survey picture for a group.
const ALL_ROWS = window.DSO_CATALOG || [];
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const NICK_USES = {};                                             // generic nicknames ("Globular Cluster") are shared, so never an address
ALL_ROWS.forEach(r => { if (r[3]) (NICK_USES[slug(r[3])] ||= new Set).add(r[0]); });
// some catalog "nicknames" only say what kind of thing it is ("Asterism", "Spiral Galaxy in Leo", "Globular in Ara") — never a name
const GENERIC = n => /^(dwarf )?(barred )?((seyfert|spiral|elliptical|lenticular|irregular|peculiar|starburst|interacting|edge-on|ring|globular|open) )*(galaxy|cluster|spiral|elliptical|lenticular|globular)( with nebulosity)?( (in|near) .+)?$/i.test(n)
  || /^(emission|reflection|planetary|dark|diffuse|bright|hii|h ii)( nebula)?$|^supernova remnant$/i.test(n)   // "Emission Nebula" is a kind, not a name (Pete 2026-10-20: "i add sh2-119 and it gets listed as emission")
  || /^(asterism|reflection nebula|emission nebula|planetary nebula|spiral planetary nebula|dark nebula|dark cloud|supernova remnant|star forming region|cluster with nebulosity)( (in|near) .+)?$/i.test(n)
  || /^double cluster (in|near) /i.test(n);
const uniqueNick = r => r[3] && !GENERIC(r[3]) && NICK_USES[slug(r[3])].size === 1;
// the name a group goes by: the Messier object's own name (Pleiades, not Barnard's Merope Nebula inside it) — except when
// the Messier name is just "<X> Cluster" and a nebula is called "<X> …" (Eagle Nebula, not Eagle Cluster); then a nebula; then any name
const mainRow = rows => {
  const named = rows.filter(uniqueNick), m = named.find(r => /^M\d+$/.test(r[1]));
  const neb = named.find(r => r[4] === 'N' && (!m || (/ Cluster$/.test(m[3]) && r[3].split(' ')[0] === m[3].split(' ')[0])));
  return (m && !neb ? m : neb) || named.find(r => r[4] === 'N') || named[0] || rows.find(r => /^M\d+$/.test(r[1])) || rows[0];
};
const canonSlug = rows => { const r = mainRow(rows); return uniqueNick(r) ? slug(r[3]) : slug(r[1]); };
const bare = s => slug(s).replace(/-(nebula|galaxy|cluster)$/, '').replace(/-/g, '');   // "pacman" finds "Pacman Nebula"
function findSts(s) {
  const b = bare(s); s = slug(s);
  const hit = ALL_ROWS.find(r => slug(r[0]) === s || slug(r[1]) === s || (uniqueNick(r) && (slug(r[3]) === s || bare(r[3]) === b)) || String(r[2]).split(/\s*[,;]\s*/).some(a => a && slug(a) === s));
  return hit && hit[0];
}
const nameOf = rows => { const m = mainRow(rows); return uniqueNick(m) ? m[3] : m[1]; };   // M2, not "Globular Cluster"

// the sky-survey picture for a group, framed to the object's size, cut by CDS hips2fits. Default survey: Pan-STARRS
// (sharper; clean north of about −20°), DSS2 farther south. The picture bot (docs/check-pictures.py) writes dso-pick.js
// where the default looks wrong and another survey looks right — or null where none does (then there is no stand-in).
// dso-frame.js overrides the framing where the catalogue size misleads.
const SURVEYS = { 'CDS/P/PanSTARRS/DR1/color-z-zg-g':'Pan-STARRS1', 'CDS/P/DSS2/color':'DSS2', 'CDS/P/DESI-Legacy-Surveys/DR10/color':'DESI Legacy Surveys',
  'CDS/P/DECaPS/DR2/color':'DECaPS', 'CDS/P/Skymapper-color-IRG':'SkyMapper', 'CDS/P/DSS2/red':'DSS2 (red)' };
function surveyFor(rows, w = 900, h = 600, hips) {
  const F = window.DSO_FACTS || {}, m = mainRow(rows), sts = rows[0][0], ra = m[5], dec = m[6];
  const sizes = rows.map(r => F[r[1]]?.size).filter(Boolean).sort((a, b) => a - b);
  const size = F[m[1]]?.size ?? sizes[sizes.length >> 1];
  const fov = (window.DSO_FRAME || {})[sts] ?? (size ? Math.min(2.5, Math.max(0.12, 1.6*size/60)) : 0.6);   // degrees across
  const pick = (window.DSO_PICK || {})[sts];
  hips = hips || (pick !== undefined ? pick : dec > -20 ? 'CDS/P/PanSTARRS/DR1/color-z-zg-g' : 'CDS/P/DSS2/color');
  if (hips === null) return { size, fov, survey: null, src: null, credit: '' };
  return { size, fov, survey: SURVEYS[hips] || hips, hips,
    src: `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=${encodeURIComponent(hips)}&width=${w}&height=${h}&projection=TAN&fov=${fov.toFixed(3)}&ra=${ra}&dec=${dec}&format=jpg`,
    credit: `Sky survey view, ${fov >= 1 ? fov.toFixed(1) + '°' : Math.round(fov*60) + '′'} across (${SURVEYS[hips] || hips}, via CDS)` };
}
