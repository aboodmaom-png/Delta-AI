import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Backend endpoints (backend/server.js). Adjust if deployed elsewhere.
const EVALUATE_ENDPOINT = 'https://delta-ai-backend-aq3d.onrender.com';
const GENERATE_ENDPOINT = 'https://delta-ai-backend-aq3d.onrender.com';

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

// Pilot phase: content only exists for these grades. Students in any
// other grade see a friendly message instead of a broken/empty challenge.
const ALLOWED_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Must match the value used in profile.js so the level math agrees
// everywhere in the app.
const XP_PER_LEVEL = 1000;

document.addEventListener('DOMContentLoaded', () => {
  // --- Section: Answer form interactions ---
  const textarea = document.getElementById('studentAnswer');
  const charCounter = document.getElementById('charCounter');
  const submitButton = document.getElementById('submitAnswer');
  const hintButton = document.getElementById('requestHint');
  const coachHintButton = document.getElementById('coachHint');
  const loadingCard = document.getElementById('loadingCard');

  // --- Section: Challenge data elements ---
  const challengeLoadingCard = document.getElementById('challengeLoadingCard');
  const challengeErrorCard = document.getElementById('challengeErrorCard');
  const challengeHeaderCard = document.getElementById('challengeHeaderCard');
  const chatLayout = document.getElementById('chatLayout');
  const problemCard = document.getElementById('problemCard');
  const answerCard = document.getElementById('answerCard');
  const contentCards = [challengeHeaderCard, chatLayout];
  const challengeTitle = document.getElementById('challengeTitle');
  const metaSubject = document.getElementById('metaSubject');
  const metaDifficulty = document.getElementById('metaDifficulty');
  const problemText = document.getElementById('problemText');

  let currentUser = null;
  let currentChallengeId = null;
  let currentChallengeQuestion = '';
  let isExpertMode = false;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    loadChallenge();
  });

  function updateCounter() {
    if (!textarea || !charCounter) return;
    const count = textarea.value.length;
    charCounter.textContent = `${count} / 500`;
  }

  function showSubmitLoadingState() {
    if (loadingCard) {
      loadingCard.classList.remove('hidden');
    }
  }

  function hideSubmitLoadingState() {
    if (loadingCard) {
      loadingCard.classList.add('hidden');
    }
  }

  function showSubmitError(message) {
    if (!answerCard) return;
    let errorEl = answerCard.querySelector('.answer-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'answer-error';
      answerCard.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function clearSubmitError() {
    answerCard?.querySelector('.answer-error')?.remove();
  }

  if (textarea) {
    textarea.addEventListener('input', updateCounter);
    updateCounter();
  }

  // --- Section: Auto-resizing answer textarea ---
  function autoResizeTextarea() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  if (textarea) {
    textarea.addEventListener('input', autoResizeTextarea);
  }

  // Adds this challenge's earned XP onto the student's running total,
  // recomputes their level from the new total, and bumps their completed
  // count. Uses setDoc with merge so it can't fail even if some fields
  // are missing on the user document.
  async function applyXpToUser(earnedXp) {
    if (!currentUser || typeof earnedXp !== 'number') return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const existing = userSnap.exists() ? userSnap.data() : {};

      const currentXp = typeof existing.xp === 'number' ? existing.xp : 0;
      const currentChallengesCompleted =
        typeof existing.challengesCompleted === 'number' ? existing.challengesCompleted : 0;

      const newXp = currentXp + earnedXp;
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;

      await setDoc(
        userRef,
        {
          xp: newXp,
          level: newLevel,
          challengesCompleted: currentChallengesCompleted + 1
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Failed to update user xp/level after challenge:', error);
    }
  }

  if (submitButton) {
    submitButton.addEventListener('click', async () => {
      if (!textarea || !textarea.value.trim()) {
        textarea?.focus();
        return;
      }

      clearSubmitError();

      if (!currentChallengeId) {
        showSubmitError('تعذّر تحديد التحدي الحالي، حاول إعادة تحميل الصفحة.');
        return;
      }

      if (!currentUser) {
        showSubmitError('يجب تسجيل الدخول لإرسال الحل.');
        return;
      }

      const answerText = textarea.value.trim();

      submitButton.disabled = true;
      showSubmitLoadingState();
      showBlurOverlay('جاري تحليل حلّك...');

      let solutionRef;
      try {
        solutionRef = await addDoc(collection(db, 'solutions'), {
          userId: currentUser.uid,
          challengeId: currentChallengeId,
          answer: answerText,
          createdAt: serverTimestamp(),
          feedback: 'بانتظار تقييم الذكاء الاصطناعي',
          score: 0,
          strengths: [],
          improvements: [],
          xp: 0
        });
      } catch (error) {
        console.error('Failed to save solution:', error);
        hideSubmitLoadingState();
        submitButton.disabled = false;
        hideBlurOverlay();
        showSubmitError('تعذّر إرسال الحل، حاول مرة أخرى.');
        return;
      }

      try {
        const response = await fetch(EVALUATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: currentChallengeQuestion, answer: answerText })
        });

        if (!response.ok) throw new Error(`Evaluation request failed with status ${response.status}`);

        const aiResult = await response.json();
        if (typeof aiResult.score === 'number' && typeof aiResult.feedback === 'string') {
          // XP is derived directly from the AI score rather than a separate
          // field, so the two can never disagree: a score of 0 (nonsense or
          // empty reasoning, as judged by the AI) always means 0 XP, and a
          // strong answer is worth proportionally more — up to 100 XP, which
          // matches the "حتى 100 XP" label shown on the challenge card.
          const score = Math.max(0, Math.min(100, aiResult.score));
          const baseXp = Math.round(score);
          // Expert-mode challenges are harder on purpose, so they're worth
          // 1.5x the normal XP as the promised bonus.
          const finalXp = isExpertMode ? Math.round(baseXp * 1.5) : baseXp;

          await updateDoc(solutionRef, {
            score: aiResult.score,
            feedback: aiResult.feedback,
            strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths : [],
            improvements: Array.isArray(aiResult.improvements) ? aiResult.improvements : [],
            xp: finalXp,
            isExpert: isExpertMode
          });

          // Only a real attempt (score > 0) earns XP and counts as a
          // completed challenge. A zero score means the AI judged the answer
          // as nonsense/irrelevant, so we leave the student's running total
          // and completed-count untouched — the solution is still saved with
          // its 0% and feedback, so result.html shows the score and the AI's
          // encouragement to try again, but the profile isn't credited.
          if (finalXp > 0) {
            await applyXpToUser(finalXp);
          }
        }
      } catch (error) {
        console.error('AI evaluation failed, keeping default feedback:', error);
      }

      window.location.href = 'result.html';
    });
  }

  const HINT_ENDPOINT = 'https://delta-ai-backend-aq3d.onrender.com';

  async function requestHint(button) {
    if (!currentChallengeQuestion) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'جاري التفكير...';

    try {
      const response = await fetch(HINT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentChallengeQuestion,
          currentAnswer: textarea ? textarea.value.trim() : ''
        })
      });

      if (!response.ok) throw new Error(`Hint request failed with status ${response.status}`);

      const data = await response.json();
      const hint = data.hint || 'حاول التفكير بالمعطيات خطوة بخطوة.';

      if (textarea) {
        textarea.placeholder = `💡 ${hint}`;
        textarea.focus();
      }
    } catch (error) {
      console.error('Hint request failed:', error);
      if (textarea) {
        textarea.placeholder = 'تعذّر جلب تلميح الآن، حاول مرة أخرى.';
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  [hintButton, coachHintButton].forEach((button) => {
    if (button) {
      button.addEventListener('click', () => requestHint(button));
    }
  });

  // --- Section: Challenge generation and loading ---
  function showContentState() {
    challengeLoadingCard?.classList.add('hidden');
    challengeErrorCard?.classList.add('hidden');
    contentCards.forEach((card) => card?.classList.remove('hidden'));
  }

  function showErrorState() {
    challengeLoadingCard?.classList.add('hidden');
    contentCards.forEach((card) => card?.classList.add('hidden'));
    challengeErrorCard?.classList.remove('hidden');
  }

  const SUBJECT_LABELS = {
    math: 'رياضيات',
    science: 'علوم'
  };

  const DIFFICULTY_LABELS = {
    easy: 'سهل',
    medium: 'متوسط',
    hard: 'صعب'
  };

  function renderChallenge(challenge) {
    if (challengeTitle) challengeTitle.textContent = challenge.title || 'تحدي اليوم';
    if (metaSubject) metaSubject.textContent = SUBJECT_LABELS[challenge.subject] || challenge.subject || '—';
    if (metaDifficulty) {
      const difficultyLabel = DIFFICULTY_LABELS[challenge.difficulty] || challenge.difficulty || '—';
      metaDifficulty.textContent = `المستوى: ${difficultyLabel}`;
    }
    if (problemText) problemText.textContent = challenge.question || '';
  }

  // Picks a lesson: prefers lessons matching the student's grade and not
  // yet completed; falls back to any lesson if no ideal match exists.
  async function pickLessonForStudent() {
    const lessonsSnap = await getDocs(collection(db, 'lessons'));
    if (lessonsSnap.empty) return null;

    const allLessons = lessonsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    let studentGradeNumber = null;
    if (currentUser) {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const gradeText = userSnap.data().grade;
          studentGradeNumber = GRADE_MAP[gradeText] || null;
        }
      } catch (error) {
        console.error('Failed to load student grade:', error);
      }
    }

    // Find lessons the student already has a solution for (via challenges).
    let completedLessonIds = new Set();
    if (currentUser) {
      try {
        const solutionsQuery = query(collection(db, 'solutions'), where('userId', '==', currentUser.uid));
        const solutionsSnap = await getDocs(solutionsQuery);
        const challengeIds = [...new Set(solutionsSnap.docs.map((d) => d.data().challengeId).filter(Boolean))];

        // Fetch all challenge docs in parallel instead of one-by-one —
        // sequential awaits here meant load time grew with every challenge
        // the student had ever completed.
        const challengeSnaps = await Promise.all(
          challengeIds.map((challengeId) =>
            getDoc(doc(db, 'challenges', challengeId)).catch((error) => {
              console.error('Failed to check completed lesson:', error);
              return null;
            })
          )
        );

        challengeSnaps.forEach((challengeSnap) => {
          if (challengeSnap && challengeSnap.exists() && challengeSnap.data().lessonId) {
            completedLessonIds.add(challengeSnap.data().lessonId);
          }
        });
      } catch (error) {
        console.error('Failed to load student solutions:', error);
      }
    }

    // Priority 1: matches grade AND not completed
    let candidates = allLessons.filter(
      (l) => (studentGradeNumber ? l.grade === studentGradeNumber : true) && !completedLessonIds.has(l.id)
    );

    // Priority 2: matches grade (even if completed)
    if (!candidates.length && studentGradeNumber) {
      candidates = allLessons.filter((l) => l.grade === studentGradeNumber);
    }

    // Priority 3: anything at all — only if we genuinely don't know the
    // student's grade (e.g. incomplete profile). If we DO know their grade
    // and there just aren't lessons for it yet, we deliberately do NOT
    // fall back to a different grade's lesson — that would show a 4th
    // grader a 9th grade challenge, which is worse than showing nothing.
    if (!candidates.length && !studentGradeNumber) {
      candidates = allLessons;
    }

    if (!candidates.length) return null;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async function generateChallengeForLesson(lesson, isExpert) {
    // Each lesson node in the path is meant to be a fixed level, not a
    // freshly-randomized question every time it's opened. If this lesson
    // already has a challenge linked to it, reuse that exact challenge
    // instead of generating (and paying for) a new one — UNLESS the
    // student explicitly asked for the harder "AI Expert" version, which
    // is always freshly generated and never overwrites the original.
    if (lesson.challengeId && !isExpert) {
      try {
        const existingSnap = await getDoc(doc(db, 'challenges', lesson.challengeId));
        if (existingSnap.exists()) {
          const existing = existingSnap.data();
          return {
            id: existingSnap.id,
            subject: existing.subject,
            title: existing.title,
            question: existing.question,
            difficulty: existing.difficulty || lesson.difficulty || 'medium'
          };
        }
      } catch (error) {
        console.error('Failed to load existing lesson challenge, generating a new one:', error);
      }
    }

    const response = await fetch(GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: lesson.subject,
        lessonTitle: lesson.title,
        lessonSummary: lesson.summary,
        difficulty: isExpert ? 'hard' : lesson.difficulty,
        grade: lesson.grade
      })
    });

    if (!response.ok) throw new Error(`Challenge generation failed with status ${response.status}`);

    const generated = await response.json();

    const challengeRef = await addDoc(collection(db, 'challenges'), {
      lessonId: lesson.id,
      subject: lesson.subject,
      title: generated.title,
      question: generated.question,
      difficulty: isExpert ? 'hard' : (lesson.difficulty || 'medium'),
      isExpert: !!isExpert,
      createdAt: serverTimestamp()
    });

    // Only link (and lock in) the challenge for future reuse when this is
    // the normal, non-expert version — the expert version is meant to be a
    // one-off bonus round, not the lesson's permanent question.
    if (!isExpert) {
      try {
        await updateDoc(doc(db, 'lessons', lesson.id), { challengeId: challengeRef.id });
      } catch (error) {
        console.error('Failed to link challenge to lesson:', error);
      }
    }

    return {
      id: challengeRef.id,
      subject: lesson.subject,
      title: generated.title,
      question: generated.question,
      difficulty: lesson.difficulty || 'medium'
    };
  }

  function showBlurOverlay(message) {
    const blurOverlay = document.getElementById('submitBlurOverlay');
    const blurText = document.getElementById('submitBlurText');
    if (blurText) blurText.textContent = message;
    if (blurOverlay) blurOverlay.classList.remove('hidden');
  }

  function hideBlurOverlay() {
    const blurOverlay = document.getElementById('submitBlurOverlay');
    if (blurOverlay) blurOverlay.classList.add('hidden');
  }

  async function checkForPreviousSolution(challengeId) {
    const banner = document.getElementById('previousAttemptBanner');
    const bannerText = document.getElementById('previousAttemptText');
    const viewBtn = document.getElementById('viewPreviousResultBtn');
    if (!banner || !currentUser) return;

    try {
      const solQuery = query(
        collection(db, 'solutions'),
        where('userId', '==', currentUser.uid),
        where('challengeId', '==', challengeId)
      );
      const solSnap = await getDocs(solQuery);
      if (solSnap.empty) return;

      // A 0-score (nonsense) attempt still saves a solution document, but
      // shouldn't make the page claim the student already solved this —
      // same rule as the XP/completion logic elsewhere. If every past
      // attempt was nonsense, treat it as not yet solved (no banner).
      const realAttempts = solSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => typeof s.score === 'number' && s.score > 0);

      if (!realAttempts.length) return;

      const previous = realAttempts.sort(
        (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
      )[0];

      const score = previous.score;
      bannerText.textContent = `✅ حليت هذا التحدي من قبل — الدرجة: ${score}%`;
      banner.classList.remove('hidden');

      viewBtn.addEventListener('click', () => {
        sessionStorage.setItem('viewSolutionId', previous.id);
        window.location.href = 'result.html';
      });
    } catch (error) {
      console.error('Failed to check for previous solution:', error);
    }
  }

  async function loadChallenge() {
    if (currentUser) {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const gradeNumber = GRADE_MAP[userSnap.data().grade] || null;
          if (gradeNumber && !ALLOWED_GRADES.includes(gradeNumber)) {
            const errorText = document.getElementById('challengeErrorText');
            if (errorText) {
              errorText.textContent = 'التحديات متاحة حاليًا فقط لطلاب الصف الأول حتى الصف التاسع. سيتم إضافة صفوف أخرى قريبًا.';
            }
            showErrorState();
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check student grade:', error);
      }
    }

    showBlurOverlay('🤖 جاري تحضير التحدي...');

    const slowLoadTimeout = setTimeout(() => {
      showBlurOverlay('🤖 لسا شوي وبيجهز تحديك...');
    }, 5000);

    try {
      const selectedLessonId = sessionStorage.getItem('selectedLessonId');
      let lesson;

      if (selectedLessonId) {
        const lessonSnap = await getDoc(doc(db, 'lessons', selectedLessonId));
        if (lessonSnap.exists()) {
          lesson = { id: lessonSnap.id, ...lessonSnap.data() };
        }
      }

      if (!lesson) {
        lesson = await pickLessonForStudent();
      }

      if (!lesson) {
        const errorText = document.getElementById('challengeErrorText');
        if (errorText) {
          errorText.textContent = 'لا توجد دروس متاحة لصفك الدراسي بهذه المادة حاليًا. راجعي/راجع لوحة الدروس أو حاول لاحقًا.';
        }
        showErrorState();
        return;
      }

      isExpertMode = sessionStorage.getItem('challengeMode') === 'expert';
      sessionStorage.removeItem('challengeMode');

      const challenge = await generateChallengeForLesson(lesson, isExpertMode);

      currentChallengeId = challenge.id;
      currentChallengeQuestion = challenge.question;
      renderChallenge(challenge);

      const expertBadge = document.querySelector('.meta-pill.accent');
      if (expertBadge) {
        expertBadge.textContent = isExpertMode ? '🎯 تحدي الخبير — XP بونص' : 'حتى 100 XP';
      }

      showContentState();

      // The "already solved" banner only makes sense for the normal fixed
      // challenge — the expert version is a fresh one-off round, so there's
      // nothing to compare it against yet.
      if (!isExpertMode) {
        await checkForPreviousSolution(challenge.id);
      }
    } catch (error) {
      console.error('Failed to load/generate challenge:', error);
      showErrorState();
    } finally {
      clearTimeout(slowLoadTimeout);
      hideBlurOverlay();
    }
  }

  // --- Section: Icons initialization ---
  if (window.lucide) {
    window.lucide.createIcons();
  }
});