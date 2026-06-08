import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, off } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getStorage, getStorage as getStorageInstance } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

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
        loadAllDevices();
    } else {
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
                const deviceData = data[deviceUid];
                allDevices.push({
                    uid: deviceUid,
                    name: deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`,
                    battery: deviceData.battery_level || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 60000
                });
            });
            renderDevicesList();
            if (allDevices.length > 0 && !selectedDevice) selectDevice(allDevices[0].uid);
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
        deviceItem.innerHTML = `
            <div class="device-item-info">
                <div class="device-item-name">${device.name}</div>
                <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                    ${device.online ? 'ONLINE' : 'OFFLINE'} • ${device.battery}%
                </div>
            </div>`;
        deviceItem.addEventListener('click', () => selectDevice(device.uid));
        devicesList.appendChild(deviceItem);
    });
}

function selectDevice(deviceUid) {
    // Reset UI to prevent flickering of old data
    document.getElementById('battery-text').textContent = '--%';
    document.getElementById('cameraPreviewFrame').style.display = 'none';
    document.getElementById('cameraPlaceholderText').style.display = 'block';
    
    selectedDevice = deviceUid;
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    Object.keys(deviceListeners).forEach(key => off(deviceListeners[key]));
    deviceListeners = {};
    
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

function loadDeviceData(deviceUid) {
    const device = allDevices.find(d => d.uid === deviceUid);
    if (!device) return;
    
    document.getElementById('selected-device-name').textContent = device.name;
    updateMetrics(deviceUid);
    setupRealtimeListeners(deviceUid);
}

function updateMetrics(deviceUid) {
    const deviceRef = ref(database, `devices/${deviceUid}`);
    onValue(deviceRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        
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
    });
    deviceListeners[`metrics-${deviceUid}`] = deviceRef;
}

function setupRealtimeListeners(deviceUid) {
    setupCameraListener(deviceUid);
    const commandsRef = ref(database, `devices/${deviceUid}/commands`);
    onValue(commandsRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const commands = snapshot.val();
        updateBtnState('cmd-flashlight', commands.flashlight, 'ON', 'OFF');
        updateBtnState('cmd-alarm', commands.alarm, 'ON', 'OFF');
        updateBtnState('cmd-lock', commands.emergencyLock, 'LOCKED', 'UNLOCKED');
    });
    deviceListeners[`commands-${deviceUid}`] = commandsRef;
}

function updateBtnState(id, active, trueText, falseText) {
    const btn = document.getElementById(id);
    btn.classList.toggle('active', !!active);
    btn.querySelector('.toggle-state').textContent = active ? trueText : falseText;
}

function setupCommandListeners(deviceUid) {
    document.getElementById('cmd-flashlight').onclick = () => toggleCommand(deviceUid, 'flashlight');
    document.getElementById('cmd-alarm').onclick = () => toggleCommand(deviceUid, 'alarm');
    document.getElementById('cmd-lock').onclick = () => toggleCommand(deviceUid, 'emergencyLock');
    document.getElementById('cmd-capture').onclick = () => triggerCommand(deviceUid, 'cameraCapture');
}

async function toggleCommand(deviceUid, command) {
    const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
    const snapshot = await new Promise(resolve => {
        onValue(commandRef, resolve, { onlyOnce: true });
    });
    set(commandRef, !snapshot.val());
}

async function triggerCommand(deviceUid, command) {
    const commandRef = ref(database, `devices/${deviceUid}/commands/${command}`);
    set(commandRef, true);
    setTimeout(() => set(commandRef, false), 1000);
}

function setupCameraListener(deviceUid) {
    const imagesRef = ref(database, `devices/${deviceUid}/images`);
    onValue(imagesRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const images = Object.values(snapshot.val()).sort((a, b) => b.timestamp - a.timestamp);
        if (images[0]?.url) {
            const img = document.getElementById('cameraPreviewFrame');
            img.src = images[0].url;
            img.style.display = 'block';
            document.getElementById('cameraPlaceholderText').style.display = 'none';
            document.getElementById('captureTimestamp').textContent = `LAST UPDATED: ${formatTime(images[0].timestamp)}`;
        }
    });
    deviceListeners[`camera-${deviceUid}`] = imagesRef;
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
