console.log("✅ LOGIN JS LOADED");

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    console.log("📧 Email:", email);

    try {

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        console.log("✅ Firebase Login Success");

        const uid = userCredential.user.uid;

        console.log("🆔 UID:", uid);

        const userRef = doc(db, "users", uid);

        const userSnap = await getDoc(userRef);

        console.log("📄 Document Exists:", userSnap.exists());

        if (!userSnap.exists()) {

            alert("بيانات المستخدم غير موجودة.");

            return;

        }

        const userData = userSnap.data();

        console.log("👤 User Data:", userData);

        console.log("🎯 Role:", userData.role);

        if (userData.role === "admin") {

            console.log("🚀 ADMIN DETECTED");

            window.location.href = "admin.html";

            return;

        }

        console.log("🎓 STUDENT DETECTED");

        window.location.href = "dashboard.html";

    }

    catch (error) {

        console.error("❌ LOGIN ERROR:", error);

        alert(error.message);

    }

});