import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, off, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
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
let allDevices = [];
let deviceListeners = {};

const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com";

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
    if (user && user.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL.toLowerCase()) {
        currentUser = user;
        console.log("👤 Operator logged in:", user.email);
        loadAllDevices();
    } else {
        console.log("⛔ Access denied - not authorized operator");
        window.location.href = './index.html';
    }
});

// ==========================================
// LOAD DEVICES FROM /devices STRUCTURE
// ==========================================
function loadAllDevices() {
    const devicesRef = ref(database, 'devices');
    onValue(devicesRef, (snapshot) => {
        allDevices = [];
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            Object.keys(data).forEach(deviceUid => {
                const deviceData = data[deviceUid];
                
                // ✅ FIX 1: Get Model from identity node
                const model = deviceData.identity?.model || "Unknown Device";
                const name = deviceData.identity?.custom_name || deviceData.deviceName || `Device - ${deviceUid.substring(0, 8)}`;
                
                allDevices.push({
                    uid: deviceUid,
                    // Display as: Nicholas's Phone (SM-A065F)
                    name: `${name} (${model})`, 
                    battery: deviceData.battery_level || deviceData.status?.batteryPercentage || 0,
                    lastSeen: deviceData.last_seen || 0,
                    online: (Date.now() - (deviceData.last_seen || 0)) < 300000,
                    networkType: deviceData.status?.networkType || "UNKNOWN" // Capture network type for later use
                });
            });
            
            renderDevicesList();
            if (allDevices.length > 0 && !selectedDevice) selectDevice(allDevices[0].uid);
        } else {
            showNoDeviceAlert();
        }
    });
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
                <div class="device-item-name">${device.name}</div>
                <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                    ${device.online ? 'ONLINE' : 'OFFLINE'} • ${device.battery}%
                </div>
            </div>`;
        
        deviceItem.addEventListener('click', () => selectDevice(device.uid));
        devicesList.appendChild(deviceItem);
    });
    
    if (allDevices.length === 0) showNoDeviceAlert();
    else {
        noDeviceAlert.style.display = 'none';
        deviceDashboard.style.display = 'block';
    }
}

// ==========================================
// SELECT DEVICE
// ==========================================
function selectDevice(deviceUid) {
    selectedDevice = deviceUid;
    
    renderDevicesList();
    noDeviceAlert.style.display = 'none';
    deviceDashboard.style.display = 'block';
    
    injectAdvancedControls();

    // Clean up old listeners
    Object.keys(deviceListeners).forEach(key => off(deviceListeners[key]));
    deviceListeners = {};
    
    loadDeviceData(deviceUid);
    setupCommandListeners(deviceUid);
}

// =================================
