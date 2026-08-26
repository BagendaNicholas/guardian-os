// js/utils.js
import { ref, update } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { database } from './firebase-config.js';

/**
 * Escapes HTML characters to prevent XSS attacks when rendering user data.
 */
export function esc(t) { 
    if (!t) return ''; 
    const d = document.createElement('div'); 
    d.textContent = t; 
    return d.innerHTML; 
}

/**
 * Formats a timestamp into a readable local date/time string.
 */
export function fmtTime(ts) { 
    return ts ? new Date(ts).toLocaleString() : '--'; 
}

/**
 * Sends a command to a specific device in Firebase.
 * @param {string} uid - The device UID.
 * @param {string} cmd - The command key (e.g., 'flashlight').
 * @param {any} val - The value to set (true, false, or a string).
 */
export function sendCmd(uid, cmd, val) { 
    console.log(`📤 [GUARDIANOS] Command: ${cmd} = ${val}`); 
    update(ref(database, `devices/${uid}/commands`), {[cmd]: val}); 
}

/**
 * Converts a package name to a friendly app name.
 * @param {string} pkg - The Android package name.
 * @returns {string} The friendly name.
 */
export function getFriendlyApp(pkg) {
    if (!pkg) return 'Unknown';
    
    // Social Media
    if (pkg.indexOf('whatsapp') >= 0) return 'WhatsApp';
    if (pkg.indexOf('telegram') >= 0) return 'Telegram';
    if (pkg.indexOf('instagram') >= 0) return 'Instagram';
    if (pkg.indexOf('facebook') >= 0) return 'Facebook';
    if (pkg.indexOf('tiktok') >= 0) return 'TikTok';
    if (pkg.indexOf('twitter') >= 0 || pkg.indexOf('.x.') >= 0) return 'X/Twitter';
    if (pkg.indexOf('snapchat') >= 0) return 'Snapchat';
    if (pkg.indexOf('discord') >= 0) return 'Discord';
    if (pkg.indexOf('signal') >= 0) return 'Signal';
    if (pkg.indexOf('viber') >= 0) return 'Viber';
    if (pkg.indexOf('imo.im') >= 0) return 'imo';
    if (pkg.indexOf('linkedin') >= 0) return 'LinkedIn';
    if (pkg.indexOf('reddit') >= 0) return 'Reddit';
    if (pkg.indexOf('pinterest') >= 0) return 'Pinterest';

    // Google & System
    if (pkg.indexOf('chrome') >= 0) return 'Chrome';
    if (pkg.indexOf('firefox') >= 0) return 'Firefox';
    if (pkg.indexOf('google.android.gm') >= 0) return 'Gmail';
    if (pkg.indexOf('google.android.youtube') >= 0) return 'YouTube';
    if (pkg.indexOf('google.android.maps') >= 0) return 'Google Maps';
    if (pkg.indexOf('google.android.apps.photos') >= 0) return 'Google Photos';
    if (pkg.indexOf('openai.chatgpt') >= 0) return 'ChatGPT';
    if (pkg.indexOf('systemui') >= 0) return 'System UI';
    if (pkg === 'android') return 'Android System';

    // Samsung Specific
    if (pkg.indexOf('samsung.android.dialer') >= 0) return 'Phone';
    if (pkg.indexOf('samsung.android.messaging') >= 0) return 'Messages';
    if (pkg.indexOf('samsung.android.contacts') >= 0) return 'Contacts';
    if (pkg.indexOf('samsung.android.camera') >= 0) return 'Camera';
    if (pkg.indexOf('samsung.android.gallery') >= 0) return 'Gallery';
    if (pkg.indexOf('samsung.android.biometrics') >= 0) return 'Biometric Lock';
    if (pkg.indexOf('samsung.android.settings') >= 0) return 'Settings';

    // Entertainment & Utilities
    if (pkg.indexOf('spotify') >= 0) return 'Spotify';
    if (pkg.indexOf('netflix') >= 0) return 'Netflix';
    if (pkg.indexOf('uber') >= 0) return 'Uber';
    if (pkg.indexOf('truecaller') >= 0) return 'Truecaller';
    if (pkg.indexOf('coderGtm.yantra') >= 0) return 'Terminal';

    // Fallback: Return the last part of the package name
    var parts = pkg.split('.');
    return parts[parts.length - 1] || pkg;
}

/**
 * Formats bytes into a human-readable string (KB, MB, GB).
 */
export function fmtSize(b) { 
    if (!b) return '0 B'; 
    if (b < 1024) return b + ' B'; 
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; 
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; 
    return (b / 1073741824).toFixed(2) + ' GB'; 
        }
