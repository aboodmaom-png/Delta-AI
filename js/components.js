// Shared topbar component. Every page includes this script and declares
// <header class="topbar" data-topbar data-active="..." data-eyebrow="..." data-title="..."></header>

const LQ_LOGO_SVG = `
  <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="lqLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5dd62c"/>
        <stop offset="100%" stop-color="#337418"/>
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="26" fill="url(#lqLogoGrad)"/>
    <path d="M50 24 L76 72 L24 72 Z" fill="#ffffff"/>
    <path d="M50 24 L76 72 L24 72 Z" fill="none" stroke="#0d1326" stroke-width="2" opacity="0.08"/>
  </svg>
`;

const LQ_MASCOT_SVG = `
  <svg viewBox="0 0 680 420" class="lq-mascot-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="lqBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8ef05a" />
        <stop offset="40%" stop-color="#5dd62c" />
        <stop offset="80%" stop-color="#337418" />
        <stop offset="100%" stop-color="#245011" />
      </linearGradient>
      <linearGradient id="lqScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#070a12" />
      </linearGradient>
      <filter id="lqShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.15" />
      </filter>
    </defs>

    <ellipse cx="340" cy="385" rx="110" ry="12" fill="#000000" opacity="0.12" />

    <g class="lq-mascot-arm-left" filter="url(#lqShadow)">
      <path d="M 240,200 Q 180,230 200,300 Q 220,330 240,290 Q 230,240 250,210 Z" fill="url(#lqBodyGrad)" />
      <circle cx="204" cy="298" r="16" fill="url(#lqBodyGrad)" />
    </g>

    <g class="lq-mascot-arm-right" filter="url(#lqShadow)">
      <path d="M 440,190 Q 510,160 520,110 Q 545,120 505,170 Q 465,220 435,200 Z" fill="url(#lqBodyGrad)" />
      <circle cx="516" cy="116" r="16" fill="url(#lqBodyGrad)" />
    </g>

    <g class="lq-mascot-legs">
      <rect x="290" y="310" width="45" height="50" rx="22" fill="url(#lqBodyGrad)" filter="url(#lqShadow)" />
      <circle cx="312" cy="362" r="16" fill="url(#lqBodyGrad)"></circle>
      <rect x="365" y="310" width="45" height="50" rx="22" fill="url(#lqBodyGrad)" filter="url(#lqShadow)" />
      <circle cx="388" cy="362" r="16" fill="url(#lqBodyGrad)"></circle>
    </g>

    <rect x="220" y="70" width="260" height="250" rx="75" fill="url(#lqBodyGrad)" filter="url(#lqShadow)" />

    <rect x="250" y="100" width="200" height="155" rx="48" fill="url(#lqScreenGrad)" />
    <rect x="252" y="102" width="196" height="151" rx="46" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.15" />

    <g class="lq-mascot-eyes">
      <ellipse cx="305" cy="160" rx="24" ry="26" fill="#ffffff" />
      <ellipse cx="308" cy="162" rx="13" ry="14" fill="#0f172a" />
      <circle cx="302" cy="154" r="5" fill="#ffffff" />
      <circle cx="314" cy="166" r="2.5" fill="#ffffff" />
      <ellipse cx="395" cy="160" rx="24" ry="26" fill="#ffffff" />
      <ellipse cx="392" cy="162" rx="13" ry="14" fill="#0f172a" />
      <circle cx="386" cy="154" r="5" fill="#ffffff" />
      <circle cx="398" cy="166" r="2.5" fill="#ffffff" />
    </g>

    <path class="lq-mascot-mouth" d="M 335,188 Q 350,202 365,188" stroke="#ffffff" stroke-width="4.5" fill="none" stroke-linecap="round" />
  </svg>
`;

function injectMascotStyles() {
  if (document.getElementById('lqMascotStyles')) return;
  const style = document.createElement('style');
  style.id = 'lqMascotStyles';
  style.textContent = `
    .lq-mascot { display: flex; align-items: center; justify-content: center; }
    .lq-mascot-svg { width: 100%; max-width: 260px; height: auto; animation: lqMascotFloat 3.2s ease-in-out infinite; }
    @keyframes lqMascotFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
}

function injectBrandFont() {
  if (document.getElementById('lqBrandFont')) return;
  const link = document.createElement('link');
  link.id = 'lqBrandFont';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.textContent = `.brand-group h1, .splash-title { font-family: 'Sora', sans-serif; letter-spacing: 0.2px; }`;
  document.head.appendChild(style);
}

function renderMascots() {
  const slots = document.querySelectorAll('[data-mascot]');
  if (!slots.length) return;
  injectMascotStyles();
  slots.forEach((slot, index) => {
    slot.classList.add('lq-mascot');
    const uniqueSuffix = `${Date.now()}${index}`;
    const uniqueSvg = LQ_MASCOT_SVG
      .replaceAll('lqBodyGrad', `lqBodyGrad${uniqueSuffix}`)
      .replaceAll('lqScreenGrad', `lqScreenGrad${uniqueSuffix}`)
      .replaceAll('lqShadow', `lqShadow${uniqueSuffix}`);
    slot.innerHTML = uniqueSvg;
  });
}

(function showSplash() {
  // The splash is a nice "app launch" moment, but showing it on every single
  // page navigation is jarring — especially since individual pages already
  // have their own transitions. So we only show it once per browser session:
  // the first page the user lands on shows it, and every navigation after that
  // skips it entirely. It comes back only when they close the tab/browser and
  // open the site fresh (which starts a new session).
  if (sessionStorage.getItem('splashShown')) {
    return;
  }
  sessionStorage.setItem('splashShown', '1');

  const splash = document.createElement('div');
  splash.id = 'appSplash';
  splash.innerHTML = `
    <div class="splash-logo">
      <div class="splash-circle">${LQ_LOGO_SVG}</div>
      <p class="splash-title">Delta AI</p>
    </div>
  `;
  document.body.appendChild(splash);
  document.body.style.overflow = 'hidden';

  window.addEventListener('load', () => {
    setTimeout(() => {
      splash.classList.add('splash-hide');
      document.body.style.overflow = '';
      setTimeout(() => splash.remove(), 500);
    }, 900);
  });
})();


(function () {
  const NAV_ITEMS = [
    { href: 'dashboard.html', label: 'الرئيسية', key: 'dashboard', icon: 'home' },
    { href: 'subjects.html', label: 'المواد', key: 'subjects', icon: 'book-open' },
    { href: 'learnquest-ai.html', label: 'المساعد', key: 'assistant', icon: 'bot' },
    { href: 'profile.html', label: 'الملف الشخصي', key: 'profile', icon: 'user' }
  ];

const GRADE_OPTIONS = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
  'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'
];

// Every page's content (subjects, lessons, challenges) is filtered by grade.
// A student without a saved grade — most commonly someone who signed up via
// Google, where auth.js has no grade to ask for at that point — would see
// broken or empty content everywhere. This blocks the app with a mandatory
// picker until a grade is saved, then reloads so everything downstream
// (lessons.js's GRADE_MAP filtering, etc.) works correctly from then on.
function showGradeGateModal(uid) {
  if (document.getElementById('gradeGateModal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'gradeGateModal';
  overlay.className = 'grade-gate-overlay';
  overlay.innerHTML = `
    <div class="grade-gate-card">
      <div class="grade-gate-icon">${LQ_LOGO_SVG}</div>
      <h2>شو صفك الدراسي؟</h2>
      <p>محتوى المنصة (المواد والدروس والتحديات) بيتغيّر حسب صفك، فلازم تختاره قبل ما تكمل.</p>
      <div class="grade-gate-options">
        ${GRADE_OPTIONS.map((g) => `<button type="button" class="grade-gate-option" data-grade="${g}">${g}</button>`).join('')}
      </div>
      <p class="grade-gate-error hidden" id="gradeGateError">صار خطأ أثناء الحفظ، حاول مرة أخرى.</p>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  overlay.querySelectorAll('.grade-gate-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      overlay.querySelectorAll('.grade-gate-option').forEach((b) => { b.disabled = true; });
      btn.classList.add('selected');

      try {
        const [{ db }, { doc, updateDoc }] = await Promise.all([
          import('./firebase.js'),
          import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
        ]);
        await updateDoc(doc(db, 'users', uid), { grade: btn.dataset.grade });
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

function renderBrand(eyebrow, title) {
  return `
    <div class="brand-group">
      <div class="brand-mark">${LQ_LOGO_SVG}</div>
      <div>
        ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
        <h1>${title}</h1>
      </div>
    </div>
  `;
}

function currentPageFile() {
  const file = window.location.pathname.split('/').pop();
  return file || 'dashboard.html';
}

function renderBottomNav() {
  // Never draw it twice (e.g. if renderTopbar somehow runs more than once).
  if (document.querySelector('[data-bottom-nav]')) return;

  const current = currentPageFile();

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('data-bottom-nav', '');
  nav.setAttribute('aria-label', 'التنقل الرئيسي');

  nav.innerHTML = NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="bottom-nav-item${item.href === current ? ' active' : ''}">
      <i data-lucide="${item.icon}"></i>
      <span>${item.label}</span>
    </a>
  `).join('');

  document.body.appendChild(nav);
  document.body.classList.add('has-bottom-nav');
}

 function renderAppTopbar(root) {
  const active = root.dataset.active || '';
  const eyebrow = root.dataset.eyebrow || '';
  const title = root.dataset.title || 'Delta AI';
    const navHtml = NAV_ITEMS.map(
      (item) => `<a href="${item.href}"${item.key === active ? ' class="active"' : ''}>${item.label}</a>`
    ).join('');

   root.innerHTML = `
      <div class="topbar-left">
        ${renderBrand(eyebrow, title)}
        <nav class="nav-links">${navHtml}</nav>
      </div>
      <div class="user-pill">
        <a href="login.html" class="logout-btn" id="navAuthAction" aria-label="تسجيل الدخول" title="تسجيل الدخول">
          <i data-lucide="log-in"></i>
        </a>
          <div class="user-pill-info" id="navUserInfo">
          <p class="hello-text" id="navHelloText">أهلاً، زائر</p>
          </div>
      </div>
    `;

    loadCurrentUser(root);
  }

  async function loadCurrentUser(root) {
    const helloEl = root.querySelector('#navHelloText');
    const authActionEl = root.querySelector('#navAuthAction');

    function setGuestState() {
      if (helloEl) helloEl.textContent = 'أهلاً، زائر';
      if (authActionEl) {
        authActionEl.href = 'login.html';
        authActionEl.setAttribute('aria-label', 'تسجيل الدخول');
        authActionEl.title = 'تسجيل الدخول';
        authActionEl.innerHTML = '<i data-lucide="log-in"></i>';
        if (window.lucide) window.lucide.createIcons();
      }
    }

    function setLoggedInState(name) {
      if (helloEl) helloEl.textContent = `أهلاً، ${name}`;
      if (authActionEl) {
        authActionEl.href = 'login.html';
        authActionEl.setAttribute('aria-label', 'تسجيل الخروج');
        authActionEl.title = 'تسجيل الخروج';
        authActionEl.innerHTML = '<i data-lucide="log-out"></i>';
        if (window.lucide) window.lucide.createIcons();
      }
    }

    try {
      const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
        import('./firebase.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setGuestState();
          return;
        }

        let name = user.displayName || (user.email ? user.email.split('@')[0] : 'طالب');

        try {
          const snapshot = await getDoc(doc(db, 'users', user.uid));
          if (snapshot.exists()) {
            const data = snapshot.data();
            name = data.name || name;

            if (!data.grade) {
              showGradeGateModal(user.uid);
            }
          } else {
            showGradeGateModal(user.uid);
          }
        } catch (error) {
          console.error('Failed to load user data for navbar:', error);
        }

        setLoggedInState(name);
      });
    } catch (error) {
      console.error('Failed to initialize Firebase for navbar:', error);
    }
  }

  function renderGuestTopbar(root) {
    const eyebrow = root.dataset.eyebrow || 'منصة تعليمية ذكية';
    const title = root.dataset.title || 'Delta AI';

    root.innerHTML = `
      <div class="topbar-left">
        ${renderBrand(eyebrow, title)}
      </div>
      <div class="guest-actions">
        <a href="login.html" class="secondary-btn">تسجيل الدخول</a>
        <a href="signup.html" class="primary-btn">إنشاء حساب</a>
      </div>
    `;
  }

  function renderAuthTopbar(root) {
    const eyebrow = root.dataset.eyebrow || 'منصة تعليمية ذكية';
    const title = root.dataset.title || 'Delta AI';

    root.innerHTML = `
      <div class="topbar-left">
        ${renderBrand(eyebrow, title)}
      </div>
      <a href="index.html" class="back-btn" aria-label="العودة للرئيسية" title="العودة للرئيسية">
        <i data-lucide="arrow-right"></i>
      </a>
    `;
  }

function renderMinimalTopbar(root) {
    const title = root.dataset.title || 'Delta AI';

    root.innerHTML = `
      <a href="dashboard.html" class="back-btn" aria-label="العودة للرئيسية" title="العودة للرئيسية">
        <i data-lucide="arrow-right"></i>
      </a>
      <div class="minimal-brand">
        <div class="brand-mark brand-mark-mini">${LQ_LOGO_SVG}</div>
        <h1 style="font-size: 1.1rem;">${title}</h1>
      </div>
    `;
  }

  function renderTopbar() {
    const root = document.querySelector('[data-topbar]');
    if (!root) return;

    const variant = root.dataset.variant || 'app';
    if (variant === 'guest') {
      renderGuestTopbar(root);
    } else if (variant === 'auth') {
      renderAuthTopbar(root);
    } else if (variant === 'minimal') {
      renderMinimalTopbar(root);
      renderBottomNav();
    } else {
      renderAppTopbar(root);
      renderBottomNav();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    injectBrandFont();
    renderTopbar();
    renderMascots();
  });
})();

(function pwaInstallBanner() {
  const DISMISS_KEY = 'installBannerDismissed';
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function dismissBanner() {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    banner.classList.remove('show');
    document.body.classList.remove('has-install-banner');
    setTimeout(() => banner.remove(), 400);
  }

  function createBanner(mode) {
    if (document.getElementById('installBanner')) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    if (isStandalone()) return;

    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'install-banner';

    const actionHtml = mode === 'ios'
      ? '<span class="install-banner-hint">اضغط زر المشاركة ⬆️ ثم "إضافة إلى الشاشة الرئيسية"</span>'
      : '<button type="button" class="install-banner-install-btn">تثبيت</button>';

    banner.innerHTML = `
      <div class="install-banner-icon">${LQ_LOGO_SVG}</div>
      <div class="install-banner-text">
        <strong>ثبّت تطبيق Delta AI</strong>
        <span>وصول أسرع من شاشتك الرئيسية</span>
      </div>
      ${actionHtml}
      <button type="button" class="install-banner-close" aria-label="إغلاق">×</button>
    `;

    document.body.appendChild(banner);
    document.body.classList.add('has-install-banner');
    requestAnimationFrame(() => banner.classList.add('show'));

    banner.querySelector('.install-banner-close')?.addEventListener('click', () => {
      sessionStorage.setItem(DISMISS_KEY, '1');
      dismissBanner();
    });

    banner.querySelector('.install-banner-install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      sessionStorage.setItem(DISMISS_KEY, '1');
      dismissBanner();
    });
  }

  // Android/Chrome: fires when the browser decides the site is installable.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    createBanner('android');
  });

  window.addEventListener('appinstalled', dismissBanner);

  // iOS Safari never fires beforeinstallprompt, so show manual steps instead.
  document.addEventListener('DOMContentLoaded', () => {
    if (isIos() && !isStandalone()) {
      createBanner('ios');
    }
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
   Internal page transitions
   Full page reloads between HTML files cause an abrupt flash — the old page
   vanishes, then the new one snaps in after Firebase and scripts load. This
   smooths that over with a fade so navigation feels like a single app.

   Two layers, chosen automatically:
   • Modern browsers → the View Transitions API for a genuinely smooth
     cross-page morph.
   • Everyone else → a plain CSS fade-out on click + fade-in on load.
   Nothing here changes any HTML; it only intercepts same-site link clicks
   and toggles a class the CSS animates.
   ========================================================================== */
(function pageTransitions() {
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (REDUCED_MOTION) return; // Respect users who ask for less motion.

  // If the user hits Back/Forward and the browser restores this page from
  // its cache while it was mid-fade-out (opacity 0), clear that class so the
  // page isn't left invisible.
  window.addEventListener('pageshow', () => {
    document.body.classList.remove('page-transition-out');
  });

  // --- Decide whether a clicked link should get a fade-out ---
  // We only animate genuine in-site navigations to another page.
  function isInternalNavigation(anchor) {
    if (!anchor) return false;
    if (anchor.target && anchor.target !== '_self') return false; // opens new tab
    if (anchor.hasAttribute('download')) return false;
    if (anchor.dataset.noTransition !== undefined) return false; // opt-out hook

    const href = anchor.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('#')) return false;                 // same-page anchor
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false; // external site
    // Same page (e.g. clicking the link you're already on) — nothing to do.
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
    return true;
  }

  const supportsViewTransitions = typeof document.startViewTransition === 'function';

  document.addEventListener('click', (event) => {
    // Ignore modified clicks (ctrl/cmd/middle-click open in new tab, etc.)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = event.target.closest('a');
    if (!isInternalNavigation(anchor)) return;

    const destination = anchor.href;

    if (supportsViewTransitions) {
      // Let the API own the animation. We prevent the default nav, run the
      // transition, and navigate inside it so the browser can cross-fade.
      event.preventDefault();
      document.startViewTransition(() => {
        window.location.href = destination;
      });
      return;
    }

    // Fallback: fade the current page out, then navigate. A short timeout
    // matches the CSS transition duration so the fade is actually seen.
    event.preventDefault();
    document.body.classList.add('page-transition-out');
    setTimeout(() => {
      window.location.href = destination;
    }, 220);
  });
})();