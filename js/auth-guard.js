import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const style = document.createElement('style');
style.id = 'authGuardHide';
style.textContent = 'body { visibility: hidden; }';
document.head.appendChild(style);

function revealPage() {
  document.getElementById('authGuardHide')?.remove();
}

// شبكة أمان: لو Firebase تأخر، أظهر الصفحة بدل ما تضل فاضية
const failSafe = setTimeout(revealPage, 8000);

onAuthStateChanged(auth, (user) => {
  clearTimeout(failSafe);
  if (user) {
    revealPage();
    return;
  }
  try {
    const current = window.location.pathname.split('/').pop() || 'dashboard.html';
    sessionStorage.setItem('redirectAfterLogin', current);
  } catch (error) {
    console.error('Could not store redirect target:', error);
  }
  window.location.replace('login.html');
});