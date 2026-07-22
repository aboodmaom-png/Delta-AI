import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const googleBtn = document.getElementById('googleSignInBtn');

  function mapAuthError(error) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صحيحة.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      case 'auth/email-already-in-use':
        return 'هذا البريد الإلكتروني مستخدم مسبقًا.';
      case 'auth/weak-password':
        return 'كلمة المرور ضعيفة، استخدم 6 أحرف على الأقل.';
      case 'auth/popup-closed-by-user':
        return 'تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.';
      default:
        return 'حدث خطأ ما، حاول مرة أخرى.';
    }
  }

  function showError(form, message) {
    if (!form) return;
    let errorEl = form.querySelector('.auth-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'auth-error';
      form.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function clearError(form) {
    form?.querySelector('.auth-error')?.remove();
  }

  // --- Inline field validation (replaces native browser validation bubbles,
  // which render at broken positions for the custom grade dropdown since its
  // real <select> is display:none). ---
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fieldContainer(input) {
    return input.closest('label') || input.parentElement;
  }

  function setFieldError(input, message) {
    clearFieldError(input);
    const container = fieldContainer(input);
    if (!container) return;

    const errorEl = document.createElement('p');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    container.appendChild(errorEl);

    input.classList.add('input-invalid');
    container.querySelector('.custom-select-trigger')?.classList.add('input-invalid');
  }

  function clearFieldError(input) {
    const container = fieldContainer(input);
    if (!container) return;

    container.querySelector('.field-error')?.remove();
    input.classList.remove('input-invalid');
    container.querySelector('.custom-select-trigger')?.classList.remove('input-invalid');
  }

  function clearAllFieldErrors(form) {
    form?.querySelectorAll('.field-error').forEach((el) => el.remove());
    form?.querySelectorAll('.input-invalid').forEach((el) => el.classList.remove('input-invalid'));
  }

  // Clear a field's error as soon as the person starts fixing it.
  function attachLiveClear(form) {
    form?.querySelectorAll('input, select').forEach((field) => {
      field.addEventListener('input', () => clearFieldError(field));
      field.addEventListener('change', () => clearFieldError(field));
    });
  }

  attachLiveClear(loginForm);
  attachLiveClear(signupForm);

  function validateLoginForm(form) {
    clearAllFieldErrors(form);
    let isValid = true;

    const email = form.querySelector('#email');
    if (!email.value.trim()) {
      setFieldError(email, 'الرجاء إدخال بريدك الإلكتروني.');
      isValid = false;
    } else if (!EMAIL_PATTERN.test(email.value.trim())) {
      setFieldError(email, 'صيغة البريد الإلكتروني غير صحيحة.');
      isValid = false;
    }

    const password = form.querySelector('#password');
    if (!password.value) {
      setFieldError(password, 'الرجاء إدخال كلمة المرور.');
      isValid = false;
    }

    return isValid;
  }

  function validateSignupForm(form) {
    clearAllFieldErrors(form);
    let isValid = true;

    const name = form.querySelector('#name');
    if (!name.value.trim()) {
      setFieldError(name, 'الرجاء إدخال اسمك الكامل.');
      isValid = false;
    }

    const grade = form.querySelector('#grade');
    if (!grade.value) {
      setFieldError(grade, 'الرجاء اختيار صفك الدراسي.');
      isValid = false;
    }

    const email = form.querySelector('#email');
    if (!email.value.trim()) {
      setFieldError(email, 'الرجاء إدخال بريدك الإلكتروني.');
      isValid = false;
    } else if (!EMAIL_PATTERN.test(email.value.trim())) {
      setFieldError(email, 'صيغة البريد الإلكتروني غير صحيحة.');
      isValid = false;
    }

    const password = form.querySelector('#password');
    if (!password.value) {
      setFieldError(password, 'الرجاء إدخال كلمة المرور.');
      isValid = false;
    } else if (password.value.length < 6) {
      setFieldError(password, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      isValid = false;
    }

    return isValid;
  }

  async function createUserDocument(user, name, grade) {
    await setDoc(doc(db, 'users', user.uid), {
      name,
      email: user.email,
      grade,
      xp: 0,
      level: 1,
      challengesCompleted: 0,
      createdAt: serverTimestamp()
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError(loginForm);

      if (!validateLoginForm(loginForm)) return;

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitButton = loginForm.querySelector('button[type="submit"]');

      submitButton.disabled = true;
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);

        // التحقق من صلاحية المستخدم (admin أو طالب)
        const userSnap = await getDoc(doc(db, 'users', credential.user.uid));

       if (userSnap.exists() && userSnap.data().role === 'admin') {
  window.location.href = 'admin/admin.html';
  return;
}

        window.location.href = 'dashboard.html';
      } catch (error) {
        showError(loginForm, mapAuthError(error));
        submitButton.disabled = false;
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError(signupForm);

      if (!validateSignupForm(signupForm)) return;

      const name = document.getElementById('name').value.trim();
      const grade = document.getElementById('grade').value;
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitButton = signupForm.querySelector('button[type="submit"]');

      submitButton.disabled = true;
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await createUserDocument(credential.user, name, grade);
        window.location.href = 'subjects.html';
      } catch (error) {
        showError(signupForm, mapAuthError(error));
        submitButton.disabled = false;
      }
    });
  }

  // --- Google sign-in (shared between login.html and signup.html) ---
  if (googleBtn) {
    const googleProvider = new GoogleAuthProvider();
    const hostForm = loginForm || signupForm;

    googleBtn.addEventListener('click', async () => {
      clearError(hostForm);
      googleBtn.disabled = true;

      try {
        const credential = await signInWithPopup(auth, googleProvider);
        const userRef = doc(db, 'users', credential.user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // First time signing in with Google. Grade isn't available from
          // the Google profile, so it's left null — challenge.js already
          // handles a missing grade gracefully by falling back to any
          // lesson, and it can be filled in later from the profile page.
          await setDoc(userRef, {
            name: credential.user.displayName || 'طالب Delta AI',
            email: credential.user.email,
            grade: null,
            xp: 0,
            level: 1,
            challengesCompleted: 0,
            createdAt: serverTimestamp()
          });
          window.location.href = 'subjects.html';
          return;
        }

        if (userSnap.data().role === 'admin') {
          window.location.href = 'admin/admin.html';
          return;
        }

        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error('Google sign-in failed:', error);
        showError(hostForm, mapAuthError(error));
      } finally {
        googleBtn.disabled = false;
      }
    });
  }
});