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
    updateMetrics(deviceUid);
    setupRealtimeListeners(deviceUid);
}

// ==========================================
// UPDATE DEVICE METRICS
// ==========================================
function updateMetrics(deviceUid) {
    console.log("📊 Updating metrics for:", deviceUid);
    
    const deviceRef = ref(database, `devices/${deviceUid}`);
    const listener = onValue(deviceRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ Device data not found");
            return;
        }
        
        const data = snapshot.val();
        
        // Battery Level
        const batteryPercent = data.battery_level || 0;
        document.getElementById('battery-text').textContent = `${batteryPercent}%`;
        document.getElementById('battery-bar').innerHTML = `<div class="battery-bar-fill" style="width: ${batteryPercent}%"></div>`;
        
        // Device State (Lock Status)
        const lockState = data.commands?.emergencyLock ? 'LOCKED' : 'SECURE';
        const stateEl = document.getElementById('device-state-text');
        stateEl.textContent = lockState;
        stateEl.className = `metric-value ${lockState === 'LOCKED' ? 'status-locked' : 'status-secure'}`;
        
        // Last Seen Time
        document.getElementById('last-seen-text').textContent = formatTime(data.last_seen);
        
        // Location (Latitude & Longitude)
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

// ==========================================
// SETUP REALTIME LISTENERS
// ==========================================
function setupRealtimeListeners(deviceUid) {
    // Setup Camera Listener
    setupCameraListener(deviceUid);
    
    // Setup Commands Listener
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

// ==========================================
// UPDATE BUTTON STATE
// ==========================================
function updateBtnState(id, active, trueText, falseText) {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    btn.classList.toggle('active', !!active);
    const stateEl = btn.querySelector('.toggle-state');
    if (stateEl) {
        stateEl.textContent = active ? trueText : falseText;
    }
}

// ==========================================
// SETUP COMMAND EVENT LISTENERS
// ==========================================
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

// ==========================================
// TOGGLE COMMAND (Flashlight, Alarm, Lock)
// ==========================================
async function toggleCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        const snapshot = await get(commandRef);
        
        if (snapshot.exists()) {
            const newValue = !snapshot.val();
            await set(commandRef, newValue);
            console.log(`✓ Toggled ${command} to:`, newValue);
        }
    } catch (error) {
        console.error("❌ Error toggling command:", error);
    }
}

// ==========================================
// TRIGGER COMMAND (Camera Capture)
// ==========================================
async function triggerCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        await set(commandRef, true);
        console.log(`✓ Triggered command: ${command}`);
        
        // Reset after 1 second
        setTimeout(async () => {
            await set(commandRef, false);
        }, 1000);
    } catch (error) {
        console.error("❌ Error triggering command:", error);
    }
}

// ==========================================
// SETUP CAMERA LISTENER
// ==========================================
function setupCameraListener(deviceUid) {
    console.log("📷 Setting up camera listener for:", deviceUid);
    
    // Read from image_links (same path as old dashboard)
    const imagesRef = ref(database, `image_links/${deviceUid}`);
    const listener = onValue(imagesRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("⚠️ No images found in image_links for device");
            return;
        }
        
        const imageData = snapshot.val();
        console.log("📷 Image data received");
        
        // Handle if it's a direct image object or array of images
        let imageUrl = null;
        let timestamp = null;
        
        if (imageData.url) {
            // Single image object with url field
            imageUrl = imageData.url;
            timestamp = imageData.timestamp || Date.now();
            console.log("✓ Single image found");
        } else if (typeof imageData === 'object') {
            // Multiple images - get most recent
            const images = Object.values(imageData).filter(img => img && img.url);
            if (images.length > 0) {
                images.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                imageUrl = images[0].url;
                timestamp = images[0].timestamp || Date.now();
                console.log("✓ Multiple images found, showing latest");
            }
        }
        
        if (imageUrl) {
            // Update camera preview
            const img = document.getElementById('cameraPreviewFrame');
            img.src = imageUrl;
            img.style.display = 'block';
            
            // Hide placeholder
            const placeholder = document.getElementById('cameraPlaceholderText');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // Update timestamp
            const timestampEl = document.getElementById('captureTimestamp');
            if (timestampEl) {
                timestampEl.textContent = `LAST UPDATED: ${formatTime(timestamp)}`;
            }
            
            console.log("✓ Camera preview updated successfully");
        }
    }, (error) => {
        console.error("❌ Error loading camera images:", error);
    });
    
    deviceListeners[`camera-${deviceUid}`] = listener;
}

// ==========================================
// FORMAT TIME
// ==========================================
function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
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
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = './index.html';
    }).catch(error => {
        console.error("❌ Logout error:", error);
    });
});

refreshDevicesBtn.addEventListener('click', () => {
    console.log("🔄 Refreshing devices...");
    loadAllDevices();
});

// ==========================================
// STARTUP LOG
// ==========================================
console.log("✓ GuardianOS Multi-Dashboard v1.2 (Full Working Version) loaded");
console.log("✓ Reading devices from: /devices");
console.log("✓ Reading images from: /image_links");
