// ======================================================
// KFK FIREBASE INITIALIZATION
// ======================================================

// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


// Firebase App
const app = initializeApp(window.firebaseConfig);


// Database
window.db = getFirestore(app);


// Authentication
window.auth = getAuth(app);


// Storage
window.storage = getStorage(app);


// Firestore Functions
window.firestoreFunctions = {

    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp

};

console.log("✅ Firebase Initialized Successfully");
