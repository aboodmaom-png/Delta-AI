// Firebase initialization — CDN modular SDK, no bundler required.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhg0DwoDKx8kgeOgWwxmr7-io8DYdevaE",
  authDomain: "learnquest-4590a.firebaseapp.com",
  projectId: "learnquest-4590a",
  storageBucket: "learnquest-4590a.firebasestorage.app",
  messagingSenderId: "507725632143",
  appId: "1:507725632143:web:4b7d998fe06ec3f52556fa",
  measurementId: "G-RJYNDWD1C3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
