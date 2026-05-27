import { auth, database } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements - Telemetry Display Nodes
const batteryText = document.getElementById("battery-text");
const networkText = document.getElementById("network-text");
const deviceStateText = document.getElementById("device-state-text");
const gpsText = document.getElementById("gps-text");
const mapLink = document.getElementById("map-link");
const btnLogout = document.getElementById("btn-logout");

// DOM Elements - Remote Command Grid Buttons
const cmdFlashlight = document.getElementById("cmd-flashlight");
const cmdAlarm = document.getElementById("cmd-alarm");
const cmdLock = document.getElementById("cmd-lock");
const cmdCapture = document.getElementById("cmd-capture");

let currentUserUid = null;

// ==========================================================================
// 1. SESSION SECURE PROTECTIONS
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUid = user.uid;
        console.log("Secure terminal linked. Operator UID:", currentUserUid);
        
        // Begin sync feeds
        initializeTelemetryStream(user.uid);
        initializeCommandStateListeners(user.uid);
    } else {
        console.warn("Unauthorized access detected. Intercepting and rerouting...");
        window.location.href = "./index.html";
    }
});

// Logout Operator System Account
btnLogout.addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            window.location.href = "./index.html";
        })
        .catch((error) => console.error("Disconnect failure:", error));
});

// ==========================================================================
// 2. REAL-TIME DATA STREAM SYNCHRONIZATION (Phone -> Web)
// ==========================================================================
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);

    onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            console.log("No telemetry received yet. Device pending connection...");
            batteryText.innerText = "--%";
            networkText.innerText = "UNKNOWN";
            return;
        }

        // Update Battery Level Metrics (Expects 'batteryPercentage' from Android)
        if (data.batteryPercentage !== undefined) {
            batteryText.innerText = `${data.batteryPercentage}%`;
        } else {
            batteryText.innerText = "--%";
        }

        // Update Network Architecture Info (Expects 'networkType' from Android)
        if (data.networkType) {
            networkText.innerText = data.networkType.toUpperCase();
        } else {
            networkText.innerText = "UNKNOWN";
        }

        // Update Global Positioning Telemetry (Expects 'latitude' & 'longitude')
        if (data.latitude && data.longitude) {
            gpsText.innerText = `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;
            
            // FIXED: Cleared syntax bug and pointed link parameters to standard web coordinates schema
            mapLink.href = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
            mapLink.classList.remove("disabled");
        } else {
            gpsText.innerText = "Waiting for coordinates...";
            mapLink.classList.add("disabled");
            mapLink.removeAttribute("href");
        }

        // FIXED: Intercept incoming background camera snapshot links from Firebase Storage
        const imageElement = document.getElementById('cameraPreviewFrame');
        const placeholderText = document.getElementById('cameraPlaceholderText');
        const timestampElement = document.getElementById('captureTimestamp');
        
        // Ensure UI components exist in your HTML before attempting data rendering mutations
        if (imageElement && placeholderText) {
            if (data.lastPhotoUrl && data.lastPhotoUrl.trim() !== "") {
                placeholderText.style.display = "none";
                imageElement.style.display = "block";
                imageElement.src = data.lastPhotoUrl;
                
                if (timestampElement) {
                    const currentTime = new Date().toLocaleTimeString();
                    timestampElement.innerText = `Last updated: Today at ${currentTime}`;
                }
            } else {
                imageElement.style.display = "none";
                placeholderText.style.display = "block";
                if (timestampElement) timestampElement.innerText = "Last updated: Never";
            }
        }

        // Update Overall Security Device States
        if (data.isDeviceLocked) {
            deviceStateText.innerText = "EMERGENCY LOCK";
            deviceStateText.className = "metric-value";
            deviceStateText.style.color = "#ff0055"; // Bright alert neon magenta
            deviceStateText.style.textShadow = "0 0 8px rgba(255, 0, 85, 0.5)";
        } else {
            deviceStateText.innerText = "SECURE";
            deviceStateText.className = "metric-value status-secure";
            deviceStateText.style.color = ""; 
            deviceStateText.style.textShadow = "";
        }
    });
}

// ==========================================================================
// 3. COMMAND EXECUTIVE LOOP MANAGERS (Web -> Phone Toggle states)
// ==========================================================================
function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);

    onValue(commandsRef, (snapshot) => {
        const commands = snapshot.val() || {};

        toggleButtonVisualState(cmdFlashlight, commands.flashlight);
        toggleButtonVisualState(cmdAlarm, commands.alarm);
        toggleButtonVisualState(cmdLock, commands.emergencyLock);
        toggleButtonVisualState(cmdCapture, commands.cameraCapture);
    });
}

function toggleButtonVisualState(buttonElement, isActive) {
    if (buttonElement) {
        if (isActive) {
            buttonElement.classList.add("active-state");
        } else {
            buttonElement.classList.remove("active-state");
        }
    }
}

// Fire Database Event Adjustments on interaction clicks
cmdFlashlight.addEventListener("click", () => {
    const isCurrentlyActive = cmdFlashlight.classList.contains("active-state");
    sendRemoteCommand("flashlight", !isCurrentlyActive);
});

cmdAlarm.addEventListener("click", () => {
    const isCurrentlyActive = cmdAlarm.classList.contains("active-state");
    sendRemoteCommand("alarm", !isCurrentlyActive);
});

cmdLock.addEventListener("click", () => {
    const isCurrentlyActive = cmdLock.classList.contains("active-state");
    const confirmLock = confirm(isCurrentlyActive ? "Deactivate Emergency Lockdown protocol?" : "Initialize Emergency Device Lockdown protocol?");
    if (confirmLock) {
        const targetState = !isCurrentlyActive;
        const updates = {};
        updates[`devices/${currentUserUid}/commands/emergencyLock`] = targetState;
        updates[`devices/${currentUserUid}/status/isDeviceLocked`] = targetState;
        update(ref(database), updates);
    }
});

cmdCapture.addEventListener("click", () => {
    sendRemoteCommand("cameraCapture", true);
    alert("Camera snapshot frame request transmitted to mobile node.");
});

function sendRemoteCommand(commandName, targetValue) {
    if (!currentUserUid) return;
    const commandNodeRef = ref(database, `devices/${currentUserUid}/commands/${commandName}`);
    set(commandNodeRef, targetValue)
        .catch((error) => console.error(`Command execution fault [${commandName}]:`, error));
}
