// Firebase Configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAaCzz5rnxjs4rnxQ80r2ttL7lb82wwIl8",
  authDomain: "kfk-marketplace.firebaseapp.com",
  projectId: "kfk-marketplace",
  storageBucket: "kfk-marketplace.firebasestorage.app",
  messagingSenderId: "516025410635",
  appId: "1:516025410635:web:7d5fd031fd90e339d259ce",
  measurementId: "G-C04V7V6ZQW"
};

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);

const auth = getAuth(app);

const db = getFirestore(app);

export {
    app,
    analytics,
    auth,
    db
};
