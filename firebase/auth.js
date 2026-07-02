import { auth } from "./firebase-config.js";

import {
signInWithEmailAndPassword,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ==========================
// LOGIN
// ==========================

export async function adminLogin(email, password) {

return await signInWithEmailAndPassword(
auth,
email,
password
);

}

// ==========================
// LOGOUT
// ==========================

export async function adminLogout() {

return await signOut(auth);

}

// ==========================
// CHECK LOGIN
// ==========================

export function checkLogin(callback){

onAuthStateChanged(auth,(user)=>{

callback(user);

});

}
