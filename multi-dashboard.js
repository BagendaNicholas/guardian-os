import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, off, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getStorage as getStorageInstance } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

// ==========================================
// Firebase Configuration
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBhaPM20tIhMalxLjoCklmwy4qb1ZkraSo",
    authDomain: "guardianos-30b18.firebaseapp.com",
    projectId: "guardianos-30b18",
    storageBucket: "guardianos-30b18.appspot.com",
    messagingSenderId: "323558398331",
    appId: "1:323558398331:android:a022a1e38b48a0247705de",
    databaseURL: "https://guardianos-30b18-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorageInstance(app);

// ==========================================
// Global Variables
// ==========================================
let currentUser = null;
let selectedDevice = null;
let allDevices = [];
let deviceListeners = {};

const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com";

// ==========================================
// DOM Elements
// ==========================================
const noDeviceAlert = document.getElementById('no-device-alert');
const deviceDashboard = document.getElementById('device-dashboard');
const devicesList = document.getElementById('devices-list');
const deviceCount = document.getElementById('device-count');
const logoutBtn = document.getElementById('btn-logout');
const refreshDevicesBtn = document.getElementById('btn-refresh-devices');

// ==========================================
// INITIALIZATION
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user && user.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
        currentUser = user;
        console.log("👤 Operator logged in:", user.email);
        loadAllDevices();
    } else {
        console.log("⛔ Access denied - not authorized operator");
        window.location.href = './index.html';
    }
});

// ==========================================
// LOAD DEVICES FROM /devices STRUCTURE
// ==========================================
function loadAllDevices() {
    console.log("📱 Loading devices...");
    
    const devicesRef = ref(database, 'devices');
    onValue(devicesRef, (snapshot) => {
        allDevices = [];
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log("✓ Found devices:", Object.keys(data).length);
            
            Object.keys(data).forEach(deviceUid => {
                const deviceData = data[deviceUid];
                allDevices.push({
                    uid: deviceUid,
                    name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                    battery: deviceData.battery_level || deviceData.status?.batteryPercentage || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 60000
                });
            });
            
            console.log("📊 Total devices loaded:", allDevices.length);
            renderDevicesList();
            
            if (allDevices.length > 0 && !selectedDevice) {
                selectDevice(allDevices[0].uid);
            }
        } else {
            console.log("⚠️ No devices found");
            showNoDeviceAlert();
        }
    }, (error) => {
        console.error("❌ Error loading devices:", error);
        showNoDeviceAlert();
    });
}

// ==========================================
// RENDER DEVICES LIST
// ==========================================
function renderDevicesList() {
    devicesList.innerHTML = '';
    deviceCount.textContent = allDevices.length;
    
    allDevices.forEach(device => {
        const deviceItem = document.createElement('div');
        deviceItem.className = `device-item ${selectedDevice === device.uid ? 'active' : ''}`;
        deviceItem.innerHTML = `
            <div class="device-item-info">
                <div class="device-item-name">${device.name}</div>
                <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                    ${device.online ? 'ONLINE' : 'OFFLINE'} • ${device.battery}%
                </div>
            </div>`;
        
        deviceItem.addEventListener('click', () => selectDevice(device.uid));
        devicesList.appendChild(deviceItem);
    });
    
    // Show/hide alert based on device count
    if (allDevices.length === 0) {
        showNoDeviceAlert();
    } else {
        noDeviceAlert.style.display = 'none';
        deviceDashboard.style.display = 'block';
    }
}

// ==========================================
// SELECT DEVICE
// ==========================================
function selectDevice(deviceUid) {
    console.log("🔄 Selecting device:", deviceUid);
    
    // Reset UI to prevent flickering
    document.getElementById('battery-text').textContent = '--%';
    document.getElementById('cameraPreviewFrame').style.display = 'none';
    document.getElementById('cameraPlaceholderText').style.display = 'block';
    
    selectedDevice = deviceUid;
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    // Clean up old listeners
    Object.keys(deviceListeners).forEach(key => {
        off(deviceListeners[key]);
    });
    deviceListeners = {};
    
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

// ==========================================
// LOAD DEVICE DATA
// ==========================================
function loadDeviceData(deviceUid) {
    const device = allDevices.find(d => d.uid === deviceUid);
    if (!device) return;
    
    document.getElementById('selected-device-name').textContent = device.name;
    initializeTelemetryStream(deviceUid);
    initializeCommandStateListeners(deviceUid);
}

// ==========================================
// REAL-TIME DATA STREAM SYNCHRONIZATION
// ==========================================
function initializeTelemetryStream(uid) {
    console.log("📊 Initializing telemetry stream for:", uid);
    
    const statusRef = ref(database, `devices/${uid}/status`);
    const listener = onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ Status data not found for device");
            return;
        }

        const data = snapshot.val();
        console.log("📈 Status data received");

        // Battery Level
        if (document.getElementById('battery-text')) {
            document.getElementById('battery-text').textContent = 
                data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
        }

        // Network Type
        if (document.getElementById('network-text')) {
            document.getElementById('network-text').textContent = 
                data.networkType ? data.networkType.toUpperCase() : "UNKNOWN";
        }

        // GPS Coordinates
        if (document.getElementById('latitude-text') && data.latitude != null && data.longitude != null) {
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            
            document.getElementById('latitude-text').textContent = lat.toFixed(6) || '--';
            document.getElementById('longitude-text').textContent = lng.toFixed(6) || '--';
            
            const mapLink = document.getElementById('map-link');
            if (mapLink) {
                mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            }
        }

        // Device State (Lock Status)
        if (document.getElementById('device-state-text')) {
            const stateEl = document.getElementById('device-state-text');
            stateEl.textContent = data.isDeviceLocked ? "EMERGENCY LOCK" : "SECURE";
            stateEl.className = data.isDeviceLocked ? "metric-value alert-text" : "metric-value status-secure";
        }

        // Camera Image (from status.lastPhotoUrl)
        if (data.lastPhotoUrl) {
            const img = document.getElementById('cameraPreviewFrame');
            const placeholder = document.getElementById('cameraPlaceholderText');
            
            if (img && placeholder) {
                placeholder.style.display = "none";
                img.style.display = "block";
                img.src = data.lastPhotoUrl;
                
                const timestampEl = document.getElementById('captureTimestamp');
                if (timestampEl) {
                    timestampEl.textContent = `LAST UPDATED: ${new Date().toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit', 
                        hour12: false 
                    })}`;
                }
                
                console.log("✓ Camera image updated");
            }
        }
    }, (error) => {
        console.error("❌ Error loading status data:", error);
    });

    deviceListeners[`status-${uid}`] = listener;
}

// ==========================================
// COMMAND STATE LISTENERS
// ==========================================
function initializeCommandStateListeners(uid) {
    console.log("🎮 Setting up command listeners for:", uid);
    
    const commandsRef = ref(database, `devices/${uid}/commands`);
    const listener = onValue(commandsRef, (snapshot) => {
        const cmd = snapshot.val() || {};
        
        toggleButtonVisualState('cmd-flashlight', cmd.flashlight);
        toggleButtonVisualState('cmd-alarm', cmd.alarm);
        toggleButtonVisualState('cmd-lock', cmd.emergencyLock);
        
        const captureBtn = document.getElementById('cmd-capture');
        if (captureBtn) {
            captureBtn.classList.toggle('active', !!cmd.cameraCapture);
            const label = captureBtn.querySelector('span');
            if (label) {
                label.textContent = cmd.cameraCapture ? "CAPTURING..." : "CAMERA CAPTURE";
            }
        }
    }, (error) => {
        console.error("❌ Error loading commands:", error);
    });

    deviceListeners[`commands-${uid}`] = listener;
}

// ==========================================
// TOGGLE BUTTON VISUAL STATE
// ==========================================
function toggleButtonVisualState(btnId, active) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.toggle('active', !!active);
        const stateEl = btn.querySelector('.toggle-state');
        if (stateEl) {
            stateEl.textContent = active ? (
                btnId === 'cmd-lock' ? 'LOCKED' : 'ON'
            ) : (
                btnId === 'cmd-lock' ? 'UNLOCKED' : 'OFF'
            );
        }
    }
}

// ==========================================
// SETUP COMMAND EVENT LISTENERS
// ==========================================
function setupCommandListeners(deviceUid) {
    console.log("🎯 Binding command event listeners for:", deviceUid);
    
    // Flashlight Command
    const flashBtn = document.getElementById('cmd-flashlight');
    if (flashBtn) {
        flashBtn.onclick = () => {
            const newState = !flashBtn.classList.contains('active');
            sendRemoteCommand(deviceUid, 'flashlight', newState);
        };
    }
    
    // Alarm Command
    const alarmBtn = document.getElementById('cmd-alarm');
    if (alarmBtn) {
        alarmBtn.onclick = () => {
            const newState = !alarmBtn.classList.contains('active');
            sendRemoteCommand(deviceUid, 'alarm', newState);
        };
    }
    
    // Emergency Lock Command
    const lockBtn = document.getElementById('cmd-lock');
    if (lockBtn) {
        lockBtn.onclick = () => {
            const newState = !lockBtn.classList.contains('active');
            if (confirm(newState ? "Initialize Lockdown?" : "Deactivate Lockdown?")) {
                const updates = {};
                updates[`devices/${deviceUid}/commands/emergencyLock`] = newState;
                updates[`devices/${deviceUid}/status/isDeviceLocked`] = newState;
                update(ref(database), updates);
                console.log("🔒 Lock command sent");
            }
        };
    }
    
    // Camera Capture Command
    const captureBtn = document.getElementById('cmd-capture');
    if (captureBtn) {
        captureBtn.onclick = () => {
            sendRemoteCommand(deviceUid, 'cameraCapture', true);
        };
    }
}

// ==========================================
// SEND REMOTE COMMAND
// ==========================================
function sendRemoteCommand(deviceUid, commandName, value) {
    try {
        const payload = {};
        payload[commandName] = value;
        update(ref(database, `devices/${deviceUid}/commands`), payload);
        console.log(`✓ Sent command: ${commandName} = ${value}`);
    } catch (error) {
        console.error(`❌ Error sending command ${commandName}:`, error);
    }
}

// ==========================================
// SHOW NO DEVICE ALERT
// ==========================================
function showNoDeviceAlert() {
    noDeviceAlert.style.display = 'flex';
    deviceDashboard.style.display = 'none';
}

// ==========================================
// EVENT LISTENERS
// ==========================================
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = './index.html';
        }).catch(error => {
            console.error("❌ Logout error:", error);
        });
    });
}

if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', () => {
        console.log("🔄 Refreshing devices...");
        loadAllDevices();
    });
}

// ==========================================
// STARTUP LOG
// ==========================================
console.log("✓ GuardianOS Multi-Dashboard v2.0 (Working with Images) loaded");
console.log("✓ Reading devices from: /devices");
console.log("✓ Reading camera images from: /devices/{id}/status/lastPhotoUrl");
console.log("✓ Operator access only");
