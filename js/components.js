// Shared UI for every page: app bar, bottom tab bar, Delta mascot slots,
// the animated splash, the grade gate, the install banner and page transitions.
// Pages declare: <header class="topbar" data-topbar data-variant="app|guest|auth|minimal" data-page-title="..."></header>
// Needs js/delta-character.js loaded before this file (window.DeltaChar).

// App icon / logo: Delta's face on green.
const LQ_LOGO_SVG = `
  <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="100" height="100" fill="#3CC46B"/><rect y="90" width="100" height="10" fill="#23A356"/>
    <path d="M50 25 V13" stroke="#1B2A3A" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="50" cy="10" r="5.6" fill="#FFC21A" stroke="#1B2A3A" stroke-width="2.4"/>
    <rect x="12" y="25" width="76" height="60" rx="25" fill="#26394D"/><rect x="14" y="27" width="72" height="56" rx="23" fill="#1B2A3A"/>
    <ellipse cx="37" cy="51" rx="10.5" ry="12.5" fill="#fff"/><circle cx="38" cy="53" r="5.2" fill="#1B2A3A"/><circle cx="39.8" cy="49.6" r="2.1" fill="#fff"/>
    <ellipse cx="63" cy="51" rx="10.5" ry="12.5" fill="#fff"/><circle cx="64" cy="53" r="5.2" fill="#1B2A3A"/><circle cx="65.8" cy="49.6" r="2.1" fill="#fff"/>
    <path d="M40 69 Q50 77.5 60 69" fill="none" stroke="#E2FCEF" stroke-width="4.4" stroke-linecap="round"/>
  </svg>
`;

const REDUCED_MOTION_UI = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function deltaMarkup(opts = {}) {
  if (!window.DeltaChar) return '';
  return window.DeltaChar.svg({ animate: !REDUCED_MOTION_UI, ...opts });
}

// [data-mascot] slots become Delta. A slot can set data-mood, data-arms, data-prop;
// otherwise its class decides a sensible pose.
const MASCOT_DEFAULTS = [
  ['page-load-mascot', { mood: 'think', headOnly: true }],
  ['submit-blur-mascot', { mood: 'think', headOnly: true }],
  ['coach-mascot', { mood: 'happy', headOnly: true }],
  ['revisit-mascot', { mood: 'happy', headOnly: true }],
  ['state-mascot', { mood: 'think', headOnly: true }],
  ['chat-mascot-slot', { mood: 'happy', headOnly: true }],
];
function renderMascots() {
  document.querySelectorAll('[data-mascot]').forEach((slot) => {
    const byClass = MASCOT_DEFAULTS.find(([cls]) => slot.classList.contains(cls));
    const base = byClass ? byClass[1] : { mood: 'neutral', arms: 'rest' };
    const opts = {
      ...base,
      ...(slot.dataset.mood ? { mood: slot.dataset.mood } : {}),
      ...(slot.dataset.arms ? { arms: slot.dataset.arms } : {}),
      ...(slot.dataset.prop !== undefined && slot.dataset.prop !== '' ? { prop: slot.dataset.prop } : {}),
      ...(slot.dataset.headOnly !== undefined ? { headOnly: true } : {}),
      label: slot.dataset.label || 'دلتا',
    };
    slot.classList.add('lq-mascot');
    slot.innerHTML = deltaMarkup(opts);
  });
}
window.renderDeltaMascots = renderMascots;

/* ==========================================================================
   Splash: once per browser session — the logo and name fade in, then the
   app appears. Short on purpose; tap skips it.
   ========================================================================== */
(function showSplash() {
  try {
    if (sessionStorage.getItem('splashShown')) return;
    sessionStorage.setItem('splashShown', '1');
  } catch (e) { /* storage blocked: still show it once on this load */ }

  const splash = document.createElement('div');
  splash.id = 'appSplash';
  splash.setAttribute('role', 'presentation');
  splash.innerHTML = `
    <div class="splash-center">
      <span class="splash-logo">${LQ_LOGO_SVG}</span>
      <span class="splash-name">دلتا</span>
      <span class="splash-tag">تعلّم من حياتك</span>
    </div>
  `;
  document.body.appendChild(splash);

  let loaded = document.readyState === 'complete';
  let minTimePassed = false;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    splash.classList.add('splash-hide');
    setTimeout(() => splash.remove(), 400);
  };
  const tryFinish = () => { if (loaded && minTimePassed) finish(); };
  window.addEventListener('load', () => { loaded = true; tryFinish(); });
  setTimeout(() => { minTimePassed = true; tryFinish(); }, REDUCED_MOTION_UI ? 300 : 1100);
  setTimeout(finish, 5000); // never block the app
  splash.addEventListener('click', finish);
})();

(function () {
  const NAV_ITEMS = [
    { href: 'dashboard.html', label: 'الرئيسية', key: 'dashboard', icon: 'home' },
    { href: 'subjects.html', label: 'المواد', key: 'subjects', icon: 'book-open' },
    { href: 'learnquest-ai.html', label: 'اسأل دلتا', key: 'assistant', icon: 'sparkles' },
    { href: 'profile.html', label: 'حسابي', key: 'profile', icon: 'user' }
  ];

  const GRADE_OPTIONS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];

  // Content is filtered by grade, so a student without one (usually a Google
  // sign-up) must pick it before using the app.
  function showGradeGateModal(uid) {
    if (document.getElementById('gradeGateModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'gradeGateModal';
    overlay.className = 'grade-gate-overlay';
    overlay.innerHTML = `
      <div class="grade-gate-card" role="dialog" aria-modal="true" aria-labelledby="gradeGateTitle">
        <div class="grade-gate-icon">${deltaMarkup({ mood: 'think', arms: 'rest', label: 'دلتا بيسأل' })}</div>
        <h2 id="gradeGateTitle">بأي صف إنت؟</h2>
        <p>المواد والدروس والتحديات بتتغيّر حسب صفك، فاختاره عشان نبلش.</p>
        <div class="grade-gate-options">
          ${GRADE_OPTIONS.map((g) => `<button type="button" class="grade-gate-option" data-grade="${g}">${g}</button>`).join('')}
        </div>
        <p class="grade-gate-error hidden" id="gradeGateError">صار خطأ أثناء الحفظ، جرّب مرة ثانية.</p>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelectorAll('.grade-gate-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        overlay.querySelectorAll('.grade-gate-option').forEach((b) => { b.disabled = true; });
        btn.classList.add('selected');
        try {
          // setDoc with merge: the user document may not exist yet (Google sign-up).
          const [{ db }, { doc, setDoc }] = await Promise.all([
            import('./firebase.js'),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
          ]);
          await setDoc(doc(db, 'users', uid), { grade: btn.dataset.grade }, { merge: true });
          document.body.style.overflow = '';
          window.location.reload();
        } catch (error) {
          console.error('Failed to save grade:', error);
          document.getElementById('gradeGateError')?.classList.remove('hidden');
          overlay.querySelectorAll('.grade-gate-option').forEach((b) => { b.disabled = false; });
          btn.classList.remove('selected');
        }
      });
    });
  }

  function brandHtml(href = 'dashboard.html') {
    return `<a href="${href}" class="brand" aria-label="دلتا — الرئيسية">
      <span class="brand-mark">${LQ_LOGO_SVG}</span><span class="brand-name">دلتا</span></a>`;
  }

  function currentPageFile() {
    return window.location.pathname.split('/').pop() || 'dashboard.html';
  }

  function renderBottomNav() {
    if (document.querySelector('[data-bottom-nav]')) return;
    const current = currentPageFile();
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('data-bottom-nav', '');
    nav.setAttribute('aria-label', 'التنقل الرئيسي');
    nav.innerHTML = NAV_ITEMS.map((item) => `
      <a href="${item.href}" class="bottom-nav-item${item.href === current ? ' active' : ''}"${item.href === current ? ' aria-current="page"' : ''}>
        <i data-lucide="${item.icon}"></i><span>${item.label}</span>
      </a>`).join('');
    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');
  }

  function renderAppTopbar(root) {
    const active = root.dataset.active || '';
    const navHtml = NAV_ITEMS.map((item) =>
      `<a href="${item.href}"${item.key === active ? ' class="active" aria-current="page"' : ''}><i data-lucide="${item.icon}"></i>${item.label}</a>`).join('');
    root.innerHTML = `
      ${brandHtml()}
      <nav class="nav-links" aria-label="التنقل الرئيسي">${navHtml}</nav>
      <div class="bar-actions">
        <span class="xp-chip" id="navXp" title="نقاطك"><i data-lucide="zap"></i><span dir="ltr">0 XP</span></span>
        <a href="profile.html" class="avatar-btn" id="navAvatar" aria-label="حسابي">؟</a>
      </div>
    `;
    loadCurrentUser(root);
  }

  async function loadCurrentUser(root) {
    const xpEl = root.querySelector('#navXp span');
    const avatarEl = root.querySelector('#navAvatar');
    try {
      const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
        import('./firebase.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (avatarEl) { avatarEl.href = 'login.html'; avatarEl.setAttribute('aria-label', 'تسجيل الدخول'); }
          return;
        }
        let name = user.displayName || (user.email ? user.email.split('@')[0] : 'طالب');
        let xp = 0;
        try {
          const snapshot = await getDoc(doc(db, 'users', user.uid));
          if (snapshot.exists()) {
            const data = snapshot.data();
            name = data.name || name;
            xp = typeof data.xp === 'number' ? data.xp : 0;
            if (!data.grade) showGradeGateModal(user.uid);
          } else {
            showGradeGateModal(user.uid);
          }
        } catch (error) {
          console.error('Failed to load user data for the app bar:', error);
        }
        if (xpEl) xpEl.textContent = `${xp.toLocaleString('en-US')} XP`;
        if (avatarEl) {
          avatarEl.textContent = (name.trim()[0] || '؟');
          avatarEl.setAttribute('aria-label', `حسابي — ${name}`);
          avatarEl.title = name;
        }
      });
    } catch (error) {
      console.error('Failed to initialize Firebase for the app bar:', error);
    }
  }

  function renderGuestTopbar(root) {
    root.innerHTML = `
      ${brandHtml('index.html')}
      <div class="guest-actions">
        <a href="login.html" class="secondary-btn">تسجيل الدخول</a>
        <a href="signup.html" class="primary-btn">ابدأ مجاناً</a>
      </div>
    `;
  }

  function renderAuthTopbar(root) {
    root.innerHTML = `
      ${brandHtml('index.html')}
      <a href="index.html" class="back-btn" aria-label="رجوع للصفحة الرئيسية" title="رجوع"><i data-lucide="arrow-right"></i></a>
    `;
  }

  function renderMinimalTopbar(root) {
    const title = root.dataset.pageTitle || 'اسأل دلتا';
    root.innerHTML = `
      <div class="minimal-brand">
        <a href="dashboard.html" class="back-btn" aria-label="رجوع للرئيسية" title="رجوع"><i data-lucide="arrow-right"></i></a>
        <span class="brand-mark brand-mark-mini">${LQ_LOGO_SVG}</span>
        <span class="page-title">${title}</span>
      </div>
      <div class="bar-actions">
        <span class="xp-chip" id="navXp"><i data-lucide="zap"></i><span dir="ltr">0 XP</span></span>
      </div>
    `;
    loadCurrentUser(root);
  }

  function renderTopbar() {
    const root = document.querySelector('[data-topbar]');
    if (!root) return;
    const variant = root.dataset.variant || 'app';
    if (variant === 'guest') renderGuestTopbar(root);
    else if (variant === 'auth') renderAuthTopbar(root);
    else if (variant === 'minimal') { renderMinimalTopbar(root); renderBottomNav(); }
    else { renderAppTopbar(root); renderBottomNav(); }
    if (window.lucide) window.lucide.createIcons();
  }

  // Site footer for public pages: <footer data-footer></footer>
  function renderFooter() {
    const root = document.querySelector('[data-footer]');
    if (!root) return;
    root.classList.add('site-footer');
    root.innerHTML = `
      <div class="site-footer-inner">
        <div class="site-footer-brand">
          ${brandHtml('index.html')}
          <p>منصة تعليمية بالذكاء الاصطناعي للصفوف من الأول للتاسع.</p>
        </div>
        <nav class="site-footer-links" aria-label="روابط الموقع">
          <a href="about.html">عن دلتا</a>
          <a href="privacy.html">سياسة الخصوصية</a>
          <a href="about.html#contact">تواصل معنا</a>
        </nav>
      </div>
      <p class="site-footer-note">© ${new Date().getFullYear()} دلتا. صُنع بحب لطلابنا.</p>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTopbar();
    renderFooter();
    renderMascots();
    if (window.lucide) window.lucide.createIcons();
  });
})();

// The AI server sleeps when nobody uses it (free hosting). Every page pings it
// on open, so by the time a student asks something it is already awake.
(function warmUpAiServer() {
  const HEALTH_URL = 'https://delta-ai-backend-aq3d.onrender.com/health';
  try {
    const last = Number(sessionStorage.getItem('deltaWarmAt') || 0);
    if (Date.now() - last < 4 * 60 * 1000) return;
    sessionStorage.setItem('deltaWarmAt', String(Date.now()));
  } catch (error) { /* storage blocked: ping anyway */ }
  fetch(HEALTH_URL, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
})();

(function pwaInstallBanner() {
  const DISMISS_KEY = 'installBannerDismissed';
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  function dismissBanner() {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
  }

  function createBanner(mode) {
    if (document.getElementById('installBanner')) return;
    try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch (e) {}
    if (isStandalone()) return;
    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'install-banner';
    const actionHtml = mode === 'ios'
      ? '<span class="install-banner-hint">اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»</span>'
      : '<button type="button" class="install-banner-install-btn">تثبيت</button>';
    banner.innerHTML = `
      <div class="install-banner-icon">${LQ_LOGO_SVG}</div>
      <div class="install-banner-text"><strong>ثبّت تطبيق دلتا</strong><span>افتحه بلمسة من شاشتك الرئيسية</span></div>
      ${actionHtml}
      <button type="button" class="install-banner-close" aria-label="إغلاق">×</button>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    banner.querySelector('.install-banner-close')?.addEventListener('click', () => {
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      dismissBanner();
    });
    banner.querySelector('.install-banner-install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      dismissBanner();
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    createBanner('android');
  });
  window.addEventListener('appinstalled', dismissBanner);
  document.addEventListener('DOMContentLoaded', () => {
    if (isIos() && !isStandalone()) createBanner('ios');
  });
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

/* ==========================================================================
   Page transitions: a gentle fade between pages (View Transitions API where
   available, a CSS fade otherwise). Respects reduced motion.
   ========================================================================== */
(function pageTransitions() {
  if (REDUCED_MOTION_UI) return;
  window.addEventListener('pageshow', () => document.body.classList.remove('page-transition-out'));

  function isInternalNavigation(anchor) {
    if (!anchor) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.dataset.noTransition !== undefined) return false;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return true;
  }

  const supportsViewTransitions = typeof document.startViewTransition === 'function';
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    if (!isInternalNavigation(anchor)) return;
    const destination = anchor.href;
    event.preventDefault();
    if (supportsViewTransitions) {
      document.startViewTransition(() => { window.location.href = destination; });
      return;
    }
    document.body.classList.add('page-transition-out');
    setTimeout(() => { window.location.href = destination; }, 200);
  });
})();
