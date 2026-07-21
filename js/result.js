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

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

let lastSolutionContext = null;

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '—';
  const date = timestamp.toDate();
  return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getRating(score) {
  if (score >= 85) return 'ممتاز';
  if (score >= 70) return 'جيد جداً';
  if (score >= 50) return 'جيد';
  return 'يحتاج تحسين';
}

function updateMascot(score) {
  const mascotSvg = document.getElementById('mascotSvg');
  const mascotBubble = document.getElementById('mascotBubble');
  if (!mascotSvg) return;

  mascotSvg.classList.remove('celebrate', 'encourage');

  if (score >= 70) {
    mascotSvg.classList.add('celebrate');
  } else {
    mascotSvg.classList.add('encourage');
  }

  if (mascotBubble) {
    mascotBubble.style.display = 'none';
  }
}

// Scatters floating "+XP" fragments across the whole screen, split into a
// handful of pieces with randomized position/timing/rotation so it reads as
// a burst rather than one number moving.
function spawnXpParticles(totalXp) {
  const container = document.getElementById('xpParticlesContainer');
  if (!container || !totalXp || totalXp <= 0) return;

  const particleCount = 10;
  const chunk = Math.max(1, Math.round(totalXp / particleCount));

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('span');
    particle.className = 'xp-particle';
    particle.textContent = `+${chunk} XP`;

    const leftPos = 5 + Math.random() * 90;
    const delay = Math.random() * 0.9;
    const rotation = (Math.random() * 30 - 15).toFixed(1);
    const duration = 1.8 + Math.random() * 0.8;

    particle.style.left = `${leftPos}%`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.setProperty('--rot', `${rotation}deg`);

    container.appendChild(particle);

    setTimeout(() => particle.remove(), (delay + duration + 0.3) * 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const scoreValue = document.getElementById('scoreValue');
  const scoreCircle = document.getElementById('scoreCircle');
  const scorePercentHeading = document.getElementById('scorePercentHeading');
  const ratingText = document.getElementById('ratingText');
  const scoreMessage = document.getElementById('scoreMessage');
  const resultAnswerText = document.getElementById('resultAnswerText');
  const feedbackText = document.getElementById('feedbackText');
  const summarySubject = document.getElementById('summarySubject');
  const summaryChallenge = document.getElementById('summaryChallenge');
  const summaryDifficulty = document.getElementById('summaryDifficulty');
  const summaryDate = document.getElementById('summaryDate');
  const xpValue = document.getElementById('xpValue');
  const nextChallengeBtn = document.getElementById('nextChallengeBtn');
  const discussResultBtn = document.getElementById('discussResultBtn');

  const circumference = 2 * Math.PI * 52;

  if (scoreCircle) {
    scoreCircle.style.strokeDasharray = circumference;
    scoreCircle.style.strokeDashoffset = circumference;
  }

  if (nextChallengeBtn) {
    nextChallengeBtn.addEventListener('click', () => {
      if (lastSolutionContext && lastSolutionContext.subject) {
        sessionStorage.setItem('selectedSubjectId', lastSolutionContext.subject);
        window.location.href = 'lessons.html';
      } else {
        window.location.href = 'subjects.html';
      }
    });
  }

  if (discussResultBtn) {
    discussResultBtn.addEventListener('click', () => {
      if (lastSolutionContext) {
        sessionStorage.setItem('lastChallengeContext', JSON.stringify(lastSolutionContext));
      }
      window.location.href = 'learnquest-ai.html';
    });
  }

  function animateScore(targetScore) {
    let current = 0;
    const duration = 1200;
    const startTime = performance.now();

    function update(now) {
      const elapsed = Math.min((now - startTime) / duration, 1);
      current = Math.floor(elapsed * targetScore);
      if (scoreValue) scoreValue.textContent = `${current}`;
      if (scoreCircle) scoreCircle.style.strokeDashoffset = circumference * (1 - current / 100);

      if (elapsed < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function renderEmptyResult() {
    if (scorePercentHeading) scorePercentHeading.textContent = '0%';
    if (ratingText) ratingText.textContent = '—';
    if (scoreMessage) scoreMessage.textContent = 'لم يتم العثور على نتيجة بعد. أكمل تحدياً لعرض نتيجتك هنا.';
    if (resultAnswerText) resultAnswerText.textContent = '—';
    if (feedbackText) feedbackText.textContent = 'لا توجد بيانات بعد.';
    if (summarySubject) summarySubject.textContent = '—';
    if (summaryChallenge) summaryChallenge.textContent = '—';
    if (summaryDifficulty) summaryDifficulty.textContent = '—';
    if (summaryDate) summaryDate.textContent = '—';
    if (xpValue) xpValue.textContent = '—';
    animateScore(0);
  }

  async function renderSolution(solution) {
    const score = typeof solution.score === 'number' ? solution.score : 0;
    // The displayed XP is always kept consistent with the score. If the AI
    // (or an older saved solution, or a backend glitch) stored a positive xp
    // alongside a score of 0, we still show +0 XP here — a "nonsense" answer
    // scored at 0% must never appear to have earned a reward. challenge.js
    // already avoids crediting the profile in that case; this is the matching
    // guard on the display side so the result screen can't contradict itself.
    const rawXp = typeof solution.xp === 'number' ? solution.xp : 0;
    const xp = score > 0 ? rawXp : 0;

    if (scorePercentHeading) scorePercentHeading.textContent = `${score}%`;
    if (ratingText) ratingText.textContent = getRating(score);
    if (scoreMessage) scoreMessage.textContent = 'راجع ملاحظات المساعد الذكي بالأسفل لمزيد من التفاصيل.';
    updateMascot(score);
    if (resultAnswerText) resultAnswerText.textContent = solution.answer || '—';
    if (feedbackText) feedbackText.textContent = solution.feedback || 'بانتظار تقييم الذكاء الاصطناعي';
    if (summaryDate) summaryDate.textContent = formatDate(solution.createdAt);
    if (xpValue) {
      xpValue.textContent = `+${xp} XP`;
    }

    if (summarySubject) summarySubject.textContent = '—';
    if (summaryChallenge) summaryChallenge.textContent = '—';
    if (summaryDifficulty) summaryDifficulty.textContent = '—';

    let challengeQuestion = '';

    if (solution.challengeId) {
      try {
        const challengeSnap = await getDoc(doc(db, 'challenges', solution.challengeId));
        if (challengeSnap.exists()) {
          const challenge = challengeSnap.data();
          if (summarySubject) summarySubject.textContent = challenge.subject || '—';
          if (summaryChallenge) summaryChallenge.textContent = challenge.title || '—';
          if (summaryDifficulty) summaryDifficulty.textContent = challenge.difficulty || '—';
          challengeQuestion = challenge.question || '';
        }
      } catch (error) {
        console.error('Failed to load challenge info for result:', error);
      }
    }

    lastSolutionContext = {
      question: challengeQuestion,
      answer: solution.answer || '',
      score,
      feedback: solution.feedback || '',
      subject: summarySubject?.textContent || '',
      title: summaryChallenge?.textContent || '',
      challengeId: solution.challengeId || null
    };

    animateScore(score);
    if (score > 60) {
      spawnXpParticles(xp);
    }
  }

  function setupRevisitNudge() {
    const nudge = document.getElementById('revisitNudge');
    const closeBtn = document.getElementById('revisitClose');
    const nextBtn = document.getElementById('revisitNextBtn');
    const discussBtn = document.getElementById('revisitDiscussBtn');
    if (!nudge) return;

    const timer = setTimeout(() => {
      nudge.classList.remove('hidden');
      requestAnimationFrame(() => nudge.classList.add('show'));
    }, 5000);

    function dismiss() {
      nudge.classList.remove('show');
      setTimeout(() => nudge.classList.add('hidden'), 600);
    }

    closeBtn?.addEventListener('click', dismiss);

    nextBtn?.addEventListener('click', () => {
      if (lastSolutionContext && lastSolutionContext.subject) {
        sessionStorage.setItem('selectedSubjectId', lastSolutionContext.subject);
        window.location.href = 'lessons.html';
      } else {
        window.location.href = 'subjects.html';
      }
    });

    discussBtn?.addEventListener('click', () => {
      if (lastSolutionContext) {
        sessionStorage.setItem('lastChallengeContext', JSON.stringify(lastSolutionContext));
      }
      window.location.href = 'learnquest-ai.html';
    });

    window.addEventListener('beforeunload', () => clearTimeout(timer));
  }

  setupRevisitNudge();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const viewSolutionId = sessionStorage.getItem('viewSolutionId');

    if (viewSolutionId) {
      sessionStorage.removeItem('viewSolutionId');
      try {
        const specificSnap = await getDoc(doc(db, 'solutions', viewSolutionId));
        if (specificSnap.exists()) {
          await renderSolution(specificSnap.data());
          return;
        }
      } catch (error) {
        console.error('Failed to load the requested solution, falling back to latest:', error);
      }
    }

    try {
      const solutionsQuery = query(collection(db, 'solutions'), where('userId', '==', user.uid));
      const snapshot = await getDocs(solutionsQuery);

      if (snapshot.empty) {
        renderEmptyResult();
        return;
      }

      const solutions = snapshot.docs.map((docSnap) => docSnap.data());
      solutions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      await renderSolution(solutions[0]);
    } catch (error) {
      console.error('Failed to load latest solution:', error);
      renderEmptyResult();
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
});