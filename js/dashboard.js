document.addEventListener('DOMContentLoaded', () => {
  // --- Section: Subjects data ---
  const subjects = [
    {
      id: 'math',
      name: 'الرياضيات',
      icon: 'sigma',
      description: 'وظّف الأرقام والنسب في مواقف يومية حقيقية'
    },
    {
      id: 'science',
      name: 'العلوم',
      icon: 'flask-conical',
      description: 'افهم الطبيعة من حولك وطبّقها في حياتك'
    }
  ];

  const subjectContainer = document.querySelector('[data-subjects]');
  if (subjectContainer) {
    subjectContainer.innerHTML = subjects
      .map(
        (subject) => `
          <article class="subject-card subject-${subject.id}">
            <div class="subject-band" aria-hidden="true"><i data-lucide="${subject.icon}"></i></div>
            <div class="subject-body">
              <h3>${subject.name}</h3>
              <p>${subject.description}</p>
              <button type="button" class="primary-btn subject-start-btn" data-subject-id="${subject.id}">ابدأ</button>
            </div>
          </article>
        `
      )
      .join('');

    // ربط كل زر بالنقر → يودي لصفحة الدروس الخاصة بالمادة
    subjectContainer.querySelectorAll('.subject-start-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
sessionStorage.setItem('selectedSubjectId', btn.dataset.subjectId);
        window.location.href = 'lessons.html';
      });
    });
  }

  // --- Section: Icons initialization ---
  if (window.lucide) {
    window.lucide.createIcons();
  }
});