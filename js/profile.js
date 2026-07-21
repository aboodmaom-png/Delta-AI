import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const XP_PER_LEVEL = 1000;

const ARABIC_MONTHS_SHORT = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'
];

const SUBJECT_ICON = {
  math: 'calculator',
  science: 'flask-conical'
};

const SUBJECT_LABEL = {
  math: 'رياضيات',
  science: 'علوم'
};

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '—';
  const date = timestamp.toDate();
  return `${date.getFullYear()}/${ARABIC_MONTHS_SHORT[date.getMonth()]}/${String(date.getDate()).padStart(2, '0')}`;
}

function scoreBadgeClass(score) {
  if (score >= 70) return 'score-badge good';
  if (score >= 40) return 'score-badge mid';
  return 'score-badge low';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const loadOverlay = document.getElementById('profileLoadOverlay');
  function hideLoadOverlay() {
    loadOverlay?.classList.add('hidden');
  }

  const logoutBtn = document.getElementById('profileLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Failed to sign out:', error);
      }
    });
  }

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const gradeEl = document.getElementById('profileGrade');
  const avatarEl = document.getElementById('profileAvatar');
  const levelEl = document.getElementById('profileLevel');
  const xpPillEl = document.getElementById('profileXpPill');
  const progressFillEl = document.getElementById('profileProgressFill');
  const challengesEl = document.getElementById('profileChallenges');
  const avgScoreEl = document.getElementById('profileAvgScore');
  const recentChallengesList = document.getElementById('recentChallengesList');
  const totalXpEl = document.getElementById('profileTotalXp');

  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    const data = snapshot.exists() ? snapshot.data() : {};

    const name = data.name || user.displayName || 'طالب Delta AI';
    const email = data.email || user.email || '';
    const grade = data.grade || 'غير محدد';
    const xp = typeof data.xp === 'number' ? data.xp : 0;
    const level = typeof data.level === 'number' ? data.level : 1;
    const challengesCompleted = typeof data.challengesCompleted === 'number' ? data.challengesCompleted : 0;

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (gradeEl) gradeEl.textContent = `الصف: ${grade}`;
    if (avatarEl) avatarEl.textContent = name.trim().charAt(0) || 'ط';
    if (levelEl) levelEl.textContent = `المستوى ${level}`;
    if (challengesEl) challengesEl.textContent = challengesCompleted;
    if (totalXpEl) totalXpEl.textContent = `${xp.toLocaleString('en-US')} XP إجمالي`;

    const xpInLevel = xp % XP_PER_LEVEL;
    const percent = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100);

    if (xpPillEl) xpPillEl.textContent = `${xpInLevel} / ${XP_PER_LEVEL} نقطة`;
    if (progressFillEl) {
      progressFillEl.style.animation = 'none';
      void progressFillEl.offsetWidth;
      progressFillEl.style.transition = 'width 1s ease';
      progressFillEl.style.width = `${percent}%`;
    }
  } catch (error) {
    console.error('Failed to load profile data:', error);
  } finally {
    hideLoadOverlay();
  }

  // --- Real average AI score + recent challenges, from actual solutions ---
  try {
    const solutionsQuery = query(collection(db, 'solutions'), where('userId', '==', user.uid));
    const solutionsSnap = await getDocs(solutionsQuery);

    if (solutionsSnap.empty) {
      if (avgScoreEl) avgScoreEl.textContent = '—';
      if (recentChallengesList) {
        recentChallengesList.innerHTML = '<p style="color: var(--muted);">لا توجد تحديات مكتملة بعد.</p>';
      }
      return;
    }

    const solutions = solutionsSnap.docs.map((docSnap) => docSnap.data());

    const scoredSolutions = solutions.filter((s) => typeof s.score === 'number');
    if (avgScoreEl) {
      if (scoredSolutions.length) {
        const avg = Math.round(
          scoredSolutions.reduce((sum, s) => sum + s.score, 0) / scoredSolutions.length
        );
        avgScoreEl.textContent = `${avg}%`;
      } else {
        avgScoreEl.textContent = '—';
      }
    }

    solutions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const recent = solutions.slice(0, 10);

    if (recentChallengesList) {
      recentChallengesList.innerHTML = '';

      for (const solution of recent) {
        let title = 'تحدي';
        let subject = '';

        if (solution.challengeId) {
          try {
            const challengeSnap = await getDoc(doc(db, 'challenges', solution.challengeId));
            if (challengeSnap.exists()) {
              const challenge = challengeSnap.data();
              title = challenge.title || title;
              subject = challenge.subject || subject;
            }
          } catch (error) {
            console.error('Failed to load challenge for recent list:', error);
          }
        }

        const score = typeof solution.score === 'number' ? solution.score : 0;
        const icon = SUBJECT_ICON[subject] || 'sparkles';
        const subjectLabel = SUBJECT_LABEL[subject] || subject || '—';

        const item = document.createElement('article');
        item.className = 'challenge-item';
        item.innerHTML = `
          <div class="challenge-item-icon">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="challenge-item-info">
            <h4>${title}</h4>
            <p>${subjectLabel} • ${formatDate(solution.createdAt)}</p>
          </div>
          <span class="${scoreBadgeClass(score)}">${score}%</span>
        `;
        recentChallengesList.appendChild(item);
      }

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  } catch (error) {
    console.error('Failed to load solutions for profile:', error);
    if (avgScoreEl) avgScoreEl.textContent = '—';
    if (recentChallengesList) {
      recentChallengesList.innerHTML = '<p style="color: var(--muted);">تعذّر تحميل التحديات.</p>';
    }
  }
});