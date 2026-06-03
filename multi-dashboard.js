import { auth, database } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ========================================================================
// DOM ELEMENTS - SIDEBAR
// ========================================================================
const devicesList = document.getElementById("devices-list");
const deviceCount = document.getElementById("device-count");
const refreshDevicesBtn = document.getElementById("btn-refresh-devices");
const noDeviceAlert = document.getElementById("no-device-alert");
const deviceDashboard = document.getElementById("device-dashboard");

// ========================================================================
// DOM ELEMENTS - MAIN DASHBOARD
// ========================================================================
const selectedDeviceName = document.getElementById("selected-device-name");
const deviceOnlineStatus = document.getElementById("device-online-status");

// Telemetry Display Nodes
const batteryText = document.getElementById("battery-text");
const networkText = document.getElementById("network-text");
const deviceStateText = document.getElementById("device-state-text");
const lastSeenText = document.getElementById("last-seen-text");
const latitudeText = document.getElementById("latitude-text");
const longitudeText = document.getElementById("longitude-text");
const gpsText = document.getElementById("gps-text");
const mapLink = document.getElementById("map-link");

// Remote Command Buttons
const cmdFlashlight = document.getElementById("cmd-flashlight");
const cmdAlarm = document.getElementById("cmd-alarm");
const cmdLock = document.getElementById("cmd-lock");
const cmdCapture = document.getElementById("cmd-capture");

// Camera Monitor
const cameraPreviewFrame = document.getElementById("cameraPreviewFrame");
const cameraPlaceholderText = document.getElementById("cameraPlaceholderText");
const captureTimestamp = document.getElementById("captureTimestamp");

// Header
const btnLogout = document.getElementById("btn-logout");
const connectionStatus = document.getElementById("connection-status");

// ========================================================================
// GLOBAL VARIABLES
// ========================================================================
const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com";

let currentUserUid = null;
let selectedDevice = null;
let allDevices = [];
let deviceListeners = {};
let lastSeenTimestamps = {};

// ========================================================================
// 1. SESSION SECURE PROTECTIONS
// ========================================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email && user.email.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
            currentUserUid = user.uid;
            console.log("✅ Secure terminal linked. Operator UID:", currentUserUid);
            
            // Initialize multi-device dashboard
            loadAllDevices();
        } else {
            console.warn("❌ Unauthorized operator profile rejected.");
            alert("Access Denied: This profile is unauthorized to issue command responses.");
            
            signOut(auth).then(() => {
                window.location.href = "./index.html";
            });
        }
    } else {
        console.warn("❌ Unauthorized access detected. Rerouting...");
        window.location.href = "./index.html";
    }
});

// Logout Operator System
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth)
            .then(() => {
                window.location.href = "./index.html";
            })
            .catch((error) => console.error("❌ Disconnect failure:", error));
    });
}

// ========================================================================
// 2. LOAD ALL DEVICES FROM DATABASE
// ========================================================================

function loadAllDevices() {
    try {
        console.log("🔍 Loading all connected devices...");
        const devicesRef = ref(database, "devices");
        
        onValue(devicesRef, (snapshot) => {
            allDevices = [];
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Iterate through all device UIDs
                Object.keys(data).forEach((deviceUid) => {
                    const deviceData = data[deviceUid];
                    
                    allDevices.push({
                        uid: deviceUid,
                        name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                        status: deviceData.status || {},
                        commands: deviceData.commands || {},
                        battery: deviceData.status?.batteryPercentage || 0,
                        lastSeen: deviceData.status?.lastSeen || 0,
                        location: deviceData.status || {},
                        online: isDeviceOnline(deviceData.status?.lastSeen)
                    });
                });
                
                console.log(`✅ Loaded ${allDevices.length} device(s)`);
                renderDevicesList();
                
                // Auto-select first device if none selected
                if (allDevices.length > 0 && !selectedDevice) {
                    selectDevice(allDevices[0].uid);
                }
            } else {
                console.warn("⚠️ No devices found in database");
                renderDevicesList();
                showNoDeviceAlert();
            }
        });
    } catch (error) {
        console.error("❌ Error loading devices:", error);
    }
}

// ========================================================================
// 3. RENDER DEVICES LIST IN SIDEBAR
// ========================================================================

function renderDevicesList() {
    devicesList.innerHTML = "";
    deviceCount.textContent = allDevices.length;
    
    allDevices.forEach((device) => {
        const deviceItem = document.createElement("div");
        deviceItem.className = `device-item ${selectedDevice === device.uid ? "active" : ""}`;
        
        const statusClass = device.online ? "device-online" : "device-offline";
        const statusIcon = device.online ? "fa-circle-check" : "fa-circle-xmark";
        const statusText = device.online ? "ONLINE" : "OFFLINE";
        
        deviceItem.innerHTML = `
            <div class="device-item-info">
                <div class="device-item-name">
                    <i class="fa-solid fa-mobile-screen-button device-icon"></i>
                    ${device.name}
                </div>
                <div class="device-item-status ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i>
                    ${statusText} • Battery: ${device.battery}%
                </div>
            </div>
        `;
        
        deviceItem.addEventListener("click", () => selectDevice(device.uid));
        devicesList.appendChild(deviceItem);
    });
}

// ========================================================================
// 4. SELECT DEVICE AND LOAD ITS DATA
// ========================================================================

function selectDevice(deviceUid) {
    selectedDevice = deviceUid;
    console.log("📱 Selected device:", deviceUid);
    
    // Update sidebar highlight
    renderDevicesList();
    
    // Show dashboard
    noDeviceAlert.style.display = "none";
    deviceDashboard.style.display = "block";
    
    // Remove old listeners
    Object.keys(deviceListeners).forEach((key) => {
        // Note: Firebase SDK doesn't provide direct way to unsubscribe from onValue
        // This is a limitation, but new subscriptions will override old ones
    });
    deviceListeners = {};
    
    // Load device data
    loadDeviceData(deviceUid);
    initializeTelemetryStream(deviceUid);
    initializeCommandStateListeners(deviceUid);
    setupCommandClickListeners(deviceUid);
}

// ========================================================================
// 5. LOAD DEVICE DATA HEADER
// ========================================================================

function loadDeviceData(deviceUid) {
    const device = allDevices.find((d) => d.uid === deviceUid);
    
    if (!device) return;
    
    console.log("📊 Loading data for device:", device.name);
    
    // Update header
    selectedDeviceName.textContent = device.name;
    const statusIndicator = device.online ? "ONLINE" : "OFFLINE";
    const statusColor = device.online ? "#00FF88" : "#FFA000";
    deviceOnlineStatus.innerHTML = `<span class="pulse-dot-small"></span> ${statusIndicator}`;
    deviceOnlineStatus.style.color = statusColor;
}

// ========================================================================
// 6. REAL-TIME TELEMETRY STREAM (Device Status -> Dashboard)
// ========================================================================

function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);
    
    onValue(statusRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            console.log("⏳ No telemetry received yet. Device pending connection...");
            if (batteryText) batteryText.innerText = "--%";
            if (networkText) networkText.innerText = "UNKNOWN";
            return;
        }
        
        // Battery Level
        if (batteryText) {
            batteryText.innerText = data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
            
            // Update battery bar
            const batteryBar = document.getElementById("battery-bar");
            if (batteryBar) {
                const percentage = data.batteryPercentage || 0;
                batteryBar.innerHTML = `<div class="battery-bar-fill" style="width: ${percentage}%"></div>`;
            }
        }
        
        // Network Type
        if (networkText) {
            networkText.innerText = data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";
        }
        
        // Last Seen
        if (lastSeenText) {
            const lastSeenTime = data.lastSeen ? formatTime(data.lastSeen) : "--:--";
            lastSeenText.innerText = lastSeenTime;
            lastSeenTimestamps[uid] = data.lastSeen;
        }
        
        // GPS Coordinates
        if (data.latitude !== undefined && data.longitude !== undefined && 
            data.latitude !== null && data.longitude !== null) {
            
            const latNum = parseFloat(data.latitude);
            const lngNum = parseFloat(data.longitude);
            
            if (!isNaN(latNum) && !isNaN(lngNum)) {
                // Update separate fields
                if (latitudeText) latitudeText.innerText = latNum.toFixed(6);
                if (longitudeText) longitudeText.innerText = lngNum.toFixed(6);
                
                // Update combined GPS field
                if (gpsText) gpsText.innerText = `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
                
                // Update map link
                if (mapLink) {
                    mapLink.href = `https://www.google.com/maps?q=${latNum},${lngNum}`;
                    mapLink.classList.remove("disabled");
                }
            } else {
                if (gpsText) gpsText.innerText = "Telemetry Format Error";
                if (mapLink) mapLink.classList.add("disabled");
            }
        } else {
            if (gpsText) gpsText.innerText = "Waiting for coordinates...";
            if (latitudeText) latitudeText.innerText = "--";
            if (longitudeText) longitudeText.innerText = "--";
            if (mapLink) {
                mapLink.classList.add("disabled");
                mapLink.removeAttribute("href");
            }
        }
        
        // Device Lock State
        if (deviceStateText) {
            if (data.isDeviceLocked) {
                deviceStateText.innerText = "🔒 LOCKED";
                deviceStateText.className = "metric-value status-locked";
                deviceStateText.style.color = "#FF1744";
                deviceStateText.style.textShadow = "0 0 8px rgba(255, 23, 68, 0.5)";
            } else {
                deviceStateText.innerText = "✅ SECURE";
                deviceStateText.className = "metric-value status-secure";
                deviceStateText.style.color = "#00FF88";
                deviceStateText.style.textShadow = "0 0 8px rgba(0, 255, 136, 0.5)";
            }
        }
        
        // Camera Image Stream
        if (cameraPreviewFrame && cameraPlaceholderText) {
            if (data.lastPhotoUrl && data.lastPhotoUrl.trim() !== "") {
                cameraPlaceholderText.style.display = "none";
                cameraPreviewFrame.style.display = "block";
                cameraPreviewFrame.src = data.lastPhotoUrl;
                
                if (captureTimestamp) {
                    const currentTime = new Date().toLocaleTimeString();
                    captureTimestamp.innerText = `LAST UPDATED: ${currentTime}`;
                }
            } else {
                cameraPreviewFrame.style.display = "none";
                cameraPlaceholderText.style.display = "flex";
            }
        }
    });
    
    deviceListeners[`telemetry-${uid}`] = statusRef;
}

// ========================================================================
// 7. COMMAND STATE LISTENERS (Reflect device state on buttons)
// ========================================================================

function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    
    onValue(commandsRef, (snapshot) => {
        const commands = snapshot.val() || {};
        
        // Update button visual states
        toggleButtonVisualState(cmdFlashlight, commands.flashlight);
        toggleButtonVisualState(cmdAlarm, commands.alarm);
        toggleButtonVisualState(cmdLock, commands.emergencyLock);
        
        // Camera capture button
        if (cmdCapture) {
            const label = cmdCapture.querySelector("span");
            if (commands.cameraCapture) {
                cmdCapture.classList.add("active-state");
                if (label) label.innerText = "CAPTURING...";
            } else {
                cmdCapture.classList.remove("active-state");
                if (label) label.innerText = "CAMERA CAPTURE";
            }
        }
    });
    
    deviceListeners[`commands-${uid}`] = commandsRef;
}

function toggleButtonVisualState(buttonElement, isActive) {
    if (buttonElement) {
        if (isActive) {
            buttonElement.classList.add("active-state");
            const stateSpan = buttonElement.querySelector(".toggle-state");
            if (stateSpan) stateSpan.innerText = "ON";
        } else {
            buttonElement.classList.remove("active-state");
            const stateSpan = buttonElement.querySelector(".toggle-state");
            if (stateSpan) stateSpan.innerText = "OFF";
        }
    }
}

// ========================================================================
// 8. COMMAND CLICK EVENT LISTENERS
// ========================================================================

function setupCommandClickListeners(deviceUid) {
    if (cmdFlashlight) {
        cmdFlashlight.onclick = () => {
            const isActive = cmdFlashlight.classList.contains("active-state");
            sendRemoteCommand(deviceUid, "flashlight", !isActive);
        };
    }
    
    if (cmdAlarm) {
        cmdAlarm.onclick = () => {
            const isActive = cmdAlarm.classList.contains("active-state");
            sendRemoteCommand(deviceUid, "alarm", !isActive);
        };
    }
    
    if (cmdLock) {
        cmdLock.onclick = () => {
            const isActive = cmdLock.classList.contains("active-state");
            const confirmLock = confirm(
                isActive 
                    ? "Deactivate Emergency Lockdown protocol?" 
                    : "Initialize Emergency Device Lockdown protocol?"
            );
            
            if (confirmLock) {
                const targetState = !isActive;
                const updates = {};
                updates[`devices/${deviceUid}/commands/emergencyLock`] = targetState;
                updates[`devices/${deviceUid}/status/isDeviceLocked`] = targetState;
                update(ref(database), updates);
            }
        };
    }
    
    if (cmdCapture) {
        cmdCapture.onclick = () => {
            // Show loading state
            if (cameraPreviewFrame && cameraPlaceholderText) {
                cameraPreviewFrame.style.display = "none";
                cameraPlaceholderText.style.display = "flex";
            }
            
            sendRemoteCommand(deviceUid, "cameraCapture", true);
        };
    }
}

// ========================================================================
// 9. SEND REMOTE COMMANDS TO DEVICE
// ========================================================================

function sendRemoteCommand(deviceUid, commandName, targetValue) {
    if (!deviceUid) {
        console.error("❌ No device selected");
        return;
    }
    
    const commandRef = ref(database, `devices/${deviceUid}/commands/${commandName}`);
    
    console.log(`📤 Uplinking command [${commandName}] to device ${deviceUid}:`, targetValue);
    
    update(commandRef, targetValue)
        .then(() => {
            console.log(`✅ Command [${commandName}] synced successfully`);
        })
        .catch((error) => {
            console.error(`❌ Command execution fault [${commandName}]:`, error);
        });
}

// ========================================================================
// 10. REFRESH DEVICES BUTTON
// ========================================================================

if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener("click", () => {
        console.log("🔄 Refreshing devices list...");
        loadAllDevices();
    });
}

// ========================================================================
// 11. UTILITY FUNCTIONS
// ========================================================================

function formatTime(timestamp) {
    if (!timestamp) return "--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}

function isDeviceOnline(lastSeen) {
    if (!lastSeen) return false;
    const now = Date.now();
    const timeDiff = now - lastSeen;
    return timeDiff < 60000; // Online if last seen within 1 minute
}

function showNoDeviceAlert() {
    noDeviceAlert.style.display = "flex";
    deviceDashboard.style.display = "none";
}

// ========================================================================
// 12. EXPORT FOR DEBUGGING
// ========================================================================

window.GuardianDashboard = {
    selectedDevice,
    allDevices,
    currentUserUid,
    loadAllDevices,
    selectDevice,
    sendRemoteCommand
};

console.log("✅ Multi-Device Dashboard initialized successfully");
