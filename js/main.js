// js/main.js
import { auth, onAuthStateChanged, ALLOWED_OPERATOR_EMAIL, setCurrentUser } from './firebase-config.js';
import { initSidebar } from './sidebar-manager.js';
import { initDeviceControl } from './view-device-control.js'; // We will create this next

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 GuardianOS Client Initializing...");

    // 1. Handle Authentication
    onAuthStateChanged(auth, (user) => {
        if (user && user.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
            setCurrentUser(user);
            
            // Hide loading screen
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';

            // Update UI with operator info
            const opEmail = document.getElementById('op-email');
            if(opEmail) opEmail.textContent = user.email;

            console.log(`👤 Operator Authenticated: ${user.email}`);
            
            // Initialize the Sidebar (Device List)
            initSidebar();
        } else {
            console.log("⛔ Access denied. Redirecting to login...");
            window.location.href = './index.html';
        }
    });

    // 2. Handle Logout
    const logoutBtn = document.getElementById('btn-logout');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = './index.html';
            }).catch((error) => {
                console.error("Logout Error:", error);
            });
        });
    }
});

// 3. Global Device Selection Handler
// This function is called by the sidebar when a user clicks a device
window.selectDevice = (uid) => {
    console.log(`📡 Switching context to device: ${uid}`);
    
    // Update Global State
    import('./firebase-config.js').then(module => {
        module.setSelectedDevice(uid);
        
        // Update UI: Show Dashboard, Hide Alert
        const alertBox = document.getElementById('no-device-alert');
        const dashboard = document.getElementById('device-dashboard');
        
        if(alertBox) alertBox.style.display = 'none';
        if(dashboard) dashboard.style.display = 'block';

        // Update Device Name in Header
        const nameEl = document.getElementById('selected-device-name');
        if(nameEl) {
            const device = module.allDevices.find(d => d.uid === uid);
            nameEl.textContent = device ? device.name : 'Unknown Device';
        }

        // Initialize the Complex Device Controls (The 50+ commands)
        initDeviceControl(uid);
    });
};
