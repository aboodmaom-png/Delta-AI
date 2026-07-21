import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Platform is scoped to Mathematics and Science only. Arabic/English subject
// documents may still exist in Firestore, but they are filtered out here
// rather than deleted from the database.
const ALLOWED_SUBJECT_KEYWORDS = ['رياضي', 'math', 'علوم', 'science'];

function isAllowedSubject(name) {
  if (!name) return false;
  const normalized = String(name).toLowerCase();
  return ALLOWED_SUBJECT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('subjectsGrid');
  if (!grid) return;

  let renderedSubjects = [];

  function renderSubjects(subjects) {
    renderedSubjects = subjects;
    grid.innerHTML = subjects
      .map(
        (subject) => `
          <article class="subject-card">
            <div class="subject-icon">${subject.icon || '📘'}</div>
            <h3>${subject.name}</h3>
            <p>${subject.description || 'تمارين وتحديات متنوعة'}</p>
            <div class="subject-progress">
              <div class="subject-progress-track">
                <div class="subject-progress-fill" id="progressFill-${subject.id}"></div>
              </div>
              <span class="subject-progress-text" id="progressText-${subject.id}">— % من دروس المستوى الأول</span>
            </div>
            <div class="subject-actions">
              <button type="button" class="primary-btn full-width" data-subject-id="${subject.id}">ابدأ</button>
              <button type="button" class="secondary-btn full-width subject-ai-btn" data-subject-id="${subject.id}" data-subject-name="${subject.name}">
                تابع مع المساعد 🤖
              </button>
            </div>
          </article>
        `
      )
      .join('');

    loadSubjectProgress(subjects);
  }

  function renderLoadingState() {
    grid.innerHTML = '<p class="empty-message">جاري تحميل المواد...</p>';
  }

  function renderEmptyState() {
    grid.innerHTML = '<p class="empty-message">لا توجد مواد متاحة حاليًا.</p>';
  }

  function renderErrorState() {
    grid.innerHTML = '<p class="empty-message">تعذّر تحميل المواد، حاول تحديث الصفحة.</p>';
  }

  grid.addEventListener('click', (event) => {
    const startButton = event.target.closest('[data-subject-id]:not(.subject-ai-btn)');
    if (startButton) {
      sessionStorage.setItem('selectedSubjectId', startButton.dataset.subjectId);
      window.location.href = 'lessons.html';
      return;
    }

    const aiButton = event.target.closest('.subject-ai-btn');
    if (aiButton) {
      sessionStorage.setItem('aiCoachSubjectId', aiButton.dataset.subjectId);
      sessionStorage.setItem('aiCoachSubjectName', aiButton.dataset.subjectName);
      window.location.href = 'learnquest-ai.html';
    }
  });

  // Real per-subject progress: total lessons for the subject vs. how many
  // distinct lessons the student has already completed a challenge for.
  async function loadSubjectProgress(subjects) {
    const totalsBySubject = {};
    try {
      const lessonsSnap = await getDocs(collection(db, 'lessons'));
      lessonsSnap.docs.forEach((docSnap) => {
        const subj = docSnap.data().subject;
        if (!subj) return;
        totalsBySubject[subj] = (totalsBySubject[subj] || 0) + 1;
      });
    } catch (error) {
      console.error('Failed to load lessons for progress calculation:', error);
    }

    onAuthStateChanged(auth, async (user) => {
      const completedBySubject = {};

      if (user) {
        try {
          const solutionsQuery = query(collection(db, 'solutions'), where('userId', '==', user.uid));
          const solutionsSnap = await getDocs(solutionsQuery);
          // Same rule as lessons.js: a 0-score (nonsense) solution still
          // exists as a document, but shouldn't count toward progress.
          const challengeIds = [
            ...new Set(
              solutionsSnap.docs
                .filter((docSnap) => {
                  const score = docSnap.data().score;
                  return typeof score === 'number' && score > 0;
                })
                .map((docSnap) => docSnap.data().challengeId)
                .filter(Boolean)
            )
          ];

          const challengeSnaps = await Promise.all(
            challengeIds.map((challengeId) =>
              getDoc(doc(db, 'challenges', challengeId)).catch((error) => {
                console.error('Failed to load challenge for progress calculation:', error);
                return null;
              })
            )
          );

          const completedLessonsBySubject = {};
          challengeSnaps.forEach((challengeSnap) => {
            if (!challengeSnap || !challengeSnap.exists()) return;
            const data = challengeSnap.data();
            if (!data.subject || !data.lessonId) return;
            if (!completedLessonsBySubject[data.subject]) {
              completedLessonsBySubject[data.subject] = new Set();
            }
            completedLessonsBySubject[data.subject].add(data.lessonId);
          });

          Object.keys(completedLessonsBySubject).forEach((subj) => {
            completedBySubject[subj] = completedLessonsBySubject[subj].size;
          });
        } catch (error) {
          console.error('Failed to load solutions for progress calculation:', error);
        }
      }

      subjects.forEach((subject) => {
        const fillEl = document.getElementById(`progressFill-${subject.id}`);
        const textEl = document.getElementById(`progressText-${subject.id}`);
        if (!fillEl || !textEl) return;

        const total = totalsBySubject[subject.id] || 0;
        const completed = Math.min(completedBySubject[subject.id] || 0, total);
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        fillEl.style.width = `${percent}%`;
        textEl.textContent = total > 0
          ? `${percent}% من دروس المستوى الأول (${completed}/${total})`
          : 'لا توجد دروس بعد';
      });
    });
  }

  renderLoadingState();

  const loadOverlay = document.getElementById('subjectsLoadOverlay');

  try {
    const snapshot = await getDocs(collection(db, 'subjects'));
    if (snapshot.empty) {
      renderEmptyState();
      return;
    }

    const subjects = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((subject) => isAllowedSubject(subject.name));

    if (subjects.length === 0) {
      renderEmptyState();
      return;
    }

    renderSubjects(subjects);
  } catch (error) {
    console.error('Failed to load subjects:', error);
    renderErrorState();
  } finally {
    loadOverlay?.classList.add('hidden');
  }
});