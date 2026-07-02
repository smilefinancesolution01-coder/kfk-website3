// =========================================
// KFK Marketplace Firestore Module
// =========================================

import {
collection,
doc,
getDoc,
getDocs,
addDoc,
updateDoc,
deleteDoc,
setDoc,
query,
where,
orderBy,
limit,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-config.js";

// =========================================
// COLLECTIONS
// =========================================

const PRODUCTS = "products";
const CATEGORIES = "categories";
const ORDERS = "orders";
const USERS = "users";
const HOMEPAGE = "homepage";
const OFFERS = "offers";
const SETTINGS = "settings";
const BANNERS = "banners";

// =========================================
// PRODUCTS
// =========================================

export async function getProducts() {

const snapshot = await getDocs(collection(db, PRODUCTS));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

export async function getProduct(id) {

const snap = await getDoc(doc(db, PRODUCTS, id));

if (!snap.exists()) return null;

return {
id: snap.id,
...snap.data()
};

}

export async function addProduct(product) {

return await addDoc(
collection(db, PRODUCTS),
{
...product,
createdAt: serverTimestamp()
}
);

}

export async function updateProduct(id, data) {

return await updateDoc(
doc(db, PRODUCTS, id),
data
);

}

export async function deleteProduct(id) {

return await deleteDoc(
doc(db, PRODUCTS, id)
);

}

// =========================================
// CATEGORIES
// =========================================

export async function getCategories() {

const snapshot = await getDocs(collection(db, CATEGORIES));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

// =========================================
// HOMEPAGE
// =========================================

export async function getHomepageData() {

const snapshot = await getDocs(collection(db, HOMEPAGE));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

// =========================================
// OFFERS
// =========================================

export async function getOffers() {

const snapshot = await getDocs(collection(db, OFFERS));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

// =========================================
// BANNERS
// =========================================

export async function getBanners() {

const snapshot = await getDocs(collection(db, BANNERS));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

// =========================================
// SETTINGS
// =========================================

export async function getSettings() {

const snapshot = await getDocs(collection(db, SETTINGS));

return snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

}

// =========================================
// ORDERS
// =========================================

export async function createOrder(order) {

return await addDoc(
collection(db, ORDERS),
{
...order,
status: "Pending",
createdAt: serverTimestamp()
}
);

}

// =========================================
// USERS
// =========================================

export async function saveUser(uid, data) {

return await setDoc(
doc(db, USERS, uid),
data,
{ merge: true }
);

}
