import { auth } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorFrame = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const btnSubmit = document.getElementById("btn-login");
const toggleAuthLink = document.getElementById("toggle-auth-link");
const toggleAuthText = document.getElementById("toggle-auth-text");

// Authentication State Mode: 'login' or 'register'
let authMode = "login";

// ==========================================================================
// 1. SESSION MONITORING
// ==========================================================================
// If the operator is already signed in, bypass login and jump to dashboard
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Active session authenticated:", user.email);
        window.location.href = "./dashboard.html"; // Fixed relative path routing for GitHub Pages
    }
});

// ==========================================================================
// 2. FORM SUBMISSION HANDLER (SIGN IN / REGISTER)
// ==========================================================================
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Hide previous error panels and show loading feedback
    hideError();
    setLoadingState(true);

    try {
        if (authMode === "login") {
            // Process Login
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("Terminal authorized successfully:", userCredential.user.uid);
            window.location.href = "./dashboard.html"; // Fixed relative path routing
        } else {
            // Process Account Registration
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("New system node created:", userCredential.user.uid);
            window.location.href = "./dashboard.html"; // Fixed relative path routing
        }
    } catch (error) {
        console.error("Authentication fault:", error.code, error.message);
        displayError(formatFirebaseError(error.code));
        setLoadingState(false);
    }
});

// ==========================================================================
// 3. TOGGLE INTERFACE BETWEEN LOGIN & REGISTRATION
// ==========================================================================
toggleAuthLink.addEventListener("click", (e) => {
    e.preventDefault();
    hideError();
    
    if (authMode === "login") {
        authMode = "register";
        btnSubmit.querySelector(".btn-text").innerText = "REGISTER TERMINAL";
        toggleAuthText.innerHTML = `Existing network operator? <a href="#" id="toggle-auth-link">Initialize Link</a>`;
    } else {
        authMode = "login";
        btnSubmit.querySelector(".btn-text").innerText = "INITIALIZE LINK";
        toggleAuthText.innerHTML = `New system node? <a href="#" id="toggle-auth-link">Register Terminal</a>`;
    }
    
    // Re-bind click event listener since the innerHTML re-rendered the anchor tag
    document.getElementById("toggle-auth-link").addEventListener("click", arguments.callee);
});

// ==========================================================================
// 4. HELPER FUNCTIONS FOR INTERFACE FEEDBACK
// ==========================================================================
function displayError(message) {
    errorText.innerText = message;
    errorFrame.classList.remove("hidden");
}

function hideError() {
    errorFrame.classList.add("hidden");
}

function setLoadingState(isLoading) {
    if (isLoading) {
        btnSubmit.disabled = true;
        btnSubmit.querySelector(".btn-text").innerText = "SYNCHRONIZING...";
        btnSubmit.style.opacity = "0.6";
    } else {
        btnSubmit.disabled = false;
        btnSubmit.querySelector(".btn-text").innerText = authMode === "login" ? "INITIALIZE LINK" : "REGISTER TERMINAL";
        btnSubmit.style.opacity = "1";
    }
}

function formatFirebaseError(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email":
            return "Invalid operator email format.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Access Denied: Invalid credentials.";
        case "auth/weak-password":
            return "Access Key must be at least 6 characters.";
        case "auth/email-already-in-use":
            return "Terminal address already registered.";
        default:
            return "Connection fault. Check security protocols.";
    }
}
