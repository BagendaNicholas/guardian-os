import { auth, database } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements - Sidebar Components
const devicesList = document.getElementById("devices-list");
const deviceCountBadge = document.getElementById("device-count");
const btnRefreshDevices = document.getElementById("btn-refresh-devices");

// DOM Elements - Container Layout Toggles
const noDeviceAlert = document.getElementById("no-device-alert");
const deviceDashboard = document.getElementById("device-dashboard");
const selectedDeviceName = document.getElementById("selected-device-name");

// DOM Elements - Telemetry Node Displays
const batteryText = document.getElementById("battery-text");
const batteryBar = document.getElementById("battery-bar");
const networkText = document.getElementById("network-text");
const deviceStateText = document.getElementById("device-state-text");
const lastSeenText = document.getElementById("last-seen-text");
const latitudeText = document.getElementById("latitude-text");
const longitudeText = document.getElementById("longitude-text");
const mapLink = document.getElementById("map-link");
const btnLogout = document.getElementById("btn-logout");

// DOM Elements - Action Command Matrix Elements
const cmdFlashlight = document.getElementById("cmd-flashlight");
const cmdAlarm = document.getElementById("cmd-alarm");
const cmdLock = document.getElementById("cmd-lock");
const cmdCapture = document.getElementById("cmd-capture");

// System Runtime References
let currentUserUid = null;
let activeDeviceUid = null; 

// Track active listeners for proper teardown on switch
let activeStatusRef = null;
let activeCommandsRef = null;

const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com"; 

// ==========================================================================
// 1. SESSION SECURE PROTECTIONS & DISCONNECTS
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email && user.email.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
            currentUserUid = user.uid;
            console.log("Secure terminal linked. Operator UID:", currentUserUid);
            initializeDevicesSidebar();
        } else {
            console.warn("Unauthorized operator profile rejected.");
            alert("Access Denied: This profile is unauthorized.");
            secureSignOut();
        }
    } else {
        window.location.href = "./index.html";
    }
});

function secureSignOut() {
    signOut(auth).then(() => {
        window.location.href = "./index.html";
    }).catch((err) => console.error("Disconnect failure:", err));
}

if (btnLogout) {
    btnLogout.addEventListener("click", secureSignOut);
}

// ==========================================================================
// 2. SIDEBAR MULTI-DEVICE DIRECTORY CONSTRUCTOR (Aligned with CSS classes)
// ==========================================================================
function initializeDevicesSidebar() {
    const devicesRootRef = ref(database, "devices");

    onValue(devicesRootRef, (snapshot) => {
        const devicesData = snapshot.val() || {};
        if (devicesList) devicesList.innerHTML = ""; 
        
        const deviceKeys = Object.keys(devicesData);
        if (deviceCountBadge) deviceCountBadge.innerText = deviceKeys.length;

        if (deviceKeys.length === 0) {
            if (devicesList) {
                devicesList.innerHTML = `<div style="padding:15px; color:var(--text-secondary);">No devices active...</div>`;
            }
            return;
        }

        deviceKeys.forEach((uid) => {
            const device = devicesData[uid];
            const deviceName = device.name || device.status?.deviceName || `TERMINAL [${uid.substring(0, 5)}]`;
            const isLocked = device.status?.isDeviceLocked || false;
            
            const deviceItem = document.createElement("div");
            // Uses exact match for .device-item and .device-item.active
            deviceItem.className = `device-item ${uid === activeDeviceUid ? "active" : ""}`;
            deviceItem.setAttribute("data-uid", uid);
            
            // Uses your defined layout classes: .device-item-info, .device-item-name, etc.
            deviceItem.innerHTML = `
                <div class="device-item-info">
                    <div class="device-item-name">
                        <i class="fa-solid fa-mobile-screen device-icon"></i> ${deviceName}
                    </div>
                    <div class="device-item-status ${isLocked ? 'device-offline' : 'device-online'}">
                        ${isLocked ? 'SYSTEM LOCKED' : 'LINK OPERATIONAL'}
                    </div>
                </div>
            `;

            deviceItem.addEventListener("click", () => handleDeviceSelection(uid, deviceName));
            if (devicesList) devicesList.appendChild(deviceItem);
        });
    });
}

if (btnRefreshDevices) {
    btnRefreshDevices.addEventListener("click", () => {
        initializeDevicesSidebar();
    });
}

// ==========================================================================
// 3. SELECTION ROUTING MANAGER
// ==========================================================================
function handleDeviceSelection(uid, name) {
    if (activeDeviceUid === uid) return; 

    document.querySelectorAll(".device-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-uid") === uid);
    });

    if (activeStatusRef) off(activeStatusRef);
    if (activeCommandsRef) off(activeCommandsRef);

    if (noDeviceAlert) noDeviceAlert.style.display = "none";
    if (deviceDashboard) deviceDashboard.style.display = "block";
    if (selectedDeviceName) selectedDeviceName.innerText = name.toUpperCase();

    activeDeviceUid = uid;

    initializeTelemetryStream(uid);
    initializeCommandStateListeners(uid);
}

// ==========================================================================
// 4. REAL-TIME TELEMETRY STREAM SYNCHRONIZATION
// ==========================================================================
function initializeTelemetryStream(uid) {
    activeStatusRef = ref(database, `devices/${uid}/status`);

    onValue(activeStatusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            resetTelemetryUI();
            return;
        }

        // Handle Battery Visual progress bars cleanly
        if (batteryText) batteryText.innerText = data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
        if (batteryBar) {
            const currentPct = data.batteryPercentage || 0;
            // Inject inner fill block if it doesn't exist, matching your .battery-bar-fill selector
            batteryBar.innerHTML = `<div class="battery-bar-fill" style="width: ${currentPct}%;"></div>`;
        }

        if (networkText) networkText.innerText = data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";

        if (lastSeenText) {
            if (data.lastSeenTimestamp) {
                const dateObj = new Date(data.lastSeenTimestamp);
                lastSeenText.innerText = isNaN(dateObj.getTime()) ? data.lastSeenTimestamp : dateObj.toLocaleTimeString();
            } else {
                lastSeenText.innerText = new Date().toLocaleTimeString();
            }
        }

        if (latitudeText && longitudeText) {
            if (data.latitude !== undefined && data.longitude !== undefined && data.latitude !== null && data.longitude !== null) {
                const latNum = parseFloat(data.latitude);
                const lngNum = parseFloat(data.longitude);

                if (!isNaN(latNum) && !isNaN(lngNum)) {
                    latitudeText.innerText = latNum.toFixed(5);
                    longitudeText.innerText = lngNum.toFixed(5);
                    
                    if (mapLink) {
                        mapLink.href = `https://www.google.com/maps?q=${latNum},${lngNum}`;
                        mapLink.classList.remove("disabled");
                        mapLink.style.pointerEvents = "auto";
                        mapLink.style.opacity = "1";
                    }
                } else {
                    latitudeText.innerText = "ERR";
                    longitudeText.innerText = "ERR";
                    disableMapLink();
                }
            } else {
                latitudeText.innerText = "--";
                longitudeText.innerText = "--";
                disableMapLink();
            }
        }

        if (deviceStateText) {
            if (data.isDeviceLocked) {
                deviceStateText.innerText = "EMERGENCY LOCK";
                deviceStateText.className = "metric-value status-offline";
            } else {
                deviceStateText.innerText = "SECURE";
                deviceStateText.className = "metric-value status-secure";
            }
        }

        const imageElement = document.getElementById('cameraPreviewFrame');
        const placeholderText = document.getElementById('cameraPlaceholderText');
        const timestampElement = document.getElementById('captureTimestamp');
        
        if (imageElement && placeholderText) {
            if (data.lastPhotoUrl && data.lastPhotoUrl.trim() !== "") {
                placeholderText.style.display = "none";
                imageElement.style.display = "block";
                imageElement.src = data.lastPhotoUrl;
                
                if (timestampElement) {
                    timestampElement.innerText = `LAST UPDATED: TODAY AT ${new Date().toLocaleTimeString()}`;
                }
            } else {
                imageElement.style.display = "none";
                placeholderText.style.display = "block";
            }
        }
    });
}

function disableMapLink() {
    if (mapLink) {
        mapLink.classList.add("disabled");
        mapLink.removeAttribute("href");
        mapLink.style.pointerEvents = "none";
        mapLink.style.opacity = "0.5";
    }
}

function resetTelemetryUI() {
    if (batteryText) batteryText.innerText = "--%";
    if (batteryBar) batteryBar.innerHTML = "";
    if (networkText) networkText.innerText = "UNKNOWN";
    if (latitudeText) latitudeText.innerText = "--";
    if (longitudeText) longitudeText.innerText = "--";
    disableMapLink();
}

// ==========================================================================
// 5. EXECUTIVE COMMAND PROPS (Aliged with .matrix-btn.active & .toggle-btn)
// ==========================================================================
function initializeCommandStateListeners(uid) {
    activeCommandsRef = ref(database, `devices/${uid}/commands`);

    onValue(activeCommandsRef, (snapshot) => {
        const commands = snapshot.val() || {};

        // Syncs visual state directly using your .active class selector rule
        updateMatrixButtonState(cmdFlashlight, commands.flashlight);
        updateMatrixButtonState(cmdAlarm, commands.alarm);
        updateMatrixButtonState(cmdLock, commands.emergencyLock);
        
        if (cmdCapture) {
            if (commands.cameraCapture) {
                cmdCapture.classList.add("active");
            } else {
                cmdCapture.classList.remove("active");
            }
        }
    });
}

function updateMatrixButtonState(buttonElement, isActive) {
    if (!buttonElement) return;
    const toggleIndicator = buttonElement.querySelector(".toggle-state");
    
    if (isActive) {
        buttonElement.classList.add("active"); // Matches your .matrix-btn.active CSS target rule
        if (toggleIndicator) toggleIndicator.innerText = "ON";
    } else {
        buttonElement.classList.remove("active");
        if (toggleIndicator) toggleIndicator.innerText = "OFF";
    }
}

if (cmdFlashlight) {
    cmdFlashlight.addEventListener("click", () => {
        const isCurrentlyActive = cmdFlashlight.classList.contains("active");
        sendRemoteCommand("flashlight", !isCurrentlyActive);
    });
}

if (cmdAlarm) {
    cmdAlarm.addEventListener("click", () => {
        const isCurrentlyActive = cmdAlarm.classList.contains("active");
        sendRemoteCommand("alarm", !isCurrentlyActive);
    });
}

if (cmdLock) {
    cmdLock.addEventListener("click", () => {
        const isCurrentlyActive = cmdLock.classList.contains("active");
        const messagePrompt = isCurrentlyActive 
            ? "Deactivate Emergency Lockdown protocol?" 
            : "Initialize Emergency Device Lockdown protocol?";
            
        if (confirm(messagePrompt)) {
            const targetState = !isCurrentlyActive;
            const updates = {};
            updates[`devices/${activeDeviceUid}/commands/emergencyLock`] = targetState;
            updates[`devices/${activeDeviceUid}/status/isDeviceLocked`] = targetState;
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
            placeholderText.style.display = "block";
        }
        sendRemoteCommand("cameraCapture", true);
    });
}

function sendRemoteCommand(commandName, targetValue) {
    if (!activeDeviceUid) return; 
    
    const targetFolderRef = ref(database, `devices/${activeDeviceUid}/commands`);
    const dynamicCommandPayload = {};
    dynamicCommandPayload[commandName] = targetValue;
    
    update(targetFolderRef, dynamicCommandPayload).catch((error) => {
        console.error(`Command transmission failure [${commandName}]:`, error);
    });
}
