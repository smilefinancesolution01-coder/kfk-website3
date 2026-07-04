/**
 * KFK Marketplace - Firebase Initialization
 * Production Ready - Firebase Modular SDK v12
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete Firebase initialization with all required services.
 * Exposes global objects for the entire application.
 */

(function() {
    'use strict';

    // ============================================================
    //  CONFIGURATION
    // ============================================================
    const firebaseConfig = window.firebaseConfig || {
        apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abcdef1234567890",
        measurementId: "G-XXXXXXXXXX"
    };

    // ============================================================
    //  IMPORT FIREBASE MODULES
    // ============================================================
    const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
    const FIRESTORE_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
    const AUTH_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
    const STORAGE_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js';
    const ANALYTICS_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js';
    const PERF_CDN = 'https://www.gstatic.com/firebasejs/12.0.0/firebase-performance.js';

    // ============================================================
    //  LOAD FIREBASE MODULES DYNAMICALLY
    // ============================================================
    async function loadFirebaseModules() {
        try {
            // Load Firebase App
            const appModule = await import(FIREBASE_CDN);
            const { initializeApp, getApp, getApps } = appModule;

            // Initialize App
            let app;
            if (getApps().length === 0) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            window.app = app;

            console.log('✅ Firebase App initialized');

            // Load Firestore
            const firestoreModule = await import(FIRESTORE_CDN);
            const {
                getFirestore,
                collection,
                collectionGroup,
                doc,
                getDoc,
                getDocs,
                setDoc,
                addDoc,
                updateDoc,
                deleteDoc,
                query,
                where,
                orderBy,
                limit,
                limitToLast,
                startAfter,
                startAt,
                endBefore,
                endAt,
                onSnapshot,
                serverTimestamp,
                Timestamp,
                increment,
                arrayUnion,
                arrayRemove,
                writeBatch,
                runTransaction,
                getCountFromServer,
                connectFirestoreEmulator
            } = firestoreModule;

            const db = getFirestore(app);
            window.db = db;

            // Expose Firestore functions
            window.firestoreFunctions = {
                collection,
                collectionGroup,
                doc,
                getDoc,
                getDocs,
                setDoc,
                addDoc,
                updateDoc,
                deleteDoc,
                query,
                where,
                orderBy,
                limit,
                limitToLast,
                startAfter,
                startAt,
                endBefore,
                endAt,
                onSnapshot,
                serverTimestamp,
                Timestamp,
                increment,
                arrayUnion,
                arrayRemove,
                writeBatch,
                runTransaction,
                getCountFromServer,
                connectFirestoreEmulator,
                // Additional utilities
                getFirestore,
                FieldValue: {
                    serverTimestamp,
                    increment,
                    arrayUnion,
                    arrayRemove
                }
            };

            console.log('✅ Firestore initialized');

            // Load Authentication
            const authModule = await import(AUTH_CDN);
            const {
                getAuth,
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signInWithPopup,
                GoogleAuthProvider,
                sendPasswordResetEmail,
                updateProfile,
                signOut,
                onAuthStateChanged,
                connectAuthEmulator,
                setPersistence,
                browserLocalPersistence,
                browserSessionPersistence
            } = authModule;

            const auth = getAuth(app);
            window.auth = auth;

            // Expose Auth functions
            window.authFunctions = {
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signInWithPopup,
                GoogleAuthProvider,
                sendPasswordResetEmail,
                updateProfile,
                signOut,
                onAuthStateChanged,
                connectAuthEmulator,
                setPersistence,
                browserLocalPersistence,
                browserSessionPersistence,
                getAuth
            };

            console.log('✅ Authentication initialized');

            // Load Storage
            const storageModule = await import(STORAGE_CDN);
            const {
                getStorage,
                ref,
                uploadBytes,
                uploadBytesResumable,
                getDownloadURL,
                deleteObject,
                listAll,
                getMetadata,
                connectStorageEmulator
            } = storageModule;

            const storage = getStorage(app);
            window.storage = storage;

            // Expose Storage functions
            window.firebaseStorageFunctions = {
                ref,
                uploadBytes,
                uploadBytesResumable,
                getDownloadURL,
                deleteObject,
                listAll,
                getMetadata,
                connectStorageEmulator,
                getStorage
            };

            console.log('✅ Storage initialized');

            // Load Analytics (non-critical, catch errors)
            try {
                const analyticsModule = await import(ANALYTICS_CDN);
                const { getAnalytics, logEvent, setCurrentScreen, setUserId } = analyticsModule;
                const analytics = getAnalytics(app);
                window.analytics = analytics;
                window.analyticsFunctions = {
                    getAnalytics,
                    logEvent,
                    setCurrentScreen,
                    setUserId
                };
                console.log('✅ Analytics initialized');
            } catch (analyticsError) {
                console.warn('⚠️ Analytics not available (non-critical):', analyticsError.message);
                window.analytics = null;
                window.analyticsFunctions = null;
            }

            // Load Performance (optional, catch errors)
            try {
                const perfModule = await import(PERF_CDN);
                const { getPerformance } = perfModule;
                const perf = getPerformance(app);
                window.performance = perf;
                console.log('✅ Performance monitoring initialized');
            } catch (perfError) {
                console.warn('⚠️ Performance monitoring not available (non-critical):', perfError.message);
                window.performance = null;
            }

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('firebaseReady', {
                detail: {
                    app: window.app,
                    db: window.db,
                    auth: window.auth,
                    storage: window.storage,
                    analytics: window.analytics
                }
            }));

            console.log('🚀 KFK Firebase fully initialized');
            console.log('📊 Firestore Functions:', Object.keys(window.firestoreFunctions).length);
            console.log('🔐 Auth Functions:', Object.keys(window.authFunctions).length);
            console.log('💾 Storage Functions:', Object.keys(window.firebaseStorageFunctions).length);

            return {
                app: window.app,
                db: window.db,
                auth: window.auth,
                storage: window.storage,
                analytics: window.analytics
            };

        } catch (error) {
            console.error('❌ Failed to initialize Firebase:', error);
            console.error('Error details:', error.message);
            
            // Retry after delay
            console.log('🔄 Retrying initialization in 2 seconds...');
            setTimeout(() => {
                loadFirebaseModules();
            }, 2000);
            
            throw error;
        }
    }

    // ============================================================
    //  START INITIALIZATION
    // ============================================================
    // Wait for DOM ready
    function initFirebase() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                loadFirebaseModules();
            });
        } else {
            loadFirebaseModules();
        }
    }

    // If firebaseConfig is already available, start immediately
    if (window.firebaseConfig && window.firebaseConfig.apiKey) {
        initFirebase();
    } else {
        // Wait for firebaseConfig to be set
        window.addEventListener('firebaseConfigReady', () => {
            initFirebase();
        });
        
        // Check if config becomes available via polling
        let attempts = 0;
        const checkConfig = setInterval(() => {
            attempts++;
            if (window.firebaseConfig && window.firebaseConfig.apiKey) {
                clearInterval(checkConfig);
                initFirebase();
            } else if (attempts > 30) {
                clearInterval(checkConfig);
                console.warn('⚠️ Firebase config not found after 30 attempts');
            }
        }, 500);
    }

    // ============================================================
    //  GLOBAL FALLBACKS
    // ============================================================
    // Provide empty objects if initialization fails
    if (!window.firestoreFunctions) {
        window.firestoreFunctions = {};
    }
    if (!window.authFunctions) {
        window.authFunctions = {};
    }
    if (!window.firebaseStorageFunctions) {
        window.firebaseStorageFunctions = {};
    }

    console.log('📦 KFK Firebase Init Module loaded');

})();
