// Import the core Firebase SDK initialization functions from the official CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// GuardianOS Web Application Firebase Configuration Matrix
const firebaseConfig = {
  apiKey: "AIzaSyBhaPM20tIhMalxLjoCklmwy4qb1ZkraSo",
  authDomain: "guardianos-30b18.firebaseapp.com",
  databaseURL: "https://guardianos-30b18-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "guardianos-30b18",
  storageBucket: "guardianos-30b18.firebasestorage.app",
  messagingSenderId: "323558398331",
  appId: "1:323558398331:web:447804f7328e78af7705de",
  measurementId: "G-KB3V52N7B3"
};

// Initialize the GuardianOS Firebase Core Instance
const app = initializeApp(firebaseConfig);

// Initialize Security and Database Services
export const auth = getAuth(app);
export const database = getDatabase(app);
