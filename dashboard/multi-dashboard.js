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
const deviceOnlineStatus = document.getElementById("device-online-status");

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
let activeDeviceUid = null; // Dynamically tracks current selected device tracking folder

// Active Firebase Database reference pointers kept for state tracking teardown
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
            
            // Build out global sidebar directory list mapping
            initializeDevicesSidebar();
        } else {
            console.warn("Unauthorized operator profile rejected. Intercepting...");
            alert("Access Denied: This profile is unauthorized to issue command responses.");
            secureSignOut();
        }
    } else {
        console.warn("Unauthorized access detected. Intercepting and rerouting...");
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
// 2. SIDEBAR MULTI-DEVICE DIRECTORY CONSTRUCTOR
// ==========================================================================
function initializeDevicesSidebar() {
    const devicesRootRef = ref(database, "devices");

    onValue(devicesRootRef, (snapshot) => {
        const devicesData = snapshot.val() || {};
        if (devicesList) devicesList.innerHTML = ""; // Wipe elements before repaint
        
        const deviceKeys = Object.keys(devicesData);
        if (deviceCountBadge) deviceCountBadge.innerText = deviceKeys.length;

        if (deviceKeys.length === 0) {
            if (devicesList) {
                devicesList.innerHTML = `<div class="no-devices-msg" style="padding:15px; color:#8a99ad; font-family:'Rajdhani';">No devices responding...</div>`;
            }
            return;
        }

        deviceKeys.forEach((uid) => {
            const device = devicesData[uid];
            const deviceName = device.name || device.status?.deviceName || `TERMINAL [${uid.substring(0, 5)}]`;
            const isLocked = device.status?.isDeviceLocked || false;
            
            // Generate sidebar navigation action item
            const deviceItem = document.createElement("div");
            deviceItem.className = `device-item ${uid === activeDeviceUid ? "active" : ""}`;
            deviceItem.setAttribute("data-uid", uid);
            
            deviceItem.innerHTML = `
                <div class="device-info">
                    <span class="device-title"><i class="fa-solid fa-mobile-screen"></i> ${deviceName}</span>
                    <span class="device-subtext">${uid.substring(0, 12)}...</span>
                </div>
                <span class="badge ${isLocked ? "alert" : "secure"}">${isLocked ? "LOCKED" : "OK"}</span>
            `;

            deviceItem.addEventListener("click", () => handleDeviceSelection(uid, deviceName));
            if (devicesList) devicesList.appendChild(deviceItem);
        });
    });
}

if (btnRefreshDevices) {
    btnRefreshDevices.addEventListener("click", () => {
        initializeDevicesSidebar();
        console.log("Device interface structure updated from server.");
    });
}

// ==========================================================================
// 3. SELECTION ROUTING MANAGER (Teardown & Setup Streams)
// ==========================================================================
function handleDeviceSelection(uid, name) {
    if (activeDeviceUid === uid) return; // Prevent duplicate instantiation loops

    // Highlighting current active item inside sidebar
    document.querySelectorAll(".device-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-uid") === uid);
    });

    // Clean up older real-time streams to prevent memory leaks and UI updates clashing
    if (activeStatusRef) off(activeStatusRef);
    if (activeCommandsRef) off(activeCommandsRef);

    // Swap structural CSS displays to present metrics interface
    if (noDeviceAlert) noDeviceAlert.style.display = "none";
    if (deviceDashboard) deviceDashboard.style.display = "block";
    if (selectedDeviceName) selectedDeviceName.innerText = name.toUpperCase();

    activeDeviceUid = uid;

    // Fire up fresh operational pipelines linked to the selected device node
    initializeTelemetryStream(uid);
    initializeCommandStateListeners(uid);
}

// ==========================================================================
// 4. REAL-TIME TELEMETRY TELEMETRY LOOP (Device -> Dashboard)
// ==========================================================================
function initializeTelemetryStream(uid) {
    activeStatusRef = ref(database, `devices/${uid}/status`);

    onValue(activeStatusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            resetTelemetryUI();
            return;
        }

        // Handle Battery Visuals & Width Fill percentages
        if (batteryText) batteryText.innerText = data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
        if (batteryBar) {
            const currentPct = data.batteryPercentage || 0;
            batteryBar.style.width = `${currentPct}%`;
            batteryBar.style.backgroundColor = currentPct < 20 ? "#ff0055" : currentPct < 50 ? "#ffaa00" : "#00E5FF";
        }

        // Update Network details
        if (networkText) networkText.innerText = data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";

        // Update Time Matrix Stamps
        if (lastSeenText) {
            if (data.lastSeenTimestamp) {
                const dateObj = new Date(data.lastSeenTimestamp);
                lastSeenText.innerText = isNaN(dateObj.getTime()) ? data.lastSeenTimestamp : dateObj.toLocaleTimeString();
            } else {
                lastSeenText.innerText = new Date().toLocaleTimeString();
            }
        }

        // Process Latitude and Longitude Coordinates safely
        if (latitudeText && longitudeText) {
            if (data.latitude !== undefined && data.longitude !== undefined && data.latitude !== null && data.longitude !== null) {
                const latNum = parseFloat(data.latitude);
                const lngNum = parseFloat(data.longitude);

                if (!isNaN(latNum) && !isNaN(lngNum)) {
                    latitudeText.innerText = latNum.toFixed(5);
                    longitudeText.innerText = lngNum.toFixed(5);
                    
                    if (mapLink) {
                        // FIXED: Correct formatting for standard web maps link protocols
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

        // Handle Global Device Lock states
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

        // Image Monitor Pipeline Stream Handler
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
        mapLink.style.opacity = "0.4";
    }
}

function resetTelemetryUI() {
    if (batteryText) batteryText.innerText = "--%";
    if (batteryBar) batteryBar.style.width = "0%";
    if (networkText) networkText.innerText = "UNKNOWN";
    if (latitudeText) latitudeText.innerText = "--";
    if (longitudeText) longitudeText.innerText = "--";
    disableMapLink();
}

// ==========================================================================
// 5. EXECUTIVE COMMAND PROPS (Dashboard Matrix -> Device UI Status)
// ==========================================================================
function initializeCommandStateListeners(uid) {
    activeCommandsRef = ref(database, `devices/${uid}/commands`);

    onValue(activeCommandsRef, (snapshot) => {
        const commands = snapshot.val() || {};

        // Sync local interface state visual markers with server definitions
        updateMatrixButtonState(cmdFlashlight, commands.flashlight);
        updateMatrixButtonState(cmdAlarm, commands.alarm);
        updateMatrixButtonState(cmdLock, commands.emergencyLock);
        
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

function updateMatrixButtonState(buttonElement, isActive) {
    if (!buttonElement) return;
    const toggleIndicator = buttonElement.querySelector(".toggle-state");
    
    if (isActive) {
        buttonElement.classList.add("active-state");
        if (toggleIndicator) toggleIndicator.innerText = "ON";
    } else {
        buttonElement.classList.remove("active-state");
        if (toggle
