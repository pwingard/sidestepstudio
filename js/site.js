/* Sidestep Studio — shared nav + footer (single source of truth).
   Each page: keep <header>…<nav></nav>…</header> and add
   <script src="/js/site.js" defer></script> before </body>. */
(function () {
  var NAV = [
    { t: 'Apps',             href: '/apps.html' },
    { t: 'Astrophotography', href: '/astrophotography.html' },
    { t: 'Watch',            href: '/watch.html' },
    { t: 'Shop',             href: '/shop.html' },
    { t: 'About',            href: '/about.html' },
    { t: 'Contact',          href: '/#contact' }
  ];
  var SOCIAL = [
    { t: 'Instagram', href: 'https://instagram.com/see_theshow' },
    { t: 'X',         href: 'https://x.com/see_theshow' },
    { t: 'Facebook',  href: 'https://facebook.com/seetheshow87' },
    { t: 'YouTube',   href: 'https://www.youtube.com/@See_theShow' }
  ];

  // ---- inject shared styles (uses the site's CSS vars) ----
  var css = ''
    + 'header nav{display:flex;flex-wrap:wrap;align-items:center}'
    + 'header nav a{color:var(--muted);text-decoration:none;margin-left:22px;font-weight:600;font-size:.95rem;transition:color .15s}'
    + 'header nav a:hover,header nav a.active{color:var(--accent)}'
    + '@media(max-width:600px){header nav a{margin-left:14px;font-size:.82rem}}'
    + '.site-footer{border-top:1px solid var(--border);margin-top:64px;padding:34px 0;color:var(--muted);text-align:center}'
    + '.site-footer .foot-social{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:center;font-size:.95rem}'
    + '.site-footer .foot-social strong{color:var(--text)}'
    + '.site-footer a{color:var(--muted);text-decoration:none}'
    + '.site-footer a:hover{color:var(--accent)}'
    + '.site-footer .foot-copy{margin-top:14px;font-size:.82rem}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---- current path (for active state) ----
  var path = location.pathname.replace(/index\.html$/, '');
  if (path.length > 1) path = path.replace(/\/$/, '');

  // ---- logo (consistent wordmark site-wide) ----
  var logo = document.querySelector('.logo');
  if (logo) logo.innerHTML = 'See the Show&rsquo;s Sidestep<span>Studio</span>';

  // ---- nav ----
  var nav = document.querySelector('header nav');
  if (nav) {
    nav.innerHTML = NAV.map(function (i) {
      var base = i.href.replace(/\/$/, '') || '/';
      var active = (base === path) || (base !== '/' && path.indexOf(base) === 0);
      return '<a href="' + i.href + '"' + (active ? ' class="active"' : '') + '>' + i.t + '</a>';
    }).join('');
  }

  // ---- footer (reuse existing <footer> if present, else append) ----
  var social = SOCIAL.map(function (s) {
    return '<a href="' + s.href + '" target="_blank" rel="noopener">' + s.t + '</a>';
  }).join('');
  var footHTML = '<div class="container">'
    + '<div class="foot-social"><span>Follow <strong>See the Show</strong></span>' + social + '</div>'
    + '<div class="foot-copy">&copy; 2026 Sidestep Studio, LLC &nbsp;·&nbsp; <a href="/moondance/privacy.html">Privacy</a></div>'
    + '</div>';
  var f = document.querySelector('footer');
  if (!f) { f = document.createElement('footer'); document.body.appendChild(f); }
  f.className = 'site-footer';
  f.innerHTML = footHTML;
})();
