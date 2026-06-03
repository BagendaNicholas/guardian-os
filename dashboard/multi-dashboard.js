import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, off } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getStorage, ref as storageRef, getBytes } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

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
const storage = getStorage(app);

// ==========================================
// Global Variables
// ==========================================

let currentUser = null;
let selectedDevice = null;
let allDevices = [];
let deviceListeners = {};

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
    if (user) {
        currentUser = user;
        console.log('✅ User logged in:', user.email);
        loadAllDevices();
    } else {
        console.log('❌ No user logged in - Redirecting to login');
        window.location.href = './index.html';
    }
});

// ==========================================
// LOAD ALL DEVICES
// ==========================================

function loadAllDevices() {
    try {
        console.log('🔍 Loading all devices for user:', currentUser.uid);
        const devicesRef = ref(database, 'devices');
        
        onValue(devicesRef, (snapshot) => {
            allDevices = [];
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Get all device UIDs
                Object.keys(data).forEach(deviceUid => {
                    const deviceData = data[deviceUid];
                    
                    allDevices.push({
                        uid: deviceUid,
                        name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                        status: deviceData.status || {},
                        commands: deviceData.commands || {},
                        location: deviceData.location || {},
                        battery: deviceData.battery_level || 0,
                        lastSeen: deviceData.last_seen || 0,
                        online: (Date.now() - (deviceData.last_seen || 0)) < 60000 // Last seen within 1 minute
                    });
                });
                
                console.log('✅ Loaded', allDevices.length, 'devices');
                renderDevicesList();
                
                // Auto-select first device if available
                if (allDevices.length > 0 && !selectedDevice) {
                    selectDevice(allDevices[0].uid);
                }
            } else {
                console.warn('⚠️ No devices found');
                renderDevicesList();
                showNoDeviceAlert();
            }
        });
    } catch (error) {
        console.error('❌ Error loading devices:', error);
    }
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
                <div class="device-item-name">
                    <i class="fa-solid fa-mobile-screen-button device-icon"></i>
                    ${device.name}
                </div>
                <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                    <i class="fa-solid ${device.online ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                    ${device.online ? 'ONLINE' : 'OFFLINE'} • Battery: ${device.battery}%
                </div>
            </div>
        `;
        
        deviceItem.addEventListener('click', () => selectDevice(device.uid));
        devicesList.appendChild(deviceItem);
    });
}

// ==========================================
// SELECT DEVICE
// ==========================================

function selectDevice(deviceUid) {
    selectedDevice = deviceUid;
    console.log('📱 Selected device:', deviceUid);
    
    // Update UI
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    // Remove old listeners
    Object.keys(deviceListeners).forEach(key => {
        off(deviceListeners[key]);
    });
    deviceListeners = {};
    
    // Load device data
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

// ==========================================
// LOAD DEVICE DATA
// ==========================================

function loadDeviceData(deviceUid) {
    const device = allDevices.find(d => d.uid === deviceUid);
    
    if (!device) return;
    
    console.log('📊 Loading data for device:', device.name);
    
    // Update header
    document.getElementById('selected-device-name').textContent = device.name;
    const onlineStatus = document.getElementById('device-online-status');
    onlineStatus.innerHTML = `<span class="pulse-dot-small"></span> ${device.online ? 'ONLINE' : 'OFFLINE'}`;
    onlineStatus.style.color = device.online ? '#00FF88' : '#FFA000';
    
    // Update metrics
    updateMetrics(deviceUid);
    setupRealtimeListeners(deviceUid);
}

// ==========================================
// UPDATE METRICS
// ==========================================

function updateMetrics(deviceUid) {
    const deviceRef = ref(database, `devices/${deviceUid}`);
    
    onValue(deviceRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Battery
            const batteryLevel = data.battery_level || 0;
            document.getElementById('battery-text').textContent = `${batteryLevel}%`;
            const batteryBar = document.getElementById('battery-bar');
            batteryBar.innerHTML = `<div class="battery-bar-fill" style="width: ${batteryLevel}%"></div>`;
            
            // Device State
            const lockState = data.commands?.emergencyLock ? 'LOCKED' : 'SECURE';
            const stateEl = document.getElementById('device-state-text');
            stateEl.textContent = lockState;
            stateEl.className = `metric-value ${lockState === 'LOCKED' ? 'status-locked' : 'status-secure'}`;
            
            // Last Seen
            const lastSeen = data.last_seen || 0;
            const lastSeenTime = formatTime(lastSeen);
            document.getElementById('last-seen-text').textContent = lastSeenTime;
            
            // Location
            if (data.location) {
                document.getElementById('latitude-text').textContent = data.location.lat?.toFixed(6) || '--';
                document.getElementById('longitude-text').textContent = data.location.lng?.toFixed(6) || '--';
                
                const mapLink = document.getElementById('map-link');
                mapLink.href = `https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`;
                mapLink.classList.remove('disabled');
            }
        }
    });
    
    deviceListeners[`metrics-${deviceUid}`] = deviceRef;
}

// ==========================================
// SETUP REALTIME LISTENERS
// ==========================================

function setupRealtimeListeners(deviceUid) {
    // Camera images
    setupCameraListener(deviceUid);
    
    // Commands state
    const commandsRef = ref(database, `devices/${deviceUid}/commands`);
    onValue(commandsRef, (snapshot) => {
        if (snapshot.exists()) {
            const commands = snapshot.val();
            
            // Update button states
            const flashlightBtn = document.getElementById('cmd-flashlight');
            if (commands.flashlight) {
                flashlightBtn.classList.add('active');
                flashlightBtn.querySelector('.toggle-state').textContent = 'ON';
            } else {
                flashlightBtn.classList.remove('active');
                flashlightBtn.querySelector('.toggle-state').textContent = 'OFF';
            }
            
            const alarmBtn = document.getElementById('cmd-alarm');
            if (commands.alarm) {
                alarmBtn.classList.add('active');
                alarmBtn.querySelector('.toggle-state').textContent = 'ON';
            } else {
                alarmBtn.classList.remove('active');
                alarmBtn.querySelector('.toggle-state').textContent = 'OFF';
            }
            
            const lockBtn = document.getElementById('cmd-lock');
            if (commands.emergencyLock) {
                lockBtn.classList.add('active');
                lockBtn.querySelector('.toggle-state').textContent = 'LOCKED';
            } else {
                lockBtn.classList.remove('active');
                lockBtn.querySelector('.toggle-state').textContent = 'UNLOCKED';
            }
        }
    });
    
    deviceListeners[`commands-${deviceUid}`] = commandsRef;
}

// ==========================================
// SETUP COMMAND LISTENERS
// ==========================================

function setupCommandListeners(deviceUid) {
    document.getElementById('cmd-flashlight').onclick = () => toggleCommand(deviceUid, 'flashlight');
    document.getElementById('cmd-alarm').onclick = () => toggleCommand(deviceUid, 'alarm');
    document.getElementById('cmd-lock').onclick = () => toggleCommand(deviceUid, 'emergencyLock');
    document.getElementById('cmd-capture').onclick = () => triggerCommand(deviceUid, 'cameraCapture');
}

// ==========================================
// TOGGLE COMMAND (Flashlight, Alarm, Lock)
// ==========================================

async function toggleCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        const currentValue = (await getCommandValue(deviceUid, command)) || false;
        const newValue = !currentValue;
        
        await set(commandRef, newValue);
        console.log(`✅ ${command} toggled to ${newValue}`);
    } catch (error) {
        console.error(`❌ Error toggling ${command}:`, error);
    }
}

// ==========================================
// TRIGGER COMMAND (Camera Capture)
// ==========================================

async function triggerCommand(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        await set(commandRef, true);
        console.log(`✅ ${command} triggered`);
        
        // Reset after 1 second
        setTimeout(() => {
            set(commandRef, false);
        }, 1000);
    } catch (error) {
        console.error(`❌ Error triggering ${command}:`, error);
    }
}

// ==========================================
// GET COMMAND VALUE
// ==========================================

async function getCommandValue(deviceUid, command) {
    try {
        const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
        return new Promise((resolve) => {
            onValue(commandRef, (snapshot) => {
                resolve(snapshot.val() || false);
            }, { onlyOnce: true });
        });
    } catch (error) {
        console.error('❌ Error getting command value:', error);
        return false;
    }
}

// ==========================================
// SETUP CAMERA LISTENER
// ==========================================

function setupCameraListener(deviceUid) {
    const imagesRef = ref(database, `devices/${deviceUid}/images`);
    
    onValue(imagesRef, (snapshot) => {
        if (snapshot.exists()) {
            const images = snapshot.val();
            const latestImage = Object.values(images).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
            
            if (latestImage && latestImage.url) {
                const img = document.getElementById('cameraPreviewFrame');
                img.src = latestImage.url;
                img.style.display = 'block';
                
                document.getElementById('cameraPlaceholderText').style.display = 'none';
                document.getElementById('captureTimestamp').textContent = `LAST UPDATED: ${formatTime(latestImage.timestamp)}`;
            }
        }
    });
    
    deviceListeners[`camera-${deviceUid}`] = imagesRef;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
}

function showNoDeviceAlert() {
    noDeviceAlert.style.display = 'flex';
    deviceDashboard.style.display = 'none';
}

// ==========================================
// EVENT LISTENERS
// ==========================================

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = './index.html';
    } catch (error) {
        console.error('❌ Logout error:', error);
    }
});

refreshDevicesBtn.addEventListener('click', () => {
    console.log('🔄 Refreshing devices list...');
    loadAllDevices();
});

// ==========================================
// EXPORT FOR DEBUGGING
// ==========================================

window.GuardianDashboard = {
    selectedDevice,
    allDevices,
    currentUser,
    loadAllDevices,
    selectDevice
};

console.log('✅ Multi-Device Dashboard initialized');
