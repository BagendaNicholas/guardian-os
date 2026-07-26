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
    const devicesRef = ref(database, 'devices');
    onValue(devicesRef, (snapshot) => {
        allDevices = [];
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            Object.keys(data).forEach(deviceUid => {
                const deviceData = data[deviceUid];
                const name = deviceData.identity?.custom_name || deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`;
                
                allDevices.push({
                    uid: deviceUid,
                    name: name,
                    battery: deviceData.battery_level || deviceData.status?.batteryPercentage || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 300000
                });
            });
            
            renderDevicesList();
            if (allDevices.length > 0 && !selectedDevice) selectDevice(allDevices[0].uid);
        } else {
            showNoDeviceAlert();
        }
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
    
    if (allDevices.length === 0) showNoDeviceAlert();
    else {
        noDeviceAlert.style.display = 'none';
        deviceDashboard.style.display = 'block';
    }
}

// ==========================================
// SELECT DEVICE
// ==========================================
function selectDevice(deviceUid) {
    selectedDevice = deviceUid;
    
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    injectAdvancedControls();

    Object.keys(deviceListeners).forEach(key => off(deviceListeners[key]));
    deviceListeners = {};
    
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

// ==========================================
// INJECT ADVANCED CONTROLS (Time & Media)
// ==========================================
function injectAdvancedControls() {
    if (document.getElementById('cmd-audio')) return; 

    const matrix = document.querySelector('.card-grid');
    if (!matrix) return;

    // 1. Time Activation Input
    const timeWrapper = document.createElement('div');
    timeWrapper.className = 'time-control-wrapper';
    timeWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-clock"></i> DAILY ACTIVATION CYCLE
        </label>
        <input type="time" id="time-setter">
    `;
    matrix.parentElement.insertBefore(timeWrapper, matrix.nextSibling);

    // 2. Audio Record Button
    const audioBtn = document.createElement('button');
    audioBtn.id = 'cmd-audio';
    audioBtn.className = 'matrix-btn toggle-btn';
    audioBtn.innerHTML = `<i class="fa-solid fa-microphone-lines"></i><span>AUDIO RECORD</span><span class="toggle-state">OFF</span>`;
    matrix.appendChild(audioBtn);

    // 3. Video Record Button
    const videoBtn = document.createElement('button');
    videoBtn.id = 'cmd-video';
    videoBtn.className = 'matrix-btn toggle-btn';
    videoBtn.innerHTML = `<i class="fa-solid fa-video"></i><span>VIDEO RECORD</span><span class="toggle-state">OFF</span>`;
    matrix.appendChild(videoBtn);
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
// REAL-TIME DATA STREAM (FIXED IMAGE DISPLAY)
// ==========================================
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);
    const listener = onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.warn("⚠️ Status node not found for device:", uid);
            return;
        }
        const data = snapshot.val();

        console.log('📡 Received telemetry data:', data);

        // Battery Level
        if (document.getElementById('battery-text')) {
            document.getElementById('battery-text').textContent = 
                data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
            
            const bar = document.getElementById('battery-bar');
            if(bar) bar.style.width = `${data.batteryPercentage || 0}%`;
        }

        // GPS Coordinates
        if (document.getElementById('latitude-text') && data.latitude != null) {
            document.getElementById('latitude-text').textContent = parseFloat(data.latitude).toFixed(6);
            document.getElementById('longitude-text').textContent = parseFloat(data.longitude).toFixed(6);
            
            const mapLink = document.getElementById('map-link');
            if (mapLink) mapLink.href = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        }

        // ✅ PHOTO/CAMERA CAPTURE (Support both naming conventions AND data URLs)
        const photoUrl = data.lastPhotoUrl || data.last_photo_url;
        if (photoUrl) {
            const img = document.getElementById('cameraPreviewFrame');
            const placeholder = document.getElementById('cameraPlaceholderText');
            if (img && placeholder) {
                console.log('📸 Updating camera preview');
                placeholder.style.display = "none";
                img.style.display = "block";
                // ✅ Support data URLs and regular URLs
                if (photoUrl.startsWith('data:')) {
                    img.src = photoUrl; // Data URL, no cache buster needed
                } else {
                    img.src = photoUrl + "?t=" + Date.now(); // Regular URL with cache buster
                }
                
                const timestamp = document.getElementById('captureTimestamp');
                if (timestamp) {
                    timestamp.innerText = `LAST UPDATED: ${new Date().toLocaleTimeString()}`;
                }
            }
        }

        // ✅ VIDEO (Support both naming conventions)
        const videoUrl = data.lastVideoUrl || data.last_video_url;
        if (videoUrl) {
            console.log('🎬 Updating video preview:', videoUrl);
            let videoContainer = document.getElementById('video-preview-container');
            if (!videoContainer) {
                videoContainer = document.createElement('div');
                videoContainer.id = 'video-preview-container';
                videoContainer.style.marginTop = "15px";
                videoContainer.innerHTML = `<video controls style="width:100%; border-radius:6px; border:1px solid var(--border-color);"></video>`;
                
                const wrapper = document.querySelector('.viewport-canvas-wrapper');
                if (wrapper) wrapper.after(videoContainer);
            }
            const videoEl = videoContainer.querySelector('video');
            if (videoEl && videoEl.src !== videoUrl) {
                videoEl.src = videoUrl;
                videoEl.load();
            }
        }

        // ✅ AUDIO (Support both naming conventions)
        const audioUrl = data.lastAudioUrl || data.last_audio_url;
        if (audioUrl) {
            console.log('🎵 Updating audio preview:', audioUrl);
            let audioContainer = document.getElementById('audio-preview-container');
            if (!audioContainer) {
                audioContainer = document.createElement('div');
                audioContainer.id = 'audio-preview-container';
                audioContainer.style.marginTop = "15px";
                audioContainer.innerHTML = `<audio controls style="width:100%; border-radius:6px; border:1px solid var(--border-color);"></audio>`;
                
                const wrapper = document.querySelector('.viewport-canvas-wrapper');
                if (wrapper) wrapper.after(audioContainer);
            }
            const audioEl = audioContainer.querySelector('audio');
            if (audioEl && audioEl.src !== audioUrl) {
                audioEl.src = audioUrl;
                audioEl.load();
            }
        }
    });
    deviceListeners[`status-${uid}`] = listener;
}

// ==========================================
// COMMAND STATE LISTENERS (SIMPLIFIED WITH VISUAL FEEDBACK)
// ==========================================
function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    const listener = onValue(commandsRef, (snapshot) => {
        const cmd = snapshot.val() || {};
        
        // ✅ PERSISTENT TOGGLES - Show ON/OFF state clearly
        updateButtonState('cmd-flashlight', cmd.flashlight);
        updateButtonState('cmd-alarm', cmd.alarm);
        updateButtonState('cmd-lock', cmd.emergencyLock);
        
        // ✅ TRIGGER BUTTONS - Show current state
        updateButtonState('cmd-capture', cmd.cameraCapture);
        updateButtonState('cmd-audio', cmd.record_audio);
        updateButtonState('cmd-video', cmd.record_video);

        // Update Time Input if it exists
        const timeInput = document.getElementById('time-setter');
        if (timeInput && cmd.activation_time) {
            if (document.activeElement !== timeInput) {
                timeInput.value = cmd.activation_time;
            }
        }
    });
    deviceListeners[`commands-${uid}`] = listener;
}

// ==========================================
// SETUP COMMAND EVENT LISTENERS (SIMPLIFIED)
// ==========================================
function setupCommandListeners(deviceUid) {
    // 1. STANDARD TOGGLE BUTTONS (Flashlight, Alarm, Lock)
    const cmdFlashlight = document.getElementById('cmd-flashlight');
    if (cmdFlashlight) {
        cmdFlashlight.addEventListener("click", () => {
            const newState = !cmdFlashlight.classList.contains("active");
            console.log("💡 Flashlight:", newState ? "ON" : "OFF");
            sendRemoteCommand(deviceUid, "flashlight", newState);
        });
    }

    const cmdAlarm = document.getElementById('cmd-alarm');
    if (cmdAlarm) {
        cmdAlarm.addEventListener("click", () => {
            const newState = !cmdAlarm.classList.contains("active");
            console.log("🔔 Alarm:", newState ? "ON" : "OFF");
            sendRemoteCommand(deviceUid, "alarm", newState);
        });
    }

    const cmdLock = document.getElementById('cmd-lock');
    if (cmdLock) {
        cmdLock.addEventListener("click", () => {
            const newState = !cmdLock.classList.contains("active");
            if (confirm(newState ? "🔒 Initialize Lockdown?" : "🔓 Deactivate Lockdown?")) {
                console.log("🔒 Emergency Lock:", newState ? "ON" : "OFF");
                sendRemoteCommand(deviceUid, "emergencyLock", newState);
            }
        });
    }

    // 2. TRIGGER BUTTONS (Camera, Audio, Video)
    const cmdCapture = document.getElementById('cmd-capture');
    if (cmdCapture) {
        cmdCapture.addEventListener("click", () => {
            console.log("📸 Camera Capture triggered");
            sendRemoteCommand(deviceUid, "cameraCapture", true);
        });
    }

    const cmdAudio = document.getElementById('cmd-audio');
    if (cmdAudio) {
        cmdAudio.addEventListener("click", () => {
            console.log("🎙️ Audio Record triggered");
            sendRemoteCommand(deviceUid, "record_audio", true);
        });
    }

    const cmdVideo = document.getElementById('cmd-video');
    if (cmdVideo) {
        cmdVideo.addEventListener("click", () => {
            console.log("📹 Video Record triggered");
            sendRemoteCommand(deviceUid, "record_video", true);
        });
    }

    // 3. TIME SETTER
    document.getElementById('time-setter')?.addEventListener('change', (e) => {
        if (e.target.value) {
            console.log('⏰ Setting activation time:', e.target.value);
            sendRemoteCommand(deviceUid, 'activation_time', e.target.value);
        }
    });
}

// ==========================================
// UTILITIES
// ==========================================
function sendRemoteCommand(deviceUid, commandName, value) {
    console.log(`📤 Sending command: ${commandName} = ${value}`);
    update(ref(database, `devices/${deviceUid}/commands`), { [commandName]: value });
}

/**
 * ✅ IMPROVED: Update button visual state with clear ON/OFF indicator
 */
function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    // Update active class
    btn.classList.toggle('active', !!isActive);
    
    // Update text label with ON/OFF state
    const stateEl = btn.querySelector('.toggle-state');
    if (stateEl) {
        stateEl.textContent = isActive ? 'ON' : 'OFF';
        stateEl.style.color = isActive ? '#00ff88' : '#666666';
        stateEl.style.fontWeight = isActive ? 'bold' : 'normal';
    }
    
    // Visual feedback: change button opacity and border
    if (isActive) {
        btn.style.borderColor = '#00ff88';
        btn.style.opacity = '1';
    } else {
        btn.style.borderColor = '#333333';
        btn.style.opacity = '0.7';
    }
}

function showNoDeviceAlert() {
    noDeviceAlert.style.display = 'flex';
    deviceDashboard.style.display = 'none';
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = './index.html'));
}

if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', loadAllDevices);
}
