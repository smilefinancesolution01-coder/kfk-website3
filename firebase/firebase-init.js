/**
 * KFK Marketplace - Firebase Initialization
 * Enterprise Production Ready - Firebase v12 Modular SDK
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
    //  FIREBASE CONFIGURATION
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
    //  CDN URLS
    // ============================================================
    const CDN_BASE = 'https://www.gstatic.com/firebasejs/12.0.0/';

    // ============================================================
    //  LOAD FIREBASE MODULES
    // ============================================================
    async function loadFirebaseModules() {
        try {
            // ----- APP -----
            const appModule = await import(CDN_BASE + 'firebase-app.js');
            const { initializeApp, getApp, getApps } = appModule;

            let app;
            if (getApps().length === 0) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            window.app = app;

            // ----- FIRESTORE -----
            const firestoreModule = await import(CDN_BASE + 'firebase-firestore.js');
            const {
                getFirestore,
                collection,
                collectionGroup,
                doc,
                getDoc,
                getDocs,
                addDoc,
                setDoc,
                updateDoc,
                deleteDoc,
                writeBatch,
                runTransaction,
                getCountFromServer,
                query,
                where,
                orderBy,
                limit,
                limitToLast,
                startAfter,
                startAt,
                endAt,
                endBefore,
                onSnapshot,
                serverTimestamp,
                Timestamp,
                increment,
                arrayUnion,
                arrayRemove,
                connectFirestoreEmulator
            } = firestoreModule;

            const db = getFirestore(app);
            window.db = db;

            window.firestoreFunctions = {
                collection,
                collectionGroup,
                doc,
                getDoc,
                getDocs,
                addDoc,
                setDoc,
                updateDoc,
                deleteDoc,
                writeBatch,
                runTransaction,
                getCountFromServer,
                query,
                where,
                orderBy,
                limit,
                limitToLast,
                startAfter,
                startAt,
                endAt,
                endBefore,
                onSnapshot,
                serverTimestamp,
                Timestamp,
                increment,
                arrayUnion,
                arrayRemove,
                connectFirestoreEmulator,
                getFirestore
            };

            console.log('✅ Firestore Ready');

            // ----- AUTHENTICATION -----
            const authModule = await import(CDN_BASE + 'firebase-auth.js');
            const {
                getAuth,
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signOut,
                sendPasswordResetEmail,
                onAuthStateChanged,
                updateProfile,
                updatePassword,
                GoogleAuthProvider,
                FacebookAuthProvider,
                OAuthProvider,
                signInWithPopup,
                signInWithRedirect,
                sendEmailVerification,
                confirmPasswordReset,
                verifyPasswordResetCode,
                connectAuthEmulator
            } = authModule;

            const auth = getAuth(app);
            window.auth = auth;

            window.authFunctions = {
                signInWithEmailAndPassword,
                createUserWithEmailAndPassword,
                signOut,
                sendPasswordResetEmail,
                onAuthStateChanged,
                updateProfile,
                updatePassword,
                GoogleAuthProvider,
                FacebookAuthProvider,
                OAuthProvider,
                signInWithPopup,
                signInWithRedirect,
                sendEmailVerification,
                confirmPasswordReset,
                verifyPasswordResetCode,
                connectAuthEmulator,
                getAuth
            };

            console.log('✅ Authentication Ready');

            // ----- STORAGE -----
            const storageModule = await import(CDN_BASE + 'firebase-storage.js');
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

            console.log('✅ Storage Ready');

            // ----- ANALYTICS (Non-critical) -----
            try {
                const analyticsModule = await import(CDN_BASE + 'firebase-analytics.js');
                const { getAnalytics, logEvent, setUserId, setUserProperties } = analyticsModule;
                const analytics = getAnalytics(app);
                window.analytics = analytics;

                window.analyticsFunctions = {
                    getAnalytics,
                    logEvent,
                    setUserId,
                    setUserProperties
                };

                console.log('✅ Analytics Ready');
            } catch (analyticsError) {
                console.warn('Analytics not available:', analyticsError.message);
                window.analytics = null;
                window.analyticsFunctions = null;
            }

            // ----- PERFORMANCE (Non-critical) -----
            try {
                const perfModule = await import(CDN_BASE + 'firebase-performance.js');
                const { getPerformance, trace } = perfModule;
                const perf = getPerformance(app);
                window.performance = perf;
                console.log('✅ Performance Ready');
            } catch (perfError) {
                console.warn('Performance not available:', perfError.message);
                window.performance = null;
            }

            // ----- MARK READY -----
            window.FirebaseReady = true;

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('FirebaseReady', {
                detail: {
                    app: window.app,
                    db: window.db,
                    auth: window.auth,
                    storage: window.storage,
                    analytics: window.analytics
                }
            }));

            console.log('✅ Firebase Initialized');

            return {
                app: window.app,
                db: window.db,
                auth: window.auth,
                storage: window.storage,
                analytics: window.analytics
            };

        } catch (error) {
            console.error('❌ Firebase initialization failed:', error.message);

            // Retry after 3 seconds
            console.log('🔄 Retrying initialization in 3 seconds...');
            setTimeout(() => {
                loadFirebaseModules();
            }, 3000);

            throw error;
        }
    }

    // ============================================================
    //  START INITIALIZATION
    // ============================================================
    function initFirebase() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                loadFirebaseModules();
            });
        } else {
            loadFirebaseModules();
        }
    }

    // If config already exists, start immediately
    if (window.firebaseConfig && window.firebaseConfig.apiKey) {
        initFirebase();
    } else {
        // Wait for config to be set
        let configCheckAttempts = 0;
        const checkConfig = setInterval(() => {
            configCheckAttempts++;
            if (window.firebaseConfig && window.firebaseConfig.apiKey) {
                clearInterval(checkConfig);
                initFirebase();
            } else if (configCheckAttempts > 60) {
                clearInterval(checkConfig);
                console.warn('Firebase config not found after 30 seconds');
            }
        }, 500);
    }

    // ============================================================
    //  INITIAL EXPOSURE (Empty until ready)
    // ============================================================
    window.app = null;
    window.db = null;
    window.auth = null;
    window.storage = null;
    window.analytics = null;
    window.firestoreFunctions = {};
    window.authFunctions = {};
    window.firebaseStorageFunctions = {};
    window.analyticsFunctions = {};
    window.FirebaseReady = false;

})();
