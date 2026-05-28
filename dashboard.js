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

// TARGET CONFIGURATION: Points to your active mobile hardware node folder precisely
let targetDeviceUid = "6dGvVsLXCYePuqRZVat2sc6ytG3"; 

// ==========================================================================
// 1. SESSION SECURE PROTECTIONS (With Admin Email Control & Dynamic Sync)
// ==========================================================================
const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com"; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email && user.email.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
            currentUserUid = user.uid;
            console.log("Secure terminal linked. Operator UID:", currentUserUid);
            console.log("Targeting device node UID:", targetDeviceUid);
            
            // Fire up active telemetry feeds using targeted device ID context
            initializeTelemetryStream(targetDeviceUid);
            initializeCommandStateListeners(targetDeviceUid);
        } else {
            console.warn("Unauthorized operator profile rejected. Intercepting...");
            alert("Access Denied: This profile is unauthorized to issue command responses.");
            
            signOut(auth).then(() => {
                window.location.href = "./index.html";
            });
        }
    } else {
        console.warn("Unauthorized access detected. Intercepting and rerouting...");
        window.location.href = "./index.html";
    }
});

// Logout Operator System Account
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth)
            .then(() => {
                window.location.href = "./index.html";
            })
            .catch((error) => console.error("Disconnect failure:", error));
    });
}

// ==========================================================================
// 2. REAL-TIME DATA STREAM SYNCHRONIZATION (Phone -> Web)
// ==========================================================================
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);

    onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            console.log("No telemetry received yet. Device pending connection...");
            if (batteryText) batteryText.innerText = "--%";
            if (networkText) networkText.innerText = "UNKNOWN";
            return;
        }

        // Update Battery Level Metrics
        if (batteryText) {
            batteryText.innerText = data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
        }

        // Update Network Architecture Info
        if (networkText) {
            networkText.innerText = data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";
        }

        // Update Global Positioning Telemetry Safely (Crash Resistant)
        if (gpsText) {
            if (data.latitude !== undefined && data.longitude !== undefined && data.latitude !== null && data.longitude !== null) {
                const latNum = parseFloat(data.latitude);
                const lngNum = parseFloat(data.longitude);

                if (!isNaN(latNum) && !isNaN(lngNum)) {
                    gpsText.innerText = `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
                    
                    if (mapLink) {
                        // FIXED: Re-engineered broken template literal context path to a valid global navigation search endpoint
                        mapLink.href = `https://maps.google.com/?q=${latNum},${lngNum}`;
                        mapLink.classList.remove("disabled");
                    }
                } else {
                    gpsText.innerText = "Telemetry Format Error";
                    if (mapLink) mapLink.classList.add("disabled");
                }
            } else {
                gpsText.innerText = "Waiting for coordinates...";
                if (mapLink) {
                    mapLink.classList.add("disabled");
                    mapLink.removeAttribute("href");
                }
            }
        }

        // REALTIME IMAGE DOWNLOAD OVERRIDE
        const imageElement = document.getElementById('cameraPreviewFrame');
        const placeholderText = document.getElementById('cameraPlaceholderText');
        const timestampElement = document.getElementById('captureTimestamp');
        
        if (imageElement && placeholderText) {
            if (data.lastPhotoUrl && data.lastPhotoUrl.trim() !== "") {
                placeholderText.style.display = "none";
                imageElement.style.display = "block";
                imageElement.src = data.lastPhotoUrl;
                
                if (timestampElement) {
                    const currentTime = new Date().toLocaleTimeString();
                    timestampElement.innerText = `LAST UPDATED: TODAY AT ${currentTime}`;
                }
            } else {
                imageElement.style.display = "none";
                placeholderText.style.display = "flex";
            }
        }

        // Update Overall Security Device States
        if (deviceStateText) {
            if (data.isDeviceLocked) {
                deviceStateText.innerText = "EMERGENCY LOCK";
                deviceStateText.className = "metric-value";
                deviceStateText.style.color = "#ff0055"; 
                deviceStateText.style.textShadow = "0 0 8px rgba(255, 0, 85, 0.5)";
            } else {
                deviceStateText.innerText = "SECURE";
                deviceStateText.className = "metric-value status-secure";
                deviceStateText.style.color = ""; 
                deviceStateText.style.textShadow = "";
            }
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
        
        if (cmdCapture) {
            const label = cmdCapture.querySelector('span');
            if (commands.cameraCapture) {
                cmdCapture.classList.add("active-state");
                if (label) label.innerText = "CAPTURING...";
            } else {
                cmdCapture.classList.remove("active-state");
                if (label) label.innerText = "CAMERA CAPTURE";
            }
        }
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

if (cmdFlashlight) {
    cmdFlashlight.addEventListener("click", () => {
        const isCurrentlyActive = cmdFlashlight.classList.contains("active-state");
        sendRemoteCommand("flashlight", !isCurrentlyActive);
    });
}

if (cmdAlarm) {
    cmdAlarm.addEventListener("click", () => {
        const isCurrentlyActive = cmdAlarm.classList.contains("active-state");
        sendRemoteCommand("alarm", !isCurrentlyActive);
    });
}

if (cmdLock) {
    cmdLock.addEventListener("click", () => {
        const isCurrentlyActive = cmdLock.classList.contains("active-state");
        const confirmLock = confirm(isCurrentlyActive ? "Deactivate Emergency Lockdown protocol?" : "Initialize Emergency Device Lockdown protocol?");
        if (confirmLock) {
            const targetState = !isCurrentlyActive;
            const updates = {};
            updates[`devices/${targetDeviceUid}/commands/emergencyLock`] = targetState;
            updates[`devices/${targetDeviceUid}/status/isDeviceLocked`] = targetState;
            update(ref(database), updates);
        }
    });
}

if (cmdCapture) {
    cmdCapture.addEventListener("click", () => {
        const imageElement = document.getElementById('cameraPreviewFrame');
        const placeholderText = document.getElementById('cameraPlaceholderText');
        if (imageElement && placeholderText) {
            imageElement.style.display = "none";
            placeholderText.style.display = "flex";
        }

        sendRemoteCommand("cameraCapture", true);
    });
}

function sendRemoteCommand(commandName, targetValue) {
    if (!currentUserUid || !targetDeviceUid) return;
    const commandNodeRef = ref(database, `devices/${targetDeviceUid}/commands/${commandName}`);
    set(commandNodeRef, targetValue)
        .catch((error) => console.error(`Command execution fault [${commandName}]:`, error));
}
