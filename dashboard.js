import { auth, database } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements
const batteryText = document.getElementById("battery-text");
const networkText = document.getElementById("network-text");
const deviceStateText = document.getElementById("device-state-text");
const gpsText = document.getElementById("gps-text");
const mapLink = document.getElementById("map-link");
const btnLogout = document.getElementById("btn-logout");
const cmdFlashlight = document.getElementById("cmd-flashlight");
const cmdAlarm = document.getElementById("cmd-alarm");
const cmdLock = document.getElementById("cmd-lock");
const cmdCapture = document.getElementById("cmd-capture");

let currentUserUid = null;
let targetDeviceUid = "6dGvVsLXCYePuqRZVat2sc6ytG3"; 

const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com"; 

// ==========================================================================
// 1. SESSION SECURE PROTECTIONS
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user && user.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
        currentUserUid = user.uid;
        initializeTelemetryStream(targetDeviceUid);
        initializeCommandStateListeners(targetDeviceUid);
    } else {
        window.location.href = "./index.html";
    }
});

if (btnLogout) {
    btnLogout.addEventListener("click", () => signOut(auth).then(() => window.location.href = "./index.html"));
}

// ==========================================================================
// 2. REAL-TIME DATA STREAM SYNCHRONIZATION
// ==========================================================================
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);

    onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (batteryText) batteryText.innerText = data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
        if (networkText) networkText.innerText = data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";

        // Fixed GPS and Map Link Logic
        if (gpsText && data.latitude != null && data.longitude != null) {
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            gpsText.innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            
            if (mapLink) {
                // FIXED: Corrected template literal syntax
                mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                mapLink.classList.remove("disabled");
            }
        }

        // Security Device States
        if (deviceStateText) {
            deviceStateText.innerText = data.isDeviceLocked ? "EMERGENCY LOCK" : "SECURE";
            deviceStateText.className = data.isDeviceLocked ? "metric-value alert-text" : "metric-value status-secure";
        }

        // Image Stream
        const img = document.getElementById('cameraPreviewFrame');
        const placeholder = document.getElementById('cameraPlaceholderText');
        if (img && placeholder && data.lastPhotoUrl) {
            placeholder.style.display = "none";
            img.style.display = "block";
            img.src = data.lastPhotoUrl;
            document.getElementById('captureTimestamp').innerText = `LAST UPDATED: ${new Date().toLocaleTimeString()}`;
        }
    });
}

// ==========================================================================
// 3. COMMAND EXECUTIVE LOOP MANAGERS
// ==========================================================================
function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    onValue(commandsRef, (snapshot) => {
        const cmd = snapshot.val() || {};
        toggleButtonVisualState(cmdFlashlight, cmd.flashlight);
        toggleButtonVisualState(cmdAlarm, cmd.alarm);
        toggleButtonVisualState(cmdLock, cmd.emergencyLock);
        
        if (cmdCapture) {
            const label = cmdCapture.querySelector('span');
            cmdCapture.classList.toggle("active-state", !!cmd.cameraCapture);
            if (label) label.innerText = cmd.cameraCapture ? "CAPTURING..." : "CAMERA CAPTURE";
        }
    });
}

function toggleButtonVisualState(btn, active) {
    if (btn) btn.classList.toggle("active-state", !!active);
}

// Event Listeners for Commands
cmdFlashlight?.addEventListener("click", () => sendRemoteCommand("flashlight", !cmdFlashlight.classList.contains("active-state")));
cmdAlarm?.addEventListener("click", () => sendRemoteCommand("alarm", !cmdAlarm.classList.contains("active-state")));
cmdLock?.addEventListener("click", () => {
    const targetState = !cmdLock.classList.contains("active-state");
    if (confirm(targetState ? "Initialize Lockdown?" : "Deactivate Lockdown?")) {
        const updates = {};
        updates[`devices/${targetDeviceUid}/commands/emergencyLock`] = targetState;
        updates[`devices/${targetDeviceUid}/status/isDeviceLocked`] = targetState;
        update(ref(database), updates);
    }
});
cmdCapture?.addEventListener("click", () => sendRemoteCommand("cameraCapture", true));

function sendRemoteCommand(name, val) {
    const payload = {};
    payload[name] = val;
    update(ref(database, `devices/${targetDeviceUid}/commands`), payload);
}
