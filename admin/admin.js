import { db, auth } from "../js/firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Platform is scoped to Mathematics and Science only — same filter used on
// subjects.html / lessons.html so the admin only manages real subjects.
const ALLOWED_SUBJECT_KEYWORDS = ['رياضي', 'math', 'علوم', 'science'];
function isAllowedSubject(name) {
  if (!name) return false;
  const normalized = String(name).toLowerCase();
  return ALLOWED_SUBJECT_KEYWORDS.some((k) => normalized.includes(k));
}

const GRADE_OPTIONS = [
  { value: 1, label: 'الأول' },
  { value: 2, label: 'الثاني' },
  { value: 3, label: 'الثالث' },
  { value: 4, label: 'الرابع' },
  { value: 5, label: 'الخامس' },
  { value: 6, label: 'السادس' },
  { value: 7, label: 'السابع' },
  { value: 8, label: 'الثامن' },
  { value: 9, label: 'التاسع' },
  { value: 10, label: 'العاشر' },
  { value: 11, label: 'الحادي عشر' },
  { value: 12, label: 'الثاني عشر' }
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'سهل' },
  { value: 'medium', label: 'متوسط' },
  { value: 'hard', label: 'صعب' }
];

let cachedSubjects = [];
let currentLessons = [];
let currentSubjectId = null;
let currentGradeFilter = 1;
let editingLessonId = null;
let dragSrcIndex = null;

// ============================
// Check Admin Login
// ============================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../login.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("بيانات المستخدم غير موجودة.");
      window.location.href = "../dashboard.html";
      return;
    }

    const userData = userSnap.data();

    if (userData.role !== "admin") {
      alert("ليس لديك صلاحية دخول لوحة الإدارة.");
      window.location.href = "../dashboard.html";
      return;
    }

    await loadDashboard();
    initNav();
    await initLessonsSection();
  } catch (error) {
    console.error("Admin Auth Error:", error);
    alert("حدث خطأ أثناء التحقق من الصلاحيات.");
    window.location.href = "../dashboard.html";
  }
});

// ============================
// Load Dashboard Data
// ============================

async function loadDashboard() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    document.querySelector(".card:nth-child(1) strong").textContent = usersSnap.size;

    const challengesSnap = await getDocs(collection(db, "challenges"));
    document.querySelector(".card:nth-child(2) strong").textContent = challengesSnap.size;

    const solutionsSnap = await getDocs(collection(db, "solutions"));
    document.querySelector(".card:nth-child(3) strong").textContent = solutionsSnap.size;

    let total = 0;
    let count = 0;

    solutionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.score === "number") {
        total += data.score;
        count++;
      }
    });

    const avg = count ? Math.round(total / count) : 0;
    document.querySelector(".card:nth-child(4) strong").textContent = avg + "%";

    loadRecentStudents(usersSnap);
  } catch (error) {
    console.error("Admin dashboard error:", error);
  }
}

function loadRecentStudents(snapshot) {
  const table = document.getElementById("studentsTable");
  if (!table) return;

  let html = `
    <tr>
      <th>الاسم</th>
      <th>المستوى</th>
      <th>XP</th>
      <th>الدرجة</th>
    </tr>
  `;

  snapshot.forEach((docSnap) => {
    const user = docSnap.data();
    html += `
      <tr>
        <td>${user.name || user.displayName || "Student"}</td>
        <td>${user.level || 1}</td>
        <td>${user.xp || 0}</td>
        <td>${user.averageScore || "-"}</td>
      </tr>
    `;
  });

  table.innerHTML = html;
}

// ============================
// Sidebar navigation
// ============================

function initNav() {
  document.querySelectorAll('.sidebar nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.sidebar nav a').forEach((a) => a.classList.remove('active'));
      link.classList.add('active');

      const target = link.dataset.section;
      document.querySelectorAll('.admin-section').forEach((sec) => sec.classList.add('hidden'));

      const section = document.getElementById(`section-${target}`);
      if (section) section.classList.remove('hidden');
    });
  });
}

// ============================
// Lessons management (add / edit / delete / drag-reorder)
// ============================

const GENERATE_LESSONS_ENDPOINT = 'https://delta-ai-backend-aq3d.onrender.com';
let generatedLessonsPreview = [];

async function initLessonsSection() {
  const subjectTabs = document.getElementById('subjectTabs');
  if (!subjectTabs) return;

  const addBtn = document.getElementById('addLessonBtn');
  const form = document.getElementById('lessonForm');
  const cancelBtn = document.getElementById('lessonCancelBtn');

  const gradeSelect = document.getElementById('lessonGrade');
  gradeSelect.innerHTML = GRADE_OPTIONS.map((g) => `<option value="${g.value}">${g.label}</option>`).join('');

  const difficultySelect = document.getElementById('lessonDifficulty');
  difficultySelect.innerHTML = DIFFICULTY_OPTIONS.map((d) => `<option value="${d.value}">${d.label}</option>`).join('');

  const aiGradeSelect = document.getElementById('aiLessonGrade');
  if (aiGradeSelect) {
    aiGradeSelect.innerHTML = GRADE_OPTIONS.map((g) => `<option value="${g.value}">${g.label}</option>`).join('');
  }

  try {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    cachedSubjects = subjectsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => isAllowedSubject(s.name));
  } catch (error) {
    console.error('Failed to load subjects:', error);
  }

  if (!cachedSubjects.length) {
    subjectTabs.innerHTML = '<p style="color:#94a3b8;">لا توجد مواد بعد بمجموعة subjects.</p>';
    return;
  }

  subjectTabs.innerHTML = cachedSubjects
    .map((s, i) => `<button type="button" class="subject-tab${i === 0 ? ' active' : ''}" data-subject-id="${s.id}">${s.icon || '📘'} ${s.name}</button>`)
    .join('');

  const gradeTabs = document.getElementById('gradeTabs');
  const lessonGradeTabsRange = GRADE_OPTIONS.filter((g) => g.value >= 1 && g.value <= 9);
  gradeTabs.innerHTML = lessonGradeTabsRange
    .map((g) => `<button type="button" class="grade-tab${g.value === currentGradeFilter ? ' active' : ''}" data-grade="${g.value}">${g.label}</button>`)
    .join('');

  gradeTabs.querySelectorAll('.grade-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      gradeTabs.querySelectorAll('.grade-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentGradeFilter = Number(tab.dataset.grade);
      await loadLessonsForSubject(currentSubjectId);
    });
  });

  currentSubjectId = cachedSubjects[0].id;
  await loadLessonsForSubject(currentSubjectId);

  subjectTabs.querySelectorAll('.subject-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      subjectTabs.querySelectorAll('.subject-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentSubjectId = tab.dataset.subjectId;
      await loadLessonsForSubject(currentSubjectId);
    });
  });

  addBtn.addEventListener('click', () => openLessonModal());
  cancelBtn.addEventListener('click', () => closeLessonModal());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveLesson();
  });

  initAiLessonModal();
}

function initAiLessonModal() {
  const openBtn = document.getElementById('aiGenerateBtn');
  const modal = document.getElementById('aiLessonModal');
  const requestForm = document.getElementById('aiLessonForm');
  const cancelBtn = document.getElementById('aiLessonCancelBtn');
  const preview = document.getElementById('aiLessonPreview');
  const backBtn = document.getElementById('aiPreviewBackBtn');
  const confirmBtn = document.getElementById('aiConfirmAddBtn');
  const submitBtn = document.getElementById('aiGenerateSubmitBtn');

  function resetAiModal() {
    requestForm.classList.remove('hidden');
    preview.classList.add('hidden');
    generatedLessonsPreview = [];
  }

  openBtn.addEventListener('click', () => {
    resetAiModal();
    const aiGradeSelectEl = document.getElementById('aiLessonGrade');
    if (aiGradeSelectEl) aiGradeSelectEl.value = currentGradeFilter;
    modal.classList.remove('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  backBtn.addEventListener('click', () => {
    requestForm.classList.remove('hidden');
    preview.classList.add('hidden');
  });

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const gradeValue = Number(document.getElementById('aiLessonGrade').value);
    const gradeLabel = GRADE_OPTIONS.find((g) => g.value === gradeValue)?.label || gradeValue;
    const count = document.getElementById('aiLessonCount').value;
    const topic = document.getElementById('aiLessonTopic').value.trim();
    const subjectName = cachedSubjects.find((s) => s.id === currentSubjectId)?.name || currentSubjectId;

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري التوليد...';

    try {
      const response = await fetch(GENERATE_LESSONS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectName, grade: gradeLabel, count, topic })
      });

      if (!response.ok) throw new Error(`Generation failed with status ${response.status}`);

      const data = await response.json();
      generatedLessonsPreview = (data.lessons || []).map((l) => ({ ...l, grade: gradeValue }));

      renderAiPreview();
      requestForm.classList.add('hidden');
      preview.classList.remove('hidden');
    } catch (error) {
      console.error('Lesson generation failed:', error);
      alert('تعذّر توليد الدروس، تأكدي إنّ السيرفر (backend) شغّال وحاولي مرة أخرى.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'توليد ✨';
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (!generatedLessonsPreview.length) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'جاري الإضافة...';

    try {
      let nextOrder = currentLessons.length
        ? Math.max(...currentLessons.map((l) => l.order || 0)) + 1
        : 1;

      for (const lesson of generatedLessonsPreview) {
        await addDoc(collection(db, 'lessons'), {
          title: lesson.title,
          summary: lesson.summary,
          difficulty: lesson.difficulty || 'medium',
          grade: lesson.grade,
          subject: currentSubjectId,
          order: nextOrder,
          createdAt: serverTimestamp()
        });
        nextOrder++;
      }

      modal.classList.add('hidden');
      await loadLessonsForSubject(currentSubjectId);
    } catch (error) {
      console.error('Failed to bulk-add generated lessons:', error);
      alert('تعذّر إضافة بعض الدروس.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'إضافة الكل ✅';
    }
  });
}

function renderAiPreview() {
  const listEl = document.getElementById('aiPreviewList');

  if (!generatedLessonsPreview.length) {
    listEl.innerHTML = '<p style="color:#f87171;">ما ولّد الذكاء الاصطناعي أي دروس، جربي مرة ثانية.</p>';
    return;
  }

  const difficultyLabels = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

  listEl.innerHTML = generatedLessonsPreview
    .map(
      (lesson, i) => `
        <div class="ai-preview-item">
          <span class="lesson-order">#${i + 1}</span>
          <div class="lesson-row-info">
            <strong>${lesson.title}</strong>
            <span>${lesson.summary}</span>
            <span class="ai-preview-difficulty">${difficultyLabels[lesson.difficulty] || lesson.difficulty}</span>
          </div>
        </div>
      `
    )
    .join('');
}

async function loadLessonsForSubject(subjectId) {
  const listEl = document.getElementById('lessonsList');
  listEl.innerHTML = '<p style="color:#94a3b8;">جاري التحميل...</p>';

  try {
    const lessonsQuery = query(collection(db, 'lessons'), where('subject', '==', subjectId));
    const snap = await getDocs(lessonsQuery);
    currentLessons = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((lesson) => lesson.grade === currentGradeFilter)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    renderLessonsList();
  } catch (error) {
    console.error('Failed to load lessons:', error);
    listEl.innerHTML = '<p style="color:#f87171;">تعذّر تحميل الدروس.</p>';
  }
}

function renderLessonsList() {
  const listEl = document.getElementById('lessonsList');

  if (!currentLessons.length) {
    listEl.innerHTML = '<p style="color:#94a3b8;">لا توجد دروس لهذه المادة بعد.</p>';
    return;
  }

  listEl.innerHTML = currentLessons
    .map(
      (lesson, index) => `
        <div class="lesson-row" draggable="true" data-lesson-id="${lesson.id}" data-index="${index}">
          <span class="drag-handle" title="اسحبي لإعادة الترتيب">⠿</span>
          <span class="lesson-order">#${index + 1}</span>
          <div class="lesson-row-info">
            <strong>${lesson.title || 'بدون عنوان'}</strong>
            <span>${lesson.difficulty || '—'} · الصف ${lesson.grade || '—'}</span>
          </div>
          <div class="lesson-row-actions">
            <button type="button" class="icon-btn edit-lesson-btn" data-lesson-id="${lesson.id}" title="تعديل">✏️</button>
            <button type="button" class="icon-btn delete-lesson-btn" data-lesson-id="${lesson.id}" title="حذف">🗑️</button>
          </div>
        </div>
      `
    )
    .join('');

  attachRowEvents();
  attachDragEvents();
}

function attachRowEvents() {
  document.querySelectorAll('.edit-lesson-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lesson = currentLessons.find((l) => l.id === btn.dataset.lessonId);
      if (lesson) openLessonModal(lesson);
    });
  });

  document.querySelectorAll('.delete-lesson-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('متأكد إنك بدك تحذفي هذا الدرس؟')) return;
      try {
        await deleteDoc(doc(db, 'lessons', btn.dataset.lessonId));
        await loadLessonsForSubject(currentSubjectId);
      } catch (error) {
        console.error('Failed to delete lesson:', error);
        alert('تعذّر حذف الدرس.');
      }
    });
  });
}

function attachDragEvents() {
  const rows = document.querySelectorAll('.lesson-row');

  rows.forEach((row) => {
    row.addEventListener('dragstart', () => {
      dragSrcIndex = Number(row.dataset.index);
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
    });

    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      row.classList.remove('drag-over');
      const targetIndex = Number(row.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

      const moved = currentLessons.splice(dragSrcIndex, 1)[0];
      currentLessons.splice(targetIndex, 0, moved);
      dragSrcIndex = null;

      renderLessonsList();
      await persistOrder();
    });
  });
}

async function persistOrder() {
  try {
    const batch = writeBatch(db);
    currentLessons.forEach((lesson, index) => {
      batch.update(doc(db, 'lessons', lesson.id), { order: index + 1 });
    });
    await batch.commit();
  } catch (error) {
    console.error('Failed to persist lesson order:', error);
    alert('تعذّر حفظ الترتيب الجديد.');
  }
}

function openLessonModal(lesson) {
  editingLessonId = lesson ? lesson.id : null;
  document.getElementById('lessonModalTitle').textContent = lesson ? 'تعديل الدرس' : 'إضافة درس جديد';
  document.getElementById('lessonTitle').value = lesson?.title || '';
  document.getElementById('lessonSummary').value = lesson?.summary || '';
  document.getElementById('lessonDifficulty').value = lesson?.difficulty || 'medium';
  document.getElementById('lessonGrade').value = lesson?.grade || currentGradeFilter;
  document.getElementById('lessonModal').classList.remove('hidden');
}

function closeLessonModal() {
  document.getElementById('lessonModal').classList.add('hidden');
  document.getElementById('lessonForm').reset();
  editingLessonId = null;
}

async function saveLesson() {
  const title = document.getElementById('lessonTitle').value.trim();
  const summary = document.getElementById('lessonSummary').value.trim();
  const difficulty = document.getElementById('lessonDifficulty').value;
  const grade = Number(document.getElementById('lessonGrade').value);

  if (!title || !currentSubjectId) return;

  try {
    if (editingLessonId) {
      await updateDoc(doc(db, 'lessons', editingLessonId), { title, summary, difficulty, grade });
    } else {
      const nextOrder = currentLessons.length
        ? Math.max(...currentLessons.map((l) => l.order || 0)) + 1
        : 1;

      await addDoc(collection(db, 'lessons'), {
        title,
        summary,
        difficulty,
        grade,
        subject: currentSubjectId,
        order: nextOrder,
        createdAt: serverTimestamp()
      });
    }

    closeLessonModal();
    await loadLessonsForSubject(currentSubjectId);
  } catch (error) {
    console.error('Failed to save lesson:', error);
    alert('تعذّر حفظ الدرس.');
  }
}