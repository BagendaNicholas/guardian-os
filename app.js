// 1. Import Auth methods from the web SDK and instances from your shared file
import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. Document Element Mappings
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const submitBtn = document.getElementById("btn-login");
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

// --- Toggle between Login and Registration Modes Fix ---
function handleToggle(e) {
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
    
    // Safely re-bind to the freshly injected dynamic innerHTML anchor tag
    document.getElementById("toggle-auth-link").addEventListener("click", handleToggle);
}

// Attach initial listener to the static HTML anchor
document.getElementById("toggle-auth-link").addEventListener("click", handleToggle);

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
                console.log("Operator successfully authenticated:", userCredential.user.email);
                // Redirect directly to your dashboard control page
                window.location.href = "./dashboard.html"; 
            })
            .catch((error) => {
                console.error("Auth Failure Code:", error.code);
                let clearMessage = "Uplink Denied: Invalid Operator Credentials";
                if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
                    clearMessage = "Invalid master encryption access key or operator ID.";
                }
                
                showError(clearMessage);
                document.querySelector(".btn-text").innerText = "INITIALIZE LINK";
            });
    } else {
        // --- CREATING NEW ACCOUNTS ---
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                alert("Account Registration Confirmed! You can now log into your console.");
                isLoginMode = true;
                document.querySelector(".btn-text").innerText = "INITIALIZE LINK";
                toggleAuthText.innerHTML = 'New system node? <a href="#" id="toggle-auth-link">Register Terminal</a>';
                document.getElementById("toggle-auth-link").addEventListener("click", handleToggle);
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
    // If an administrator is already logged in, skip login page and move directly to controls
    if (user && (window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("index.html/"))) {
        window.location.href = "./dashboard.html";
    }
});
