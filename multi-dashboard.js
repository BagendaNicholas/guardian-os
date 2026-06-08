import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, off, get, remove } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
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
let selectedDeviceUserId = null;
let allDevices = [];
let deviceListeners = {};
let isMigrationInProgress = false;
let migrationAttempted = false;

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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("👤 User logged in:", user.email);
        
        // Check and perform migration only once per session
        if (!migrationAttempted) {
            migrationAttempted = true;
            await checkAndPerformMigration();
        }
        
        // Load devices (from new structure if migrated, old structure as fallback)
        loadAllDevices();
    } else {
        window.location.href = './index.html';
    }
});

// ==========================================
// AUTOMATIC MIGRATION FUNCTION
// ==========================================
async function checkAndPerformMigration() {
    if (isMigrationInProgress) return;
    
    try {
        console.log("🔄 Checking if migration is needed...");
        
        // Only admin can migrate
        if (currentUser.email !== 'nicholasbagenda@gmail.com') {
            console.log("ℹ️ Regular user - skipping migration check");
            return;
        }
        
        // Check if old /devices structure exists
        const oldDevicesRef = ref(database, 'devices');
        const oldSnapshot = await get(oldDevicesRef);
        
        if (!oldSnapshot.exists()) {
            console.log("✓ Old /devices structure not found - using new structure");
            return;
        }
        
        const oldDevices = oldSnapshot.val();
        console.log("📦 Found old devices structure with", Object.keys(oldDevices).length, "devices");
        
        // Check if new structure already has data
        const newUsersRef = ref(database, 'users');
        const newSnapshot = await get(newUsersRef);
        
        if (newSnapshot.exists()) {
            const existingUsers = newSnapshot.val();
            let hasDevices = false;
            
            Object.values(existingUsers).forEach(user => {
                if (user.devices && Object.keys(user.devices).length > 0) {
                    hasDevices = true;
                }
            });
            
            if (hasDevices) {
                console.log("✓ New /users structure already has devices - skipping migration");
                return;
            }
        }
        
        console.log("🚀 Starting automatic migration...");
        isMigrationInProgress = true;
        
        // Perform migration
        const migratedCount = await performAutomaticMigration(oldDevices);
        
        isMigrationInProgress = false;
        console.log(`✓ Migration completed successfully! Migrated ${migratedCount} devices`);
        
        // Optional: Show migration notification
        showMigrationNotification(migratedCount);
        
    } catch (error) {
        console.error("❌ Migration error:", error);
        isMigrationInProgress = false;
    }
}

async function performAutomaticMigration(oldDevices) {
    try {
        let migratedCount = 0;
        const adminUid = currentUser.uid;
        
        // Ensure admin profile exists
        const adminProfileRef = ref(database, `users/${adminUid}/profile`);
        const adminProfileSnapshot = await get(adminProfileRef);
        
        if (!adminProfileSnapshot.exists()) {
            await set(adminProfileRef, {
                email: currentUser.email,
                name: currentUser.displayName || "Admin",
                createdAt: Date.now()
            });
            console.log("📝 Created admin profile");
        }
        
        // For each device in the old structure
        for (const [deviceUid, deviceData] of Object.entries(oldDevices)) {
            try {
                // Assign to admin user
                const newDeviceRef = ref(database, `users/${adminUid}/devices/${deviceUid}`);
                await set(newDeviceRef, {
                    ...deviceData,
                    migrated_at: Date.now(),
                    migrated_from: 'devices/' + deviceUid
                });
                
                migratedCount++;
                console.log(`✓ Migrated device ${deviceUid} to admin`);
                
            } catch (deviceError) {
                console.error(`✗ Error migrating device ${deviceUid}:`, deviceError);
            }
        }
        
        console.log(`\n📊 Migration Summary:`);
        console.log(`   Total devices migrated: ${migratedCount}/${Object.keys(oldDevices).length}`);
        
        return migratedCount;
        
    } catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
}

function showMigrationNotification(count) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 229, 255, 0.2);
        border: 2px solid #00E5FF;
        color: #00E5FF;
        padding: 15px 20px;
        border-radius: 4px;
        font-family: 'Rajdhani', monospace;
        z-index: 10000;
        max-width: 300px;
    `;
    notification.textContent = `✓ Migration Complete: ${count} devices migrated to new structure`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// ==========================================
// LOAD DEVICES (OPTION 2 STRUCTURE)
// ==========================================
function loadAllDevices() {
    allDevices = [];
    
    // Admin sees all users' devices
    if (currentUser.email === 'nicholasbagenda@gmail.com') {
        loadAllDevicesAsAdmin();
    } 
    // Regular users see only their devices
    else {
        loadUserDevices(currentUser.uid);
    }
}

function loadAllDevicesAsAdmin() {
    console.log("👑 Loading as admin - fetching all devices from all users");
    
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        allDevices = [];
        
        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            
            Object.entries(allUsers).forEach(([userId, userData]) => {
                if (userData.devices) {
                    Object.entries(userData.devices).forEach(([deviceUid, deviceData]) => {
                        allDevices.push({
                            uid: deviceUid,
                            userId: userId,
                            name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                            battery: deviceData.battery_level || 0,
                            lastSeen: deviceData.last_seen || 0,
                            online: (Date.now() - (deviceData.last_seen || 0)) < 60000,
                            owner: userData.profile?.email || userId
                        });
                    });
                }
            });
            
            console.log("📱 Found", allDevices.length, "total devices from", Object.keys(allUsers).length, "users");
            renderDevicesList();
            
            if (allDevices.length > 0 && !selectedDevice) {
                selectDevice(allDevices[0].uid, allDevices[0].userId);
            }
        } else {
            console.log("⚠️ No users found in /users structure");
            // Fallback to old structure if new one is empty
            loadDevicesFromOldStructure();
        }
    });
}

function loadUserDevices(userId) {
    console.log("👤 Loading user devices for:", userId);
    
    const userDevicesRef = ref(database, `users/${userId}/devices`);
    onValue(userDevicesRef, (snapshot) => {
        allDevices = [];
        
        if (snapshot.exists()) {
            const devices = snapshot.val();
            
            Object.entries(devices).forEach(([deviceUid, deviceData]) => {
                allDevices.push({
                    uid: deviceUid,
                    userId: userId,
                    name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                    battery: deviceData.battery_level || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 60000
                });
            });
            
            console.log("📱 Found", allDevices.length, "devices for this user");
            renderDevicesList();
            
            if (allDevices.length > 0 && !selectedDevice) {
                selectDevice(allDevices[0].uid, userId);
            }
        } else {
            console.log("⚠️ No devices found for user in new structure");
            // Fallback to old structure if new one is empty
            loadDevicesFromOldStructure();
        }
    });
}

// Fallback function for old structure (temporary during transition)
function loadDevicesFromOldStructure() {
    console.log("↩️ Falling back to old /devices structure");
    
    const devicesRef = ref(database, 'devices');
    onValue(devicesRef, (snapshot) => {
        allDevices = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(deviceUid => {
                const deviceData = data[deviceUid];
                allDevices.push({
                    uid: deviceUid,
                    userId: currentUser.uid, // Use current user
                    name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                    battery: deviceData.battery_level || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 60000
                });
            });
            console.log("📱 Found", allDevices.length, "devices in old structure");
            renderDevicesList();
            if (allDevices.length > 0 && !selectedDevice) {
                selectDevice(allDevices[0].uid, currentUser.uid);
            }
        } else {
            showNoDeviceAlert();
        }
    });
}

function renderDevicesList() {
    devicesList.innerHTML = '';
    deviceCount.textContent = allDevices.length;
    
    allDevices.forEach(device => {
        const deviceItem = document.createElement('div');
        deviceItem.className = `device-item ${selectedDevice === device.uid ? 'active' : ''}`;
        
        let ownerInfo = '';
        if (currentUser.email === 'nicholasbagenda@gmail.com' && device.owner) {
            ownerInfo = ` • ${device.owner}`;
        }
        
        deviceItem.innerHTML = `
            <div class="device-item-info">
                <div class="device-item-name">${device.name}</div>
                <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                    ${device.online ? 'ONLINE' : 'OFFLINE'} • ${device.battery}%${ownerInfo}
                </div>
            </div>`;
        
        deviceItem.addEventListener('click', () => selectDevice(device.uid, device.userId));
        devicesList.appendChild(deviceItem);
    });
    
    if (allDevices.length === 0) {
        showNoDeviceAlert();
    }
}

function selectDevice(deviceUid, userId) {
    // Reset UI to prevent flickering of old data
    document.getElementById('battery-text').textContent = '--%';
    document.getElementById('cameraPreviewFrame').style.display = 'none';
    document.getElementById('cameraPlaceholderText').style.display = 'block';
    
    selectedDevice = deviceUid;
    selectedDeviceUserId = userId;
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    Object.keys(deviceListeners).forEach(key => off(deviceListeners[key]));
    deviceListeners = {};
    
    loadDeviceData(deviceUid, userId);
    setupCommandListeners(deviceUid, userId);
}

function loadDeviceData(deviceUid, userId) {
    const device = allDevices.find(d => d.uid === deviceUid);
    if (!device) return;
    
    document.getElementById('selected-device-name').textContent = device.name;
    updateMetrics(deviceUid, userId);
    setupRealtimeListeners(deviceUid, userId);
}

function updateMetrics(deviceUid, userId) {
    const deviceRef = ref(database, `users/${userId}/devices/${deviceUid}`);
    onValue(deviceRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Try old structure as fallback
            const oldDeviceRef = ref(database, `devices/${deviceUid}`);
            onValue(oldDeviceRef, (oldSnapshot) => {
                if (oldSnapshot.exists()) {
                    updateMetricsData(oldSnapshot.val());
                }
            });
            return;
        }
        updateMetricsData(snapshot.val());
    });
    deviceListeners[`metrics-${deviceUid}`] = deviceRef;
}

function updateMetricsData(data) {
    document.getElementById('battery-text').textContent = `${data.battery_level || 0}%`;
    document.getElementById('battery-bar').innerHTML = `<div class="battery-bar-fill" style="width: ${data.battery_level || 0}%"></div>`;
    
    const lockState = data.commands?.emergencyLock ? 'LOCKED' : 'SECURE';
    const stateEl = document.getElementById('device-state-text');
    stateEl.textContent = lockState;
    stateEl.className = `metric-value ${lockState === 'LOCKED' ? 'status-locked' : 'status-secure'}`;
    
    document.getElementById('last-seen-text').textContent = formatTime(data.last_seen);
    
    if (data.location) {
        document.getElementById('latitude-text').textContent = data.location.lat?.toFixed(6) || '--';
        document.getElementById('longitude-text').textContent = data.location.lng?.toFixed(6) || '--';
        document.getElementById('map-link').href = `https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}`;
    }
}

function setupRealtimeListeners(deviceUid, userId) {
    setupCameraListener(deviceUid, userId);
    const commandsRef = ref(database, `users/${userId}/devices/${deviceUid}/commands`);
    onValue(commandsRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Try old structure
            const oldCommandsRef = ref(database, `devices/${deviceUid}/commands`);
            onValue(oldCommandsRef, (oldSnapshot) => {
                if (oldSnapshot.exists()) {
                    updateCommandsState(oldSnapshot.val());
                }
            });
            return;
        }
        updateCommandsState(snapshot.val());
    });
    deviceListeners[`commands-${deviceUid}`] = commandsRef;
}

function updateCommandsState(commands) {
    updateBtnState('cmd-flashlight', commands.flashlight, 'ON', 'OFF');
    updateBtnState('cmd-alarm', commands.alarm, 'ON', 'OFF');
    updateBtnState('cmd-lock', commands.emergencyLock, 'LOCKED', 'UNLOCKED');
}

function updateBtnState(id, active, trueText, falseText) {
    const btn = document.getElementById(id);
    btn.classList.toggle('active', !!active);
    btn.querySelector('.toggle-state').textContent = active ? trueText : falseText;
}

function setupCommandListeners(deviceUid, userId) {
    document.getElementById('cmd-flashlight').onclick = () => toggleCommand(deviceUid, userId, 'flashlight');
    document.getElementById('cmd-alarm').onclick = () => toggleCommand(deviceUid, userId, 'alarm');
    document.getElementById('cmd-lock').onclick = () => toggleCommand(deviceUid, userId, 'emergencyLock');
    document.getElementById('cmd-capture').onclick = () => triggerCommand(deviceUid, userId, 'cameraCapture');
}

async function toggleCommand(deviceUid, userId, command) {
    const commandRef = ref(database, `users/${userId}/devices/${deviceUid}/commands/${command}`);
    const snapshot = await new Promise(resolve => {
        onValue(commandRef, resolve, { onlyOnce: true });
    });
    set(commandRef, !snapshot.val());
}

async function triggerCommand(deviceUid, userId, command) {
    const commandRef = ref(database, `users/${userId}/devices/${deviceUid}/commands/${command}`);
    set(commandRef, true);
    setTimeout(() => set(commandRef, false), 1000);
}

function setupCameraListener(deviceUid, userId) {
    const imagesRef = ref(database, `users/${userId}/devices/${deviceUid}/images`);
    onValue(imagesRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Try old structure
            const oldImagesRef = ref(database, `devices/${deviceUid}/images`);
            onValue(oldImagesRef, (oldSnapshot) => {
                if (oldSnapshot.exists()) {
                    updateCameraPreview(oldSnapshot.val());
                }
            });
            return;
        }
        updateCameraPreview(snapshot.val());
    });
    deviceListeners[`camera-${deviceUid}`] = imagesRef;
}

function updateCameraPreview(images) {
    const sortedImages = Object.values(images).sort((a, b) => b.timestamp - a.timestamp);
    if (sortedImages[0]?.url) {
        const img = document.getElementById('cameraPreviewFrame');
        img.src = sortedImages[0].url;
        img.style.display = 'block';
        document.getElementById('cameraPlaceholderText').style.display = 'none';
        document.getElementById('captureTimestamp').textContent = `LAST UPDATED: ${formatTime(sortedImages[0].timestamp)}`;
    }
}

function formatTime(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--';
}

function showNoDeviceAlert() {
    noDeviceAlert.style.display = 'flex';
    deviceDashboard.style.display = 'none';
}

logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = './index.html'));
refreshDevicesBtn.addEventListener('click', loadAllDevices);

// Export manual migration function for troubleshooting
window.manualMigration = async function() {
    if (currentUser.email === 'nicholasbagenda@gmail.com') {
        isMigrationInProgress = false;
        migrationAttempted = false;
        await checkAndPerformMigration();
        location.reload();
    } else {
        alert("Only admin can perform migration");
    }
};

console.log("✓ GuardianOS Multi-Dashboard v2.1 loaded");
console.log("✓ Automatic migration enabled");
console.log("✓ Fallback to old structure enabled during transition");
