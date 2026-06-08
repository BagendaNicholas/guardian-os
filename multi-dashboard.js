import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, off, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
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
    if (user) {
        currentUser = user;
        console.log("👤 User logged in:", user.email);
        loadAllDevices();
    } else {
        window.location.href = './index.html';
    }
});

// ==========================================
// LOAD DEVICES FROM OLD /devices STRUCTURE
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
                    battery: deviceData.battery_level || 0,
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

function loadDeviceData(deviceUid) {
    const device = allDevices.find(d => d.uid === deviceUid);
    if (!device) return;
    
    document.getElementById('selected-device-name').textContent = device.name;
    updateMetrics(deviceUid);
    setupRealtimeListeners(deviceUid);
}

function updateMetrics(deviceUid) {
    console.log("📊 Updating metrics for:", deviceUid);
    
    const deviceRef = ref(database, `devices/${deviceUid}`);
    const listener = onValue(deviceRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ Device data not found");
            return;
        }
        
        const data = snapshot.val();
        
        // Battery
        document.getElementById('battery-text').textContent = `${data.battery_level || 0}%`;
        document.getElementById('battery-bar').innerHTML = `<div class="battery-bar-fill" style="width: ${data.battery_level || 0}%"></div>`;
        
        // Device State
        const lockState = data.commands?.emergencyLock ? 'LOCKED' : 'SECURE';
        const stateEl = document.getElementById('device-state-text');
        stateEl.textContent = lockState;
        stateEl.className = `metric-value ${lockState === 'LOCKED' ? 'status-locked' : 'status-secure'}`;
        
        // Last Seen
        document.getElementById('last-seen-text').textContent = formatTime(data.last_seen);
        
        // Location
        if (data.location) {
            document.getElementById('latitude-text').textContent = data.location.lat?.toFixed(6) || '--';
            document.getElementById('longitude-text').textContent = data.location.lng?.toFixed(6) || '--';
            document.getElementById('map-link').href = `https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}`;
        }
    }, (error) => {
        console.error("❌ Error loading metrics:", error);
    });
    
    deviceListeners[`metrics-${deviceUid}`] = listener;
}

function setupRealtimeListeners(deviceUid) {
    setupCameraListener(deviceUid);
    
    const commandsRef = ref(database, `devices/${deviceUid}/commands`);
    const listener = onValue(commandsRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ Commands not found for device");
            return;
        }
        
        const commands = snapshot.val();
        updateBtnState('cmd-flashlight', commands.flashlight, 'ON', 'OFF');
        updateBtnState('cmd-alarm', commands.alarm, 'ON', 'OFF');
        updateBtnState('cmd-lock', commands.emergencyLock, 'LOCKED', 'UNLOCKED');
    }, (error) => {
        console.error("❌ Error loading commands:", error);
    });
    
    deviceListeners[`commands-${deviceUid}`] = listener;
}

function updateBtnState(id, active, trueText, falseText) {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    btn.classList.toggle('active', !!active);
    const stateEl = btn.querySelector('.toggle-state');
    if (stateEl) {
        stateEl.textContent = active ? trueText : falseText;
    }
}

function setupCommandListeners(deviceUid) {
    const flashBtn = document.getElementById('cmd-flashlight');
    const alarmBtn = document.getElementById('cmd-alarm');
    const lockBtn = document.getElementById('cmd-lock');
    const captureBtn = document.getElementById('cmd-capture');
    
    if (flashBtn) flashBtn.onclick = () => toggleCommand(deviceUid, 'flashlight');
    if (alarmBtn) alarmBtn.onclick = () => toggleCommand(deviceUid, 'alarm');
    if (lockBtn) lockBtn.onclick = () => toggleCommand(deviceUid, 'emergencyLock');
    if (captureBtn) captureBtn.onclick = () => triggerCommand(deviceUid, 'cameraCapture');
}

async function toggleCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        const snapshot = await get(commandRef);
        
        if (snapshot.exists()) {
            set(commandRef, !snapshot.val());
            console.log("✓ Toggled command:", command);
        }
    } catch (error) {
        console.error("❌ Error toggling command:", error);
    }
}

async function triggerCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        set(commandRef, true);
        console.log("✓ Triggered command:", command);
        
        setTimeout(() => set(commandRef, false), 1000);
    } catch (error) {
        console.error("❌ Error triggering command:", error);
    }
}

function setupCameraListener(deviceUid) {
    console.log("📷 Setting up camera listener for:", deviceUid);
    
    const imagesRef = ref(database, `devices/${deviceUid}/images`);
    const listener = onValue(imagesRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ No images found for device");
            return;
        }
        
        const images = Object.values(snapshot.val()).sort((a, b) => b.timestamp - a.timestamp);
        
        if (images[0]?.url) {
            const img = document.getElementById('cameraPreviewFrame');
            img.src = images[0].url;
            img.style.display = 'block';
            
            const placeholder = document.getElementById('cameraPlaceholderText');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            const timestamp = document.getElementById('captureTimestamp');
            if (timestamp) {
                timestamp.textContent = `LAST UPDATED: ${formatTime(images[0].timestamp)}`;
            }
            
            console.log("✓ Camera image updated");
        }
    }, (error) => {
        console.error("❌ Error loading camera images:", error);
    });
    
    deviceListeners[`camera-${deviceUid}`] = listener;
}

function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function showNoDeviceAlert() {
    noDeviceAlert.style.display = 'flex';
    deviceDashboard.style.display = 'none';
}

// ==========================================
// EVENT LISTENERS
// ==========================================
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = './index.html';
    }).catch(error => {
        console.error("Logout error:", error);
    });
});

refreshDevicesBtn.addEventListener('click', () => {
    console.log("🔄 Refreshing devices...");
    loadAllDevices();
});

console.log("✓ GuardianOS Multi-Dashboard v1.0 (Old Structure) loaded");
