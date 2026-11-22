import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Platform is scoped to Mathematics and Science only. Arabic/English subject
// documents may still exist in Firestore, but they are filtered out here
// rather than deleted from the database.
const ALLOWED_SUBJECT_KEYWORDS = ['رياضي', 'math', 'علوم', 'science'];

function isAllowedSubject(name) {
  if (!name) return false;
  const normalized = String(name).toLowerCase();
  return ALLOWED_SUBJECT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

let currentUser = null;
let authReadyResolve;
const authReady = new Promise((resolve) => { authReadyResolve = resolve; });

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authReadyResolve();
});

const GRADE_MAP = {
  'الأول': 1,
  'الثاني': 2,
  'الثالث': 3,
  'الرابع': 4,
  'الخامس': 5,
  'السادس': 6,
  'السابع': 7,
  'الثامن': 8,
  'التاسع': 9,
  'العاشر': 10,
  'الحادي عشر': 11,
  'الثاني عشر': 12
};

// Pilot phase: content only exists for these grades.
const ALLOWED_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/* ===== نظام مستويات الدروس =====
   المسار المتعرّج = مستوى واحد. إكمال كل عقده ينقل الطالب للمستوى التالي.
   المستويات محسوبة من ترتيب الدروس (order) — بدون تعديل قاعدة البيانات. */
const TARGET_LESSONS_PER_LEVEL = 5;
const MIN_LESSONS_PER_LEVEL = 3;

function lessonsPerLevel(totalLessons) {
  if (totalLessons <= TARGET_LESSONS_PER_LEVEL + 1) return totalLessons;
  const levelCount = Math.round(totalLessons / TARGET_LESSONS_PER_LEVEL);
  const perLevel = Math.ceil(totalLessons / Math.max(1, levelCount));
  return Math.max(MIN_LESSONS_PER_LEVEL, perLevel);
}

function splitIntoLevels(allLessons) {
  const size = lessonsPerLevel(allLessons.length);
  const levels = [];
  for (let i = 0; i < allLessons.length; i += size) {
    levels.push(allLessons.slice(i, i + size));
  }
  return levels;
}

function findCurrentLevelIndex(levels, completedLessonIds) {
  for (let i = 0; i < levels.length; i++) {
    const allDone = levels[i].every((lesson) => completedLessonIds.has(lesson.id));
    if (!allDone) return i;
  }
  return levels.length - 1;
}

async function syncProfileLevel(newLevel) {
  if (!currentUser || !newLevel) return;
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    const stored = snap.exists() && typeof snap.data().level === 'number' ? snap.data().level : 1;
    if (newLevel > stored) {
      await updateDoc(userRef, { level: newLevel });
    }
  } catch (error) {
    console.error('Failed to sync profile level:', error);
  }
}

const NODE_GAP_Y = 130;
const CENTER_X = 160;
const ZIGZAG_PATTERN = [-78, 78];

function xForIndex(i) {
  return CENTER_X + ZIGZAG_PATTERN[i % ZIGZAG_PATTERN.length];
}

function buildPathD(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midY = (p1.y + p2.y) / 2;
    d += ` C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Path colours (match css/shared.css tokens)
const PATH_COLORS = {
  green: '#3CC46B', greenLip: '#23A356',
  locked: '#E8E1D3', lockedLip: '#D3C9B6', lockedInk: '#A69C8A',
  track: '#EDE6D8', done: '#3CC46B'
};

function nodeMarkup(lesson, index, state, cx, cy) {
  const stateClass = `lesson-node lesson-node-${state}`;
  const C = PATH_COLORS;
  const label = `${lesson.title || 'درس'}${state === 'locked' ? ' (مقفل)' : ''}`.replace(/"/g, '&quot;');

  let inner = '';
  if (state === 'completed') {
    inner = `<circle cx="${cx}" cy="${cy + 6}" r="33" fill="${C.greenLip}"/>
      <circle cx="${cx}" cy="${cy}" r="33" fill="${C.green}"/>
      <ellipse cx="${cx - 11}" cy="${cy - 15}" rx="9" ry="5" fill="#fff" opacity=".28" transform="rotate(-30 ${cx - 11} ${cy - 15})"/>
      <path d="M ${cx - 13} ${cy + 1} L ${cx - 3} ${cy + 11} L ${cx + 15} ${cy - 11}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (state === 'current') {
    inner = `<circle class="lesson-node-ring" cx="${cx}" cy="${cy + 3}" r="46" fill="none" stroke="${C.green}" stroke-width="5" opacity=".35"/>
      <circle cx="${cx}" cy="${cy + 7}" r="37" fill="${C.greenLip}"/>
      <circle cx="${cx}" cy="${cy}" r="37" fill="${C.green}"/>
      <ellipse cx="${cx - 12}" cy="${cy - 17}" rx="10" ry="5.5" fill="#fff" opacity=".28" transform="rotate(-30 ${cx - 12} ${cy - 17})"/>
      <path d="M ${cx} ${cy - 17} l 5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7 z" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
      <g class="lesson-start-tag">
        <rect x="${cx - 32}" y="${cy - 86}" width="64" height="32" rx="11" fill="#ffffff" stroke="#EDE6D8" stroke-width="2.5"/>
        <path d="M ${cx - 7} ${cy - 55.5} L ${cx} ${cy - 47} L ${cx + 7} ${cy - 55.5} Z" fill="#ffffff" stroke="#EDE6D8" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="${cx - 9}" y="${cy - 58}" width="18" height="4" fill="#ffffff"/>
        <text x="${cx}" y="${cy - 64}" text-anchor="middle" font-size="16" font-weight="800" fill="#158246">ابدأ</text>
      </g>`;
  } else {
    inner = `<circle cx="${cx}" cy="${cy + 6}" r="31" fill="${C.lockedLip}"/>
      <circle cx="${cx}" cy="${cy}" r="31" fill="${C.locked}"/>
      <rect x="${cx - 11}" y="${cy - 2}" width="22" height="16" rx="4" fill="${C.lockedInk}"/>
      <path d="M ${cx - 7} ${cy - 2} v -5 a 7 7 0 0 1 14 0 v 5" fill="none" stroke="${C.lockedInk}" stroke-width="3.5"/>`;
  }

  return `<g class="${stateClass}" data-lesson-index="${index}" tabindex="0" role="button" aria-label="${label}">${inner}</g>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('lessonsGrid');
  if (!container) return;

  const loadOverlay = document.getElementById('lessonsLoadOverlay');
  function hideLoadOverlay() {
    loadOverlay?.classList.add('hidden');
  }

  await authReady;

  let studentGradeNumber = null;

  if (currentUser) {
    try {
      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (userSnap.exists()) {
        studentGradeNumber = GRADE_MAP[userSnap.data().grade] || null;
        if (studentGradeNumber && !ALLOWED_GRADES.includes(studentGradeNumber)) {
          container.innerHTML = '<p class="empty-message">التحديات متاحة حاليًا فقط لطلاب الصف الأول حتى الصف التاسع. سيتم إضافة صفوف أخرى قريبًا.</p>';
          hideLoadOverlay();
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check student grade:', error);
    }
  }

  const subjectId = sessionStorage.getItem('selectedSubjectId');

  container.innerHTML = '<div class="lesson-path-wrap"><p class="empty-message">جاري تحميل الدروس...</p></div>';

  if (!subjectId) {
    container.innerHTML = '<p class="empty-message">لم يتم اختيار مادة. الرجاء العودة واختيار مادة أولاً.</p>';
    hideLoadOverlay();
    return;
  }

  let lessons = [];

  try {
    const subjectSnap = await getDoc(doc(db, 'subjects', subjectId));
    if (!subjectSnap.exists() || !isAllowedSubject(subjectSnap.data().name)) {
      container.innerHTML = '<p class="empty-message">هذه المادة لم تعد متاحة على المنصة.</p>';
      hideLoadOverlay();
      return;
    }

    const subjectNameEl = document.getElementById('lessonsSubjectName');
    if (subjectNameEl) subjectNameEl.textContent = subjectSnap.data().name || 'مسار الدروس';

    const lessonsQuery = query(collection(db, 'lessons'), where('subject', '==', subjectId));
    const snapshot = await getDocs(lessonsQuery);

    if (snapshot.empty) {
      container.innerHTML = '<p class="empty-message">لا توجد دروس متاحة لهذه المادة حاليًا.</p>';
      hideLoadOverlay();
      return;
    }

    lessons = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((lesson) => !studentGradeNumber || lesson.grade === studentGradeNumber)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (!lessons.length) {
      container.innerHTML = '<p class="empty-message">لا توجد دروس متاحة لصفك الدراسي بهذه المادة حاليًا.</p>';
      hideLoadOverlay();
      return;
    }
  } catch (error) {
    console.error('Failed to load lessons:', error);
    container.innerHTML = '<p class="empty-message">تعذّر تحميل الدروس، حاول تحديث الصفحة.</p>';
    hideLoadOverlay();
    return;
  }

  // Figure out which lessons the student already completed, to compute
  // completed / current / locked state for each node in the path.
  let completedLessonIds = new Set();

  if (currentUser) {
    try {
      const solutionsQuery = query(collection(db, 'solutions'), where('userId', '==', currentUser.uid));
      const solutionsSnap = await getDocs(solutionsQuery);
      // A solution document exists even for a 0-score (nonsense) answer, so
      // only solutions that actually earned points count toward marking a
      // lesson "completed" — matching the same score > 0 rule used for XP
      // and the profile's completed-challenges count.
      const challengeIds = [...new Set(
        solutionsSnap.docs
          .filter((docSnap) => {
            const score = docSnap.data().score;
            return typeof score === 'number' && score > 0;
          })
          .map((docSnap) => docSnap.data().challengeId)
          .filter(Boolean)
      )];

      const challengeSnaps = await Promise.all(
        challengeIds.map((challengeId) =>
          getDoc(doc(db, 'challenges', challengeId)).catch(() => null)
        )
      );

      challengeSnaps.forEach((snap) => {
        if (snap && snap.exists() && snap.data().lessonId) {
          completedLessonIds.add(snap.data().lessonId);
        }
      });
    } catch (error) {
      console.error('Failed to load completed lessons:', error);
    }
  }

// تقسيم الدروس لمستويات وعرض المستوى الحالي فقط
  const allLessons = lessons;
  const levels = splitIntoLevels(allLessons);
  const currentLevelIndex = findCurrentLevelIndex(levels, completedLessonIds);
  const currentLevelNumber = currentLevelIndex + 1;
  const totalLevels = levels.length;

  await syncProfileLevel(currentLevelNumber);

  lessons = levels[currentLevelIndex] || [];

  const everythingComplete = allLessons.every((l) => completedLessonIds.has(l.id));
  const completedInLevel = lessons.filter((l) => completedLessonIds.has(l.id)).length;

let pathIsOpen = true;

const states = lessons.map((lesson) => {
  // كل درس بعد أول درس غير مكتمل يبقى مقفلاً
  if (!pathIsOpen) {
    return 'locked';
  }

  // الدرس مكتمل، لذلك نسمح بفتح الدرس الذي بعده
  if (completedLessonIds.has(lesson.id)) {
    return 'completed';
  }

  // أول درس غير مكتمل هو الدرس الحالي
  pathIsOpen = false;
  return 'current';
});

  const points = lessons.map((lesson, i) => ({
    x: xForIndex(i),
    y: 60 + i * NODE_GAP_Y
  }));

  const svgHeight = 60 + (lessons.length - 1) * NODE_GAP_Y + 70;
  const currentIndex = states.indexOf('current');
  const mascotPoint = currentIndex >= 0 ? points[currentIndex] : points[points.length - 1];
  const currentLesson = currentIndex >= 0 ? lessons[currentIndex] : null;

  const nodesHtml = lessons.map((lesson, i) => nodeMarkup(lesson, i, states[i], points[i].x, points[i].y)).join('');

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  // Green part of the track: from the first lesson up to where Delta stands.
  const doneUntil = currentIndex >= 0 ? currentIndex : points.length - 1;
  const donePathD = buildPathD(points.slice(0, doneUntil + 1));

  // Delta stands on the empty side of the path, level with his lesson.
  const deltaX = 320 - mascotPoint.x;
  const deltaMood = everythingComplete ? { mood: 'happy', arms: 'cheer' } : { mood: 'happy', arms: 'wave' };
  const deltaSvg = window.DeltaChar
    ? window.DeltaChar.svg({ ...deltaMood, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })
    : '';
  const levelPercent = lessons.length ? Math.round((completedInLevel / lessons.length) * 100) : 0;

container.innerHTML = `
    <div class="level-banner">
      <div class="level-banner-badge" aria-hidden="true">${currentLevelNumber}</div>
      <div class="level-banner-info">
        <span class="level-banner-title">المستوى ${currentLevelNumber}${totalLevels > 1 ? ` <small>من ${totalLevels}</small>` : ''}</span>
        <span class="level-banner-meta">${
          everythingComplete
            ? 'أنهيت كل المستويات المتاحة، عاش!'
            : `أنجزت ${completedInLevel} من ${lessons.length} دروس`
        }</span>
        <div class="level-banner-track"><span style="width:${everythingComplete ? 100 : levelPercent}%"></span></div>
      </div>
    </div>
    <div class="lesson-path-wrap" id="lessonPathWrap">
      <svg viewBox="0 0 320 ${svgHeight}" class="lesson-path-svg" id="lessonPathSvg">
        <path d="${buildPathD(points)}" fill="none" stroke="${PATH_COLORS.track}" stroke-width="14" stroke-linecap="round"/>
        ${donePathD ? `<path d="${donePathD}" fill="none" stroke="${PATH_COLORS.done}" stroke-width="14" stroke-linecap="round" opacity=".55"/>` : ''}
        ${nodesHtml}
      </svg>
      ${deltaSvg ? `<div class="path-delta lq-mascot" aria-hidden="true" style="--x:${(deltaX / 320) * 100}%; --yf:${(mascotPoint.y / svgHeight).toFixed(4)};">${deltaSvg}</div>` : ''}
      ${currentLesson ? `
        <div class="lesson-popup hidden" id="lessonPopup">
          <p class="lesson-popup-kicker">الدرس التالي</p>
          <p class="lesson-popup-title" id="lessonPopupTitle">${escapeHtml(currentLesson.title || 'درس بدون عنوان')}</p>
          <button type="button" class="primary-btn full-width" id="lessonPopupStart">ابدأ التحدي</button>
        </div>
      ` : ''}
      <div class="lesson-popup hidden" id="completedLessonPopup">
        <p class="lesson-popup-kicker">أكملت هذا الدرس</p>
        <p class="lesson-popup-title" id="completedPopupTitle">—</p>
        <div class="lesson-popup-actions">
          <button type="button" class="primary-btn full-width" id="expertChallengeBtn">تحدي الخبير · XP بونص</button>
          <button type="button" class="secondary-btn full-width" id="redoOriginalBtn">أعد التحدي الأصلي</button>
        </div>
      </div>
    </div>
  `;

  // Places a popup under its lesson node, kept inside the path area, with
  // the little arrow still pointing at the node.
  const pathWrap = document.getElementById('lessonPathWrap');
  function placePopup(popupEl, index) {
    if (!popupEl || !pathWrap) return;
    const wrapWidth = pathWrap.clientWidth;
    const scale = wrapWidth / 320;
    const svgTop = document.getElementById('lessonPathSvg')?.offsetTop || 0;
    const nodeX = points[index].x * scale;
    const nodeY = svgTop + points[index].y * scale;
    const popupWidth = popupEl.offsetWidth || Math.min(260, wrapWidth - 8);
    const half = popupWidth / 2;
    const left = Math.min(Math.max(nodeX, half + 4), wrapWidth - half - 4);
    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${nodeY + 50 * scale + 8}px`;
    popupEl.style.setProperty('--arrow-x', `${nodeX - left + half}px`);
  }

  const popup = document.getElementById('lessonPopup');
  const popupStart = document.getElementById('lessonPopupStart');
  const completedPopup = document.getElementById('completedLessonPopup');
  const completedPopupTitle = document.getElementById('completedPopupTitle');
  const redoOriginalBtn = document.getElementById('redoOriginalBtn');
  const expertChallengeBtn = document.getElementById('expertChallengeBtn');
  let activeCompletedLesson = null;

  container.querySelectorAll('.lesson-node').forEach((node) => {
    const index = Number(node.dataset.lessonIndex);
    const state = states[index];
    const lesson = lessons[index];

    if (state === 'locked') {
      node.addEventListener('click', () => {
        node.classList.add('lesson-node-shake');
        setTimeout(() => node.classList.remove('lesson-node-shake'), 400);
      });
      return;
    }

    // Completed lessons show a small popup with two clear paths — redo the
    // exact same challenge, or take on a harder AI-generated one for a
    // bonus. Nothing here navigates on its own; the buttons inside the
    // popup are the only things that do.
    if (state === 'completed' && completedPopup) {
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        if (popup) popup.classList.add('hidden');

        activeCompletedLesson = lesson;
        completedPopupTitle.textContent = lesson.title || 'التحدي';
        completedPopup.classList.remove('hidden');
        placePopup(completedPopup, index);
      });
    }

    if (state === 'current' && popup) {
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        if (completedPopup) completedPopup.classList.add('hidden');
        popup.classList.toggle('hidden');
        placePopup(popup, index);
      });
    }
  });

  container.querySelectorAll('.lesson-node').forEach((node) => {
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
  });

  window.addEventListener('resize', () => {
    popup?.classList.add('hidden');
    completedPopup?.classList.add('hidden');
  });

  document.addEventListener('click', (event) => {
    if (popup && !popup.contains(event.target) && !event.target.closest('.lesson-node-current')) {
      popup.classList.add('hidden');
    }
    if (completedPopup && !completedPopup.contains(event.target) && !event.target.closest('.lesson-node-completed')) {
      completedPopup.classList.add('hidden');
    }
  });

  redoOriginalBtn?.addEventListener('click', () => {
    if (!activeCompletedLesson) return;
    sessionStorage.removeItem('challengeMode');
    goToLesson(activeCompletedLesson);
  });

  expertChallengeBtn?.addEventListener('click', () => {
    if (!activeCompletedLesson) return;
    sessionStorage.setItem('challengeMode', 'expert');
    goToLesson(activeCompletedLesson);
  });

  function goToLesson(lesson) {
    if (!currentUser) {
      sessionStorage.setItem('selectedLessonId', lesson.id);
      window.location.href = 'login.html';
      return;
    }

    sessionStorage.setItem('selectedLessonId', lesson.id);
    window.location.href = 'challenge.html';
  }

  if (popupStart && currentLesson) {
    popupStart.addEventListener('click', () => goToLesson(currentLesson));
  }

  hideLoadOverlay();
});