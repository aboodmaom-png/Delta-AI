document.addEventListener('DOMContentLoaded', () => {
  // --- Section: Subjects data ---
  const subjects = [
    {
      id: 'math',
      name: 'الرياضيات',
      icon: 'calculator',
      description: 'وظّف الأرقام والنسب في مواقف يومية حقيقية'
    },
    {
      id: 'science',
      name: 'العلوم',
      icon: 'atom',
      description: 'افهم الطبيعة من حولك وطبّقها في حياتك'
    }
  ];

  const subjectContainer = document.querySelector('[data-subjects]');
  if (subjectContainer) {
    subjectContainer.innerHTML = subjects
      .map(
        (subject) => `
          <article class="subject-card">
            <div class="subject-icon">
              <i data-lucide="${subject.icon}"></i>
            </div>
            <h3>${subject.name}</h3>
            <p>${subject.description}</p>
            <button class="secondary-btn subject-start-btn" data-subject-id="${subject.id}">
              ابدأ ←
            </button>
          </article>
        `
      )
      .join('');

    // ربط كل زر بالنقر → يودي لصفحة الدروس الخاصة بالمادة
    subjectContainer.querySelectorAll('.subject-start-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sessionStorage.setItem('selectedSubject', btn.dataset.subjectId);
        window.location.href = 'lessons.html';
      });
    });
  }

  // --- Section: Icons initialization ---
  if (window.lucide) {
    window.lucide.createIcons();
  }
});