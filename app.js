// 1. Import your Firebase Modular SDK bundles
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. Your Exact Firebase Configuration Project Core
const firebaseConfig = {
    apiKey: "AIzaSyBhaPM20tIhMalxLjoCklmwy4qb1ZkraSo",
    authDomain: "guardianos-30b18.firebaseapp.com",
    projectId: "guardianos-30b18",
    storageBucket: "guardianos-30b18.appspot.com",
    messagingSenderId: "323558398331",
    appId: "1:323558398331:android:a022a1e38b48a0247705de",
    databaseURL: "https://guardianos-30b18-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase Core and Auth Service
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 3. Document Element Mappings
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const submitBtn = document.getElementById("btn-login");
const toggleAuthLink = document.getElementById("toggle-auth-link");
const toggleAuthText = document.getElementById("toggle-auth-text");

let isLoginMode = true; // Flips between Sign In and Sign Up

// --- UI Notification Helper Functions ---
function showError(message) {
    errorText.innerText = message;
    errorMessage.classList.remove("hidden");
    submitBtn.removeAttribute("disabled");
}

function hideError() {
    errorMessage.classList.add("hidden");
}

// --- Toggle between Login and Registration Modes ---
toggleAuthLink.addEventListener("click", (e) => {
    e.preventDefault();
    hideError();
    isLoginMode = !isLoginMode;

    if (isLoginMode) {
        document.querySelector(".btn-text").innerText = "INITIALIZE LINK";
        toggleAuthText.innerHTML = 'New system node? <a href="#" id="toggle-auth-link">Register Terminal</a>';
    } else {
        document.querySelector(".btn-text").innerText = "REGISTER OPERATOR";
        toggleAuthText.innerHTML = 'Existing node? <a href="#" id="toggle-auth-link">Return to Uplink</a>';
    }
    
    // Re-bind the click listener since innerHTML wipes previous assignments
    document.getElementById("toggle-auth-link").addEventListener("click", arguments.callee);
});

// --- Handle Authentication Actions ---
authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideError();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Loading State Feedback
    submitBtn.setAttribute("disabled", "true");
    document.querySelector(".btn-text").innerText = "AUTHORIZING...";

    if (isLoginMode) {
        // --- LOGGING IN AS MASTER ADMIN OPERATOR ---
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("Operator successfully authenticated:", user.email);
                
                // Route directly to your primary control dashboard
                window.location.href = "dashboard.html"; 
            })
            .catch((error) => {
                console.error("Auth Failure Code:", error.code);
                let clearMessage = "Uplink Denied: Invalid Operator Credentials";
                if (error.code === "auth/user-not-found") clearMessage = "Operator ID not found in security directory.";
                if (error.code === "auth/wrong-password") clearMessage = "Invalid master encryption access key.";
                
                showError(clearMessage);
                document.querySelector(".btn-text").innerText = "INITIALIZE LINK";
            });
    } else {
        // --- CREATING NEW ACCOUNTS (Like your hardware device account) ---
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                alert("Account Registration Confirmed! Note the user ID string from your console.");
                isLoginMode = true;
                document.querySelector(".btn-text").innerText = "INITIALIZE LINK";
                submitBtn.removeAttribute("disabled");
            })
            .catch((error) => {
                showError("Registration Blocked: " + error.message);
                document.querySelector(".btn-text").innerText = "REGISTER OPERATOR";
            });
    }
});

// --- Active Session Persistent Loop Back ---
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes("index.html")) {
        // If an administrator is already logged in on this browser session, advance straight to dashboard
        window.location.href = "dashboard.html";
    }
});
