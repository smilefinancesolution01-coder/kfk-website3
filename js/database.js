// ===========================================
// KFK DATABASE ENGINE
// Part 1 (FINAL)
// ===========================================

(function () {

async function startDatabase(){

    // Firebase Load Hone Ka Wait
    while(!window.db || !window.firestoreFunctions){
        await new Promise(r=>setTimeout(r,100));
    }

    const db = window.db;

    const {
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
    } = window.firestoreFunctions;


    // ===========================================
    // MAIN OBJECT
    // ===========================================

    window.DB = {};



    class CollectionManager{

        constructor(name){

            this.name=name;

            this.ref=collection(db,name);

        }


        async all(){

            const snap=await getDocs(this.ref);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }



        async get(id){

            const snap=await getDoc(doc(db,this.name,id));

            if(!snap.exists()) return null;

            return{

                id:snap.id,

                ...snap.data()

            };

        }



        async add(data){

            data.createdAt=serverTimestamp();

            data.updatedAt=serverTimestamp();

            const ref=await addDoc(this.ref,data);

            return ref.id;

        }



        async set(id,data){

            data.updatedAt=serverTimestamp();

            await setDoc(doc(db,this.name,id),data);

            return true;

        }



        async update(id,data){

            data.updatedAt=serverTimestamp();

            await updateDoc(doc(db,this.name,id),data);

            return true;

        }



        async delete(id){

            await deleteDoc(doc(db,this.name,id));

            return true;

        }



        listen(callback){

            return onSnapshot(this.ref,(snap)=>{

                const rows=[];

                snap.forEach(d=>{

                    rows.push({

                        id:d.id,

                        ...d.data()

                    });

                });

                callback(rows);

            });

        }



        async where(field,operator,value){

            const q=query(

                this.ref,

                where(field,operator,value)

            );

            const snap=await getDocs(q);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }



        async latest(max=20){

            const q=query(

                this.ref,

                orderBy("createdAt","desc"),

                limit(max)

            );

            const snap=await getDocs(q);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }

    }



    // ===========================================
    // Collections
    // ===========================================

    DB.Products=new CollectionManager("products");
    DB.Categories=new CollectionManager("categories");
    DB.Customers=new CollectionManager("customers");
    DB.Orders=new CollectionManager("orders");
    DB.Inventory=new CollectionManager("inventory");
    DB.Homepage=new CollectionManager("homepage");
    DB.Settings=new CollectionManager("settings");
    DB.CRM=new CollectionManager("crm");
    DB.Franchise=new CollectionManager("franchise");
    DB.CloudKitchen=new CollectionManager("cloudKitchen");
    DB.Offers=new CollectionManager("offers");
    DB.Blogs=new CollectionManager("blogs");
    DB.Testimonials=new CollectionManager("testimonials");
    DB.Partners=new CollectionManager("partners");
    DB.Analytics=new CollectionManager("analytics");
    DB.Reports=new CollectionManager("reports");

// ===========================================
// DATABASE ENGINE PART 2
// Advanced Functions
// ===========================================


// Total Documents
CollectionManager.prototype.count = async function () {

    const snap = await getDocs(this.ref);

    return snap.size;

};


// Exists
CollectionManager.prototype.exists = async function (id) {

    const snap = await getDoc(doc(db, this.name, id));

    return snap.exists();

};


// Search
CollectionManager.prototype.search = async function (field, keyword) {

    const snap = await getDocs(this.ref);

    const rows = [];

    snap.forEach(d => {

        const data = d.data();

        const value = String(data[field] || "").toLowerCase();

        if (value.includes(keyword.toLowerCase())) {

            rows.push({

                id: d.id,

                ...data

            });

        }

    });

    return rows;

};


// Pagination
CollectionManager.prototype.page = async function (page = 1, size = 20) {

    const snap = await getDocs(this.ref);

    const rows = snap.docs.map(d => ({

        id: d.id,

        ...d.data()

    }));

    const start = (page - 1) * size;

    return rows.slice(start, start + size);

};


// Batch Add
CollectionManager.prototype.addMany = async function (list = []) {

    const ids = [];

    for (const item of list) {

        item.createdAt = serverTimestamp();

        item.updatedAt = serverTimestamp();

        const ref = await addDoc(this.ref, item);

        ids.push(ref.id);

    }

    return ids;

};


// Batch Update
CollectionManager.prototype.updateMany = async function (list = []) {

    for (const item of list) {

        if (!item.id) continue;

        const id = item.id;

        delete item.id;

        item.updatedAt = serverTimestamp();

        await updateDoc(doc(db, this.name, id), item);

    }

    return true;

};


// Batch Delete
CollectionManager.prototype.deleteMany = async function (ids = []) {

    for (const id of ids) {

        await deleteDoc(doc(db, this.name, id));

    }

    return true;

};


// First Document
CollectionManager.prototype.first = async function () {

    const list = await this.latest(1);

    return list.length ? list[0] : null;

};


// Last Document
CollectionManager.prototype.last = async function () {

    const snap = await getDocs(this.ref);

    const rows = snap.docs.map(d => ({

        id: d.id,

        ...d.data()

    }));

    return rows.length ? rows[rows.length - 1] : null;

};


// Clear Collection
CollectionManager.prototype.clear = async function () {

    const snap = await getDocs(this.ref);

    for (const d of snap.docs) {

        await deleteDoc(doc(db, this.name, d.id));

    }

    return true;

};


// Export Collection
CollectionManager.prototype.export = async function () {

    return await this.all();

};


// Import Collection
CollectionManager.prototype.import = async function (rows = []) {

    for (const row of rows) {

        delete row.id;

        row.createdAt = serverTimestamp();

        row.updatedAt = serverTimestamp();

        await addDoc(this.ref, row);

    }

    return true;

};


// Live Count
CollectionManager.prototype.liveCount = function (callback) {

    return onSnapshot(this.ref, snap => {

        callback(snap.size);

    });

};

    // ===========================================
// DATABASE ENGINE PART 3A
// Dashboard Analytics Engine
// ===========================================


// Dashboard Analytics
DB.Dashboard = {};


// Total Products
DB.Dashboard.totalProducts = async function () {

    return await DB.Products.count();

};


// Total Customers
DB.Dashboard.totalCustomers = async function () {

    return await DB.Customers.count();

};


// Total Orders
DB.Dashboard.totalOrders = async function () {

    return await DB.Orders.count();

};


// Total Categories
DB.Dashboard.totalCategories = async function () {

    return await DB.Categories.count();

};


// Pending Orders
DB.Dashboard.pendingOrders = async function () {

    const rows = await DB.Orders.where("status","==","Pending");

    return rows.length;

};


// Delivered Orders
DB.Dashboard.deliveredOrders = async function () {

    const rows = await DB.Orders.where("status","==","Delivered");

    return rows.length;

};


// Cancelled Orders
DB.Dashboard.cancelledOrders = async function () {

    const rows = await DB.Orders.where("status","==","Cancelled");

    return rows.length;

};


// Low Stock Products
DB.Dashboard.lowStock = async function (limitStock = 10) {

    const rows = await DB.Inventory.all();

    return rows.filter(item => {

        return Number(item.stock || 0) <= limitStock;

    });

};


// Recent Orders
DB.Dashboard.recentOrders = async function (max = 10) {

    return await DB.Orders.latest(max);

};


// Recent Customers
DB.Dashboard.recentCustomers = async function (max = 10) {

    return await DB.Customers.latest(max);

};


// Recent Products
DB.Dashboard.recentProducts = async function (max = 10) {

    return await DB.Products.latest(max);

};


// Live Dashboard
DB.Dashboard.listen = function (callback){

    const unsubs = [];

    unsubs.push(DB.Products.listen(()=>callback()));

    unsubs.push(DB.Customers.listen(()=>callback()));

    unsubs.push(DB.Orders.listen(()=>callback()));

    unsubs.push(DB.Inventory.listen(()=>callback()));

    return ()=>{

        unsubs.forEach(fn=>fn());

    };

};


// Dashboard Summary
DB.Dashboard.summary = async function(){

    return{

        products:await DB.Dashboard.totalProducts(),

        customers:await DB.Dashboard.totalCustomers(),

        orders:await DB.Dashboard.totalOrders(),

        categories:await DB.Dashboard.totalCategories(),

        pending:await DB.Dashboard.pendingOrders(),

        delivered:await DB.Dashboard.deliveredOrders(),

        cancelled:await DB.Dashboard.cancelledOrders(),

        lowStock:(await DB.Dashboard.lowStock()).length

    };

};


console.log("✅ Database Part 3A Loaded");

    // ===========================================
// DATABASE ENGINE PART 3B
// Revenue & Sales Engine
// ===========================================

DB.AnalyticsEngine = {};


// Total Revenue
DB.AnalyticsEngine.totalRevenue = async function(){

    const orders = await DB.Orders.all();

    let total = 0;

    orders.forEach(order=>{

        if(order.status==="Delivered"){

            total += Number(order.amount || order.total || 0);

        }

    });

    return total;

};


// Today's Revenue
DB.AnalyticsEngine.todayRevenue = async function(){

    const today = new Date().toISOString().substring(0,10);

    const orders = await DB.Orders.all();

    let total = 0;

    orders.forEach(order=>{

        const date = String(order.createdDate || order.date || "").substring(0,10);

        if(date===today){

            total += Number(order.amount || order.total || 0);

        }

    });

    return total;

};


// Monthly Revenue
DB.AnalyticsEngine.monthRevenue = async function(){

    const month = new Date().getMonth()+1;
    const year = new Date().getFullYear();

    const orders = await DB.Orders.all();

    let total = 0;

    orders.forEach(order=>{

        const d = new Date(order.createdDate || order.date);

        if(
            d.getMonth()+1===month &&
            d.getFullYear()===year
        ){

            total += Number(order.amount || order.total || 0);

        }

    });

    return total;

};


// Average Order Value
DB.AnalyticsEngine.averageOrder = async function(){

    const orders = await DB.Orders.all();

    if(!orders.length) return 0;

    let total = 0;

    orders.forEach(order=>{

        total += Number(order.amount || order.total || 0);

    });

    return Math.round(total/orders.length);

};


// Top Selling Products
DB.AnalyticsEngine.topProducts = async function(limit=10){

    const orders = await DB.Orders.all();

    const map = {};

    orders.forEach(order=>{

        const items = order.items || [];

        items.forEach(item=>{

            const name = item.name || "Unknown";

            map[name] = (map[name] || 0) + Number(item.qty || 1);

        });

    });

    return Object.entries(map)

        .sort((a,b)=>b[1]-a[1])

        .slice(0,limit)

        .map(x=>({

            product:x[0],

            sold:x[1]

        }));

};


// Sales By Month
DB.AnalyticsEngine.salesChart = async function(){

    const orders = await DB.Orders.all();

    const months = Array(12).fill(0);

    orders.forEach(order=>{

        const d = new Date(order.createdDate || order.date);

        const m = d.getMonth();

        months[m] += Number(order.amount || order.total || 0);

    });

    return months;

};


// Live Revenue
DB.AnalyticsEngine.listenRevenue = function(callback){

    return DB.Orders.listen(async()=>{

        callback({

            totalRevenue:await DB.AnalyticsEngine.totalRevenue(),

            todayRevenue:await DB.AnalyticsEngine.todayRevenue(),

            monthRevenue:await DB.AnalyticsEngine.monthRevenue(),

            averageOrder:await DB.AnalyticsEngine.averageOrder()

        });

    });

};


console.log("✅ Database Part 3B Loaded");

  // ===========================================
// DATABASE ENGINE PART 3C
// Notification + Activity + Dashboard Engine
// ===========================================

DB.Notifications = {};

DB.Activity = {};


// ================================
// Notification Add
// ================================

DB.Notifications.add = async function(title,message,type="info"){

    return await DB.NotificationsCollection.add({

        title,

        message,

        type,

        read:false,

        createdDate:new Date().toISOString()

    });

};


// ================================
// Notification Collection
// ================================

DB.NotificationsCollection =
new CollectionManager("notifications");


// ================================
// Get Notifications
// ================================

DB.Notifications.all = async function(){

    return await DB.NotificationsCollection.latest(50);

};


// ================================
// Live Notifications
// ================================

DB.Notifications.listen=function(callback){

    return DB.NotificationsCollection.listen(callback);

};


// ================================
// Activity Collection
// ================================

DB.ActivityCollection =
new CollectionManager("activityLogs");


// ================================
// Add Activity
// ================================

DB.Activity.add=async function(action,user="System"){

    return await DB.ActivityCollection.add({

        action,

        user,

        createdDate:new Date().toISOString()

    });

};


// ================================
// Recent Activities
// ================================

DB.Activity.latest=async function(){

    return await DB.ActivityCollection.latest(30);

};


// ================================
// Dashboard Cards
// ================================

DB.Dashboard.cards=async function(){

    return{

        revenue:await DB.AnalyticsEngine.totalRevenue(),

        todayRevenue:await DB.AnalyticsEngine.todayRevenue(),

        monthRevenue:await DB.AnalyticsEngine.monthRevenue(),

        orders:await DB.Dashboard.totalOrders(),

        customers:await DB.Dashboard.totalCustomers(),

        products:await DB.Dashboard.totalProducts(),

        pending:await DB.Dashboard.pendingOrders(),

        delivered:await DB.Dashboard.deliveredOrders(),

        cancelled:await DB.Dashboard.cancelledOrders(),

        lowStock:(await DB.Dashboard.lowStock()).length

    };

};


// ================================
// Live Dashboard
// ================================

DB.Dashboard.live=function(callback){

    return DB.Orders.listen(async()=>{

        callback(await DB.Dashboard.cards());

    });

};


// ================================
// Inventory Value
// ================================

DB.Inventory.totalValue=async function(){

    const items=await DB.Inventory.all();

    let total=0;

    items.forEach(item=>{

        total +=
        Number(item.stock||0) *
        Number(item.price||0);

    });

    return total;

};


// ================================
// Customer Growth
// ================================

DB.Customers.today=async function(){

    const today=new Date().toISOString().substring(0,10);

    const rows=await DB.Customers.all();

    return rows.filter(r=>{

        return String(
            r.createdDate||""
        ).startsWith(today);

    }).length;

};


// ================================
// Auto Refresh
// ================================

DB.refresh=async function(){

    return{

        dashboard:await DB.Dashboard.cards(),

        revenue:await DB.AnalyticsEngine.totalRevenue(),

        inventory:await DB.Inventory.totalValue(),

        activities:await DB.Activity.latest(),

        notifications:await DB.Notifications.all()

    };

};


console.log("✅ Database Part 3C Loaded"); 
// ===========================================
// DATABASE ENGINE PART 4A (FINAL)
// Universal Database Helpers
// ===========================================

// Version
DB.version = "1.0.0";

// Current Time
DB.now = function () {
    return new Date().toISOString();
};

// Firestore Server Time
DB.serverTime = function () {
    return serverTimestamp();
};

// Random ID
DB.uid = function (length = 20) {

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let id = "";

    for (let i = 0; i < length; i++) {

        id += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );

    }

    return id;

};


// Universal Collection
DB.collection = function (name) {

    return new CollectionManager(name);

};


// Universal CRUD

DB.add = async function (collectionName, data) {

    return await DB.collection(collectionName).add(data);

};

DB.get = async function (collectionName, id) {

    return await DB.collection(collectionName).get(id);

};

DB.update = async function (collectionName, id, data) {

    return await DB.collection(collectionName).update(id, data);

};

DB.set = async function (collectionName, id, data) {

    return await DB.collection(collectionName).set(id, data);

};

DB.delete = async function (collectionName, id) {

    return await DB.collection(collectionName).delete(id);

};

DB.all = async function (collectionName) {

    return await DB.collection(collectionName).all();

};

DB.where = async function (collectionName, field, operator, value) {

    return await DB.collection(collectionName).where(
        field,
        operator,
        value
    );

};

DB.latest = async function (collectionName, max = 20) {

    return await DB.collection(collectionName).latest(max);

};

DB.listen = function (collectionName, callback) {

    return DB.collection(collectionName).listen(callback);

};


// Database Information

DB.info = function () {

    return {

        project: firebaseConfig.projectId,

        authDomain: firebaseConfig.authDomain,

        version: DB.version,

        connected: true,

        time: DB.now()

    };

};


// Database Ping

DB.ping = async function () {

    try {

        await DB.Products.all();

        return true;

    } catch (e) {

        console.error(e);

        return false;

    }

};


console.log("✅ Database Part 4A Loaded");

 // ===========================================
// DATABASE ENGINE PART 4B
// Firebase Storage Engine
// ===========================================

// Check Storage
if (!window.storage) {

    console.warn("Firebase Storage Not Initialized.");

}else{

    DB.Storage = {};

}


// ===========================================
// Upload Image
// ===========================================

DB.Storage.uploadImage = async function(file, folder = "images") {

    const {
        ref,
        uploadBytes,
        getDownloadURL
    } = window.firebaseStorageFunctions;

    const fileName =
        Date.now() + "_" + file.name;

    const storageRef =
        ref(storage, folder + "/" + fileName);

    await uploadBytes(storageRef, file);

    return await getDownloadURL(storageRef);

};


// ===========================================
// Upload File
// ===========================================

DB.Storage.uploadFile = async function(file, folder = "files") {

    const {
        ref,
        uploadBytes,
        getDownloadURL
    } = window.firebaseStorageFunctions;

    const fileName =
        Date.now() + "_" + file.name;

    const storageRef =
        ref(storage, folder + "/" + fileName);

    await uploadBytes(storageRef, file);

    return await getDownloadURL(storageRef);

};


// ===========================================
// Delete File
// ===========================================

DB.Storage.deleteFile = async function(path){

    const {
        ref,
        deleteObject
    } = window.firebaseStorageFunctions;

    await deleteObject(
        ref(storage,path)
    );

    return true;

};


// ===========================================
// Upload Customer Photo
// ===========================================

DB.Storage.customerPhoto = async function(file){

    return await DB.Storage.uploadImage(

        file,

        "customers"

    );

};


// ===========================================
// Upload Product Image
// ===========================================

DB.Storage.productImage = async function(file){

    return await DB.Storage.uploadImage(

        file,

        "products"

    );

};


// ===========================================
// Upload Blog Image
// ===========================================

DB.Storage.blogImage = async function(file){

    return await DB.Storage.uploadImage(

        file,

        "blogs"

    );

};


// ===========================================
// Upload Franchise Document
// ===========================================

DB.Storage.franchiseDoc = async function(file){

    return await DB.Storage.uploadFile(

        file,

        "franchise"

    );

};


console.log("✅ Database Part 4B Loaded");   
// ===========================================
// DATABASE ENGINE PART 5A
// Realtime Dashboard Engine
// ===========================================

DB.Dashboard = {};

DB.Dashboard.watch = function (callback) {

    const state = {};

    const unsubscribers = [];

    const collections = [
        "products",
        "orders",
        "customers",
        "inventory",
        "franchise"
    ];

    collections.forEach(name => {

        const ref = collection(db, name);

        const unsub = onSnapshot(ref, (snap) => {

            state[name] = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            callback(state);

        });

        unsubscribers.push(unsub);

    });

    return function () {

        unsubscribers.forEach(fn => fn());

    };

};


// Dashboard Summary

DB.Dashboard.summary = function (data) {

    return {

        products: (data.products || []).length,

        orders: (data.orders || []).length,

        customers: (data.customers || []).length,

        inventory: (data.inventory || []).length,

        franchise: (data.franchise || []).length

    };

};

console.log("✅ Database Part 5A Loaded");
    
console.log("✅ Database Part 4A Loaded");
console.log("✅ Database Part 2 Loaded");


    console.log("✅ KFK Database Engine Loaded");

}

startDatabase();

})();
