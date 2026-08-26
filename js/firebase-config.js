// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, off, get, push, remove } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getStorage as getStorageInstance } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyBhaPM20tIhMalxLjoCklmwy4qb1ZkraSo",
    authDomain: "guardianos-30b18.firebaseapp.com",
    projectId: "guardianos-30b18",
    storageBucket: "guardianos-30b18.appspot.com",
    messagingSenderId: "323558398331",
    appId: "1:323558398331:android:a022a1e38b48a0247705de",
    databaseURL: "https://guardianos-30b18-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorageInstance(app);

// Configuration Constants
export const ALLOWED_OPERATOR_EMAIL = "nicholasbagenda@gmail.com";

// Global State Variables
export let currentUser = null;
export let selectedDevice = null;
export let allDevices = [];
export let deviceListeners = {};

// State Management Helpers
export function setCurrentUser(user) { 
    currentUser = user; 
}

export function setSelectedDevice(uid) { 
    selectedDevice = uid; 
}

export function setAllDevices(devices) { 
    allDevices = devices; 
}

export function addListener(key, listener) { 
    deviceListeners[key] = listener; 
}

export function removeListener(key) { 
    if (deviceListeners[key]) { 
        try { 
            off(deviceListeners[key]); 
        } catch(e) { 
            console.warn("Error removing listener:", e); 
        } 
        delete deviceListeners[key]; 
    } 
}

// Re-export necessary Firebase functions for other modules
export { signOut, onAuthStateChanged };
export { ref, onValue, set, update, off, get, push, remove };
