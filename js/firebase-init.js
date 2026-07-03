// ======================================================
// KFK Firebase Initialization
// Version : Enterprise Final
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";

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
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getStorage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


// ==========================================
// Initialize Firebase
// ==========================================

const app = initializeApp(window.firebaseConfig);


// ==========================================
// Analytics
// ==========================================

const analytics = getAnalytics(app);


// ==========================================
// Firestore
// ==========================================

const db = getFirestore(app);


// ==========================================
// Authentication
// ==========================================

const auth = getAuth(app);


// ==========================================
// Storage
// ==========================================

const storage = getStorage(app);


// ==========================================
// Global Objects
// ==========================================

window.app = app;

window.db = db;

window.auth = auth;

window.storage = storage;

window.analytics = analytics;


// ==========================================
// Firestore Functions
// ==========================================

window.firestoreFunctions = {

    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp

};


// ==========================================
// Auth Functions
// ==========================================

window.authFunctions = {

    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged

};


// ==========================================
// Storage Functions
// ==========================================

window.firebaseStorageFunctions = {

    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject

};


console.log("✅ Firebase Initialized Successfully");
console.log("✅ Firestore Connected");
console.log("✅ Authentication Ready");
console.log("✅ Storage Ready");
console.log("✅ Analytics Ready");
