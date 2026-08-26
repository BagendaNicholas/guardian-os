
// js/sidebar-manager.js
import { database, ref, onValue, setAllDevices, allDevices, setSelectedDevice, addListener, removeListener } from './firebase-config.js';
import { esc } from './utils.js';

export function initSidebar() {
    const devicesList = document.getElementById('devices-list');
    const deviceCount = document.getElementById('device-count');
    const refreshBtn = document.getElementById('btn-refresh-devices');

    if (!devicesList || !deviceCount) return;

    // 1. Listen to the 'devices' node in Firebase
    const devicesRef = ref(database, 'devices');
    const listenerKey = 'sidebar-devices-list';
    
    // Clean up any existing listener for this key
    removeListener(listenerKey);

    const listener = onValue(devicesRef, (snapshot) => {
        if (!snapshot.exists()) {
            devicesList.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">No devices found.</div>';
            deviceCount.textContent = '0';
            return;
        }
        
        const data = snapshot.val();
        const devicesArray = [];
        
        Object.keys(data).forEach(deviceUid => {
            const d = data[deviceUid];
            const model = d.identity?.model || "Unknown Model";
            const customName = d.identity?.custom_name || d.deviceName || "Unknown Device";
            const lastSeen = d.last_seen || d.status?.last_seen || 0;
            
            // Consider online if seen in the last 5 minutes (300,000 ms)
            const online = (Date.now() - lastSeen) < 300000;
            const battery = d.battery_level || d.status?.batteryPercentage || 0;
            
            devicesArray.push({
                uid: deviceUid,
                name: `${customName} (${model})`,
                online: online,
                battery: battery
            });
        });

        // Update global state
        setAllDevices(devicesArray);
        
        // Render the list
        renderDevicesList(devicesArray, devicesList, deviceCount);
    });

    addListener(listenerKey, listener);

    // 2. Refresh Button Logic (Visual feedback only, as onValue is already real-time)
    if(refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...';
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh Devices';
            }, 1000);
        });
    }
}

function renderDevicesList(devices, container, countBadge) {
    container.innerHTML = '';
    countBadge.textContent = devices.length;

    if (devices.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">No devices registered.</div>';
        return;
    }

    devices.forEach(device => {
        const item = document.createElement('div');
        // Check if this device is currently selected in the global state
        const isSelected = window.selectedDevice === device.uid;
        
        item.className = `device-item ${isSelected ? 'active' : ''}`;
        item.innerHTML = `
            <div class="device-item-name">${esc(device.name)}</div>
            <div class="device-item-status ${device.online ? 'device-online' : 'device-offline'}">
                ${device.online ? '🟢 ONLINE' : '🔴 OFFLINE'} • 🔋${device.battery}%
            </div>
        `;
        
        item.addEventListener('click', () => {
            // Trigger the global selection handler defined in main.js
            if (window.selectDevice) {
                window.selectDevice(device.uid);
            }
        });
        
        container.appendChild(item);
    });
                                  }
