// ======================================================
// KFK MASTER LOADER
// Version : 1.0
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    getFirestore,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

import firebaseConfig from "./firebase-config.js";

class KFK {

    constructor(){

        this.app=null;
        this.auth=null;
        this.db=null;
        this.storage=null;

        this.init();

    }

    async init(){

        try{

            this.app=initializeApp(firebaseConfig);

            this.auth=getAuth(this.app);

            this.db=getFirestore(this.app);

            this.storage=getStorage(this.app);

            enableIndexedDbPersistence(this.db).catch(()=>{});

            window.KFK=this;

            console.log("Firebase Connected");

            this.listenAuth();

            document.dispatchEvent(
                new CustomEvent("kfk-ready")
            );

        }

        catch(error){

            console.error(error);

        }

    }

    listenAuth(){

        onAuthStateChanged(this.auth,user=>{

            window.currentUser=user||null;

            document.dispatchEvent(

                new CustomEvent("user-changed",{

                    detail:user

                })

            );

        });

    }

}

new KFK();
