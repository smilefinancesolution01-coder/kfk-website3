/**
 * KFK Marketplace - Enterprise Database Engine
 * Production Ready - Firebase v11 Modular SDK
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete database abstraction layer for KFK Marketplace.
 * Supports realtime updates, CRUD operations, analytics, and more.
 */

(function() {
    'use strict';

    // ============================================================
    //  WAIT FOR FIREBASE INITIALIZATION
    // ============================================================
    function waitForFirebase(retries = 0) {
        if (window.db && window.auth && window.storage) {
            initializeDB();
            return;
        }
        if (retries > 30) {
            console.error('Firebase initialization timeout');
            return;
        }
        setTimeout(() => waitForFirebase(retries + 1), 200);
    }

    // ============================================================
    //  MAIN DB ENGINE
    // ============================================================
    function initializeDB() {
        const { db, auth, storage } = window;
        const { 
            collection, 
            doc, 
            getDoc, 
            getDocs, 
            setDoc, 
            addDoc,
            updateDoc, 
            deleteDoc, 
            onSnapshot, 
            query, 
            where, 
            orderBy, 
            limit, 
            startAfter, 
            startAt,
            endAt,
            endBefore,
            increment,
            arrayUnion,
            arrayRemove,
            serverTimestamp,
            Timestamp,
            FieldValue,
            writeBatch,
            runTransaction,
            getCountFromServer,
            collectionGroup
        } = window.firestoreFunctions || {};

        const { 
            ref, 
            uploadBytes, 
            uploadBytesResumable, 
            deleteObject, 
            getDownloadURL, 
            listAll,
            getMetadata
        } = window.firebaseStorageFunctions || {};

        // ============================================================
        //  COLLECTION MANAGER CLASS
        // ============================================================
        class CollectionManager {
            constructor(collectionName) {
                this.collectionName = collectionName;
                this.collectionRef = collection(db, collectionName);
                this.listeners = new Map();
                this.cachedData = null;
                this.cachedListeners = [];
            }

            // ---- CREATE ----
            async add(data) {
                try {
                    const docRef = await addDoc(this.collectionRef, {
                        ...data,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    return { id: docRef.id, ...data };
                } catch (error) {
                    console.error(`Error adding to ${this.collectionName}:`, error);
                    throw { code: 'DB_ADD_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async set(id, data, merge = true) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await setDoc(docRef, {
                        ...data,
                        updatedAt: serverTimestamp()
                    }, { merge });
                    return { id, ...data };
                } catch (error) {
                    console.error(`Error setting document ${id}:`, error);
                    throw { code: 'DB_SET_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async addMany(dataArray) {
                try {
                    const batch = writeBatch(db);
                    const results = [];
                    for (const data of dataArray) {
                        const docRef = doc(this.collectionRef);
                        batch.set(docRef, {
                            ...data,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                        results.push({ id: docRef.id, ...data });
                    }
                    await batch.commit();
                    return results;
                } catch (error) {
                    console.error(`Error bulk adding to ${this.collectionName}:`, error);
                    throw { code: 'DB_BULK_ADD_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- READ ----
            async all() {
                try {
                    const snapshot = await getDocs(this.collectionRef);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });
                    return results;
                } catch (error) {
                    console.error(`Error fetching all from ${this.collectionName}:`, error);
                    throw { code: 'DB_ALL_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async get(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    const snapshot = await getDoc(docRef);
                    if (!snapshot.exists()) {
                        return null;
                    }
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`Error getting document ${id}:`, error);
                    throw { code: 'DB_GET_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async first() {
                try {
                    const q = query(this.collectionRef, limit(1));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) return null;
                    const doc = snapshot.docs[0];
                    return { id: doc.id, ...doc.data() };
                } catch (error) {
                    console.error(`Error getting first from ${this.collectionName}:`, error);
                    throw { code: 'DB_FIRST_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async last() {
                try {
                    const q = query(this.collectionRef, orderBy('createdAt', 'desc'), limit(1));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) return null;
                    const doc = snapshot.docs[0];
                    return { id: doc.id, ...doc.data() };
                } catch (error) {
                    console.error(`Error getting last from ${this.collectionName}:`, error);
                    throw { code: 'DB_LAST_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async exists(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    const snapshot = await getDoc(docRef);
                    return snapshot.exists();
                } catch (error) {
                    console.error(`Error checking existence of ${id}:`, error);
                    throw { code: 'DB_EXISTS_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async count() {
                try {
                    const snapshot = await getCountFromServer(this.collectionRef);
                    return snapshot.data().count;
                } catch (error) {
                    console.error(`Error counting ${this.collectionName}:`, error);
                    throw { code: 'DB_COUNT_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async liveCount(callback) {
                try {
                    const unsubscribe = onSnapshot(this.collectionRef, (snapshot) => {
                        callback(snapshot.size);
                    }, (error) => {
                        console.error(`Error in live count for ${this.collectionName}:`, error);
                        callback(null, error);
                    });
                    return unsubscribe;
                } catch (error) {
                    console.error(`Error setting up live count for ${this.collectionName}:`, error);
                    throw { code: 'DB_LIVE_COUNT_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- UPDATE ----
            async update(id, data) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await updateDoc(docRef, {
                        ...data,
                        updatedAt: serverTimestamp()
                    });
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`Error updating document ${id}:`, error);
                    throw { code: 'DB_UPDATE_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async updateMany(ids, data) {
                try {
                    const batch = writeBatch(db);
                    const results = [];
                    for (const id of ids) {
                        const docRef = doc(this.collectionRef, id);
                        batch.update(docRef, {
                            ...data,
                            updatedAt: serverTimestamp()
                        });
                        results.push(id);
                    }
                    await batch.commit();
                    return results;
                } catch (error) {
                    console.error(`Error bulk updating ${this.collectionName}:`, error);
                    throw { code: 'DB_BULK_UPDATE_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- DELETE ----
            async delete(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await deleteDoc(docRef);
                    return { id, deleted: true };
                } catch (error) {
                    console.error(`Error deleting document ${id}:`, error);
                    throw { code: 'DB_DELETE_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async deleteMany(ids) {
                try {
                    const batch = writeBatch(db);
                    for (const id of ids) {
                        const docRef = doc(this.collectionRef, id);
                        batch.delete(docRef);
                    }
                    await batch.commit();
                    return { deleted: ids.length };
                } catch (error) {
                    console.error(`Error bulk deleting from ${this.collectionName}:`, error);
                    throw { code: 'DB_BULK_DELETE_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async clear() {
                try {
                    const snapshot = await getDocs(this.collectionRef);
                    const batch = writeBatch(db);
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    return { deleted: snapshot.size };
                } catch (error) {
                    console.error(`Error clearing ${this.collectionName}:`, error);
                    throw { code: 'DB_CLEAR_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- QUERY ----
            where(field, operator, value) {
                return {
                    _query: query(this.collectionRef, where(field, operator, value)),
                    _collection: this,
                    async exec() {
                        try {
                            const snapshot = await getDocs(this._query);
                            const results = [];
                            snapshot.forEach(doc => {
                                results.push({ id: doc.id, ...doc.data() });
                            });
                            return results;
                        } catch (error) {
                            console.error(`Error executing where query:`, error);
                            throw { code: 'DB_WHERE_ERROR', message: error.message };
                        }
                    },
                    listen(callback) {
                        return onSnapshot(this._query, (snapshot) => {
                            const results = [];
                            snapshot.forEach(doc => {
                                results.push({ id: doc.id, ...doc.data() });
                            });
                            callback(results);
                        }, (error) => {
                            console.error('Error in where listener:', error);
                            callback(null, error);
                        });
                    }
                };
            }

            search(field, searchTerm) {
                // Simple search - use array-contains or string matching
                const searchLower = searchTerm.toLowerCase();
                return {
                    _collection: this,
                    async exec() {
                        try {
                            const all = await this._collection.all();
                            return all.filter(item => {
                                const value = item[field] || '';
                                return String(value).toLowerCase().includes(searchLower);
                            });
                        } catch (error) {
                            console.error('Error in search:', error);
                            throw { code: 'DB_SEARCH_ERROR', message: error.message };
                        }
                    }
                };
            }

            async latest(limitNum = 10) {
                try {
                    const q = query(this.collectionRef, orderBy('createdAt', 'desc'), limit(limitNum));
                    const snapshot = await getDocs(q);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });
                    return results;
                } catch (error) {
                    console.error(`Error getting latest from ${this.collectionName}:`, error);
                    throw { code: 'DB_LATEST_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async page(pageNumber = 1, pageSize = 20) {
                try {
                    const startIndex = (pageNumber - 1) * pageSize;
                    let q = query(this.collectionRef, orderBy('createdAt', 'desc'), limit(pageSize));
                    
                    // Handle pagination with startAfter
                    if (pageNumber > 1) {
                        const previousPage = query(this.collectionRef, orderBy('createdAt', 'desc'), limit(startIndex));
                        const prevSnapshot = await getDocs(previousPage);
                        const lastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
                        if (lastDoc) {
                            q = query(this.collectionRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
                        }
                    }
                    
                    const snapshot = await getDocs(q);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });
                    return {
                        items: results,
                        page: pageNumber,
                        pageSize: pageSize,
                        total: await this.count()
                    };
                } catch (error) {
                    console.error(`Error paginating ${this.collectionName}:`, error);
                    throw { code: 'DB_PAGE_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- REALTIME ----
            listen(callback, filters = null) {
                try {
                    let q = this.collectionRef;
                    if (filters) {
                        const { field, operator, value } = filters;
                        q = query(this.collectionRef, where(field, operator, value));
                    }
                    
                    const unsubscribe = onSnapshot(q, (snapshot) => {
                        const results = [];
                        snapshot.forEach(doc => {
                            results.push({ id: doc.id, ...doc.data() });
                        });
                        callback(results);
                    }, (error) => {
                        console.error(`Error in listener for ${this.collectionName}:`, error);
                        callback(null, error);
                    });
                    
                    return unsubscribe;
                } catch (error) {
                    console.error(`Error setting up listener for ${this.collectionName}:`, error);
                    throw { code: 'DB_LISTEN_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            // ---- EXPORT / IMPORT ----
            async export() {
                try {
                    const data = await this.all();
                    const json = JSON.stringify(data, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.collectionName}_export_${new Date().toISOString()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    return data;
                } catch (error) {
                    console.error(`Error exporting ${this.collectionName}:`, error);
                    throw { code: 'DB_EXPORT_ERROR', message: error.message, collection: this.collectionName };
                }
            }

            async import(jsonData) {
                try {
                    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
                    if (!Array.isArray(data)) {
                        throw new Error('Import data must be an array');
                    }
                    return await this.addMany(data);
                } catch (error) {
                    console.error(`Error importing to ${this.collectionName}:`, error);
                    throw { code: 'DB_IMPORT_ERROR', message: error.message, collection: this.collectionName };
                }
            }
        }

        // ============================================================
        //  DASHBOARD ENGINE
        // ============================================================
        class DashboardEngine {
            constructor() {
                this.cache = {};
                this.listeners = [];
            }

            async getSummary() {
                try {
                    const [products, customers, orders, categories] = await Promise.all([
                        window.DB.products.count(),
                        window.DB.customers.count(),
                        window.DB.orders.count(),
                        window.DB.categories.count()
                    ]);

                    const pendingOrders = await window.DB.orders.where('status', '==', 'pending').exec();
                    const deliveredOrders = await window.DB.orders.where('status', '==', 'delivered').exec();
                    const cancelledOrders = await window.DB.orders.where('status', '==', 'cancelled').exec();

                    // Inventory summary
                    const inventory = await window.DB.inventory.all();
                    const lowStock = inventory.filter(item => item.stock < item.minStock || 5);
                    const totalStock = inventory.reduce((sum, item) => sum + (item.stock || 0), 0);

                    return {
                        totalProducts: products,
                        totalCustomers: customers,
                        totalOrders: orders,
                        totalCategories: categories,
                        pendingOrders: pendingOrders.length,
                        deliveredOrders: deliveredOrders.length,
                        cancelledOrders: cancelledOrders.length,
                        inventoryCount: totalStock,
                        lowStock: lowStock.length,
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    console.error('Error getting dashboard summary:', error);
                    throw { code: 'DB_DASHBOARD_SUMMARY_ERROR', message: error.message };
                }
            }

            async getTopCustomers(limit = 5) {
                try {
                    const orders = await window.DB.orders.all();
                    const customerTotals = {};
                    orders.forEach(order => {
                        const customerId = order.customerId || order.customer?.id;
                        if (!customerId) return;
                        if (!customerTotals[customerId]) {
                            customerTotals[customerId] = { customerId, total: 0, count: 0, customer: order.customer };
                        }
                        customerTotals[customerId].total += order.grandTotal || 0;
                        customerTotals[customerId].count += 1;
                    });

                    return Object.values(customerTotals)
                        .sort((a, b) => b.total - a.total)
                        .slice(0, limit);
                } catch (error) {
                    console.error('Error getting top customers:', error);
                    throw { code: 'DB_TOP_CUSTOMERS_ERROR', message: error.message };
                }
            }

            async getTopProducts(limit = 5) {
                try {
                    const orders = await window.DB.orders.all();
                    const productTotals = {};
                    orders.forEach(order => {
                        (order.items || []).forEach(item => {
                            const productId = item.productId || item.id;
                            if (!productId) return;
                            if (!productTotals[productId]) {
                                productTotals[productId] = { productId, total: 0, count: 0, product: item };
                            }
                            productTotals[productId].total += (item.price || 0) * (item.quantity || 1);
                            productTotals[productId].count += item.quantity || 1;
                        });
                    });

                    return Object.values(productTotals)
                        .sort((a, b) => b.total - a.total)
                        .slice(0, limit);
                } catch (error) {
                    console.error('Error getting top products:', error);
                    throw { code: 'DB_TOP_PRODUCTS_ERROR', message: error.message };
                }
            }

            async getLatestOrders(limit = 10) {
                return await window.DB.orders.latest(limit);
            }

            async getLatestCustomers(limit = 10) {
                return await window.DB.customers.latest(limit);
            }

            listenSummary(callback) {
                // Listen to multiple collections for realtime updates
                const unsubscribes = [];
                
                const collections = ['products', 'customers', 'orders', 'categories', 'inventory'];
                collections.forEach(col => {
                    const unsub = window.DB[col].listen(() => {
                        this.getSummary().then(callback).catch(err => {
                            console.error('Error updating dashboard summary:', err);
                        });
                    });
                    unsubscribes.push(unsub);
                });

                return () => {
                    unsubscribes.forEach(unsub => {
                        if (typeof unsub === 'function') unsub();
                    });
                };
            }
        }

        // ============================================================
        //  ANALYTICS ENGINE
        // ============================================================
        class AnalyticsEngine {
            async getRevenue() {
                try {
                    const orders = await window.DB.orders.all();
                    const delivered = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const todayRevenue = delivered
                        .filter(o => new Date(o.updatedAt || o.createdAt) >= today)
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const monthlyRevenue = delivered
                        .filter(o => {
                            const d = new Date(o.updatedAt || o.createdAt);
                            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                        })
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const yearlyRevenue = delivered
                        .filter(o => new Date(o.updatedAt || o.createdAt).getFullYear() === currentYear)
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const totalRevenue = delivered.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const averageOrder = delivered.length > 0 ? totalRevenue / delivered.length : 0;
                    
                    // Customer spend
                    const customerIds = new Set(delivered.map(o => o.customerId || o.customer?.id).filter(Boolean));
                    const totalCustomers = customerIds.size;
                    const averageCustomerSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

                    // Inventory value
                    const inventory = await window.DB.inventory.all();
                    const inventoryValue = inventory.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);

                    return {
                        todayRevenue,
                        monthlyRevenue,
                        yearlyRevenue,
                        totalRevenue,
                        averageOrder,
                        averageCustomerSpend,
                        inventoryValue,
                        totalOrders: delivered.length,
                        totalCustomers
                    };
                } catch (error) {
                    console.error('Error getting revenue analytics:', error);
                    throw { code: 'DB_ANALYTICS_REVENUE_ERROR', message: error.message };
                }
            }

            async getSalesChart(days = 30) {
                try {
                    const orders = await window.DB.orders.where('status', 'in', ['delivered', 'completed']).exec();
                    const chart = {};
                    
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    
                    orders.forEach(order => {
                        const date = new Date(order.updatedAt || order.createdAt);
                        if (date < startDate) return;
                        const key = date.toISOString().split('T')[0];
                        if (!chart[key]) {
                            chart[key] = { date: key, revenue: 0, orders: 0 };
                        }
                        chart[key].revenue += order.grandTotal || 0;
                        chart[key].orders += 1;
                    });
                    
                    return Object.values(chart).sort((a, b) => a.date.localeCompare(b.date));
                } catch (error) {
                    console.error('Error getting sales chart:', error);
                    throw { code: 'DB_SALES_CHART_ERROR', message: error.message };
                }
            }

            async getOrderStatusChart() {
                try {
                    const orders = await window.DB.orders.all();
                    const statuses = {};
                    orders.forEach(order => {
                        const status = order.status || 'pending';
                        if (!statuses[status]) statuses[status] = 0;
                        statuses[status] += 1;
                    });
                    return statuses;
                } catch (error) {
                    console.error('Error getting order status chart:', error);
                    throw { code: 'DB_ORDER_STATUS_CHART_ERROR', message: error.message };
                }
            }

            async getCustomerGrowth(days = 30) {
                try {
                    const customers = await window.DB.customers.all();
                    const growth = {};
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    
                    customers.forEach(customer => {
                        const date = new Date(customer.createdAt || customer.registeredAt);
                        if (date < startDate) return;
                        const key = date.toISOString().split('T')[0];
                        if (!growth[key]) {
                            growth[key] = { date: key, newCustomers: 0, total: 0 };
                        }
                        growth[key].newCustomers += 1;
                    });
                    
                    // Cumulative total
                    let runningTotal = customers.filter(c => new Date(c.createdAt || c.registeredAt) < startDate).length;
                    Object.values(growth).sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
                        runningTotal += item.newCustomers;
                        item.total = runningTotal;
                    });
                    
                    return Object.values(growth).sort((a, b) => a.date.localeCompare(b.date));
                } catch (error) {
                    console.error('Error getting customer growth:', error);
                    throw { code: 'DB_CUSTOMER_GROWTH_ERROR', message: error.message };
                }
            }
        }

        // ============================================================
        //  NOTIFICATION ENGINE
        // ============================================================
        class NotificationEngine {
            async add(data) {
                const notification = {
                    ...data,
                    read: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                return await window.DB.notifications.add(notification);
            }

            async markRead(id) {
                return await window.DB.notifications.update(id, { read: true });
            }

            async markAllRead(userId) {
                const notifications = await window.DB.notifications.where('userId', '==', userId).exec();
                const ids = notifications.map(n => n.id);
                if (ids.length === 0) return { count: 0 };
                return await window.DB.notifications.updateMany(ids, { read: true });
            }

            async getUnreadCount(userId) {
                const notifications = await window.DB.notifications.where('userId', '==', userId).exec();
                return notifications.filter(n => !n.read).length;
            }

            listenRealtime(userId, callback) {
                return window.DB.notifications.listen((notifications) => {
                    const userNotifs = notifications.filter(n => n.userId === userId);
                    callback(userNotifs);
                });
            }

            async delete(id) {
                return await window.DB.notifications.delete(id);
            }

            async deleteAll(userId) {
                const notifications = await window.DB.notifications.where('userId', '==', userId).exec();
                const ids = notifications.map(n => n.id);
                if (ids.length === 0) return { deleted: 0 };
                return await window.DB.notifications.deleteMany(ids);
            }
        }

        // ============================================================
        //  ACTIVITY ENGINE
        // ============================================================
        class ActivityEngine {
            async log(action, details = {}) {
                const activity = {
                    action,
                    details,
                    userId: window.DB.auth.currentUser?.uid || 'system',
                    userEmail: window.DB.auth.currentUser?.email || 'system',
                    timestamp: serverTimestamp(),
                    date: new Date().toISOString()
                };
                return await window.DB.activityLogs.add(activity);
            }

            async getRecent(limit = 50) {
                return await window.DB.activityLogs.latest(limit);
            }

            listenRealtime(callback) {
                return window.DB.activityLogs.listen(callback);
            }

            async getUserActivity(userId, limit = 20) {
                return await window.DB.activityLogs.where('userId', '==', userId).exec();
            }

            async getByAction(action, limit = 20) {
                return await window.DB.activityLogs.where('action', '==', action).exec();
            }
        }

        // ============================================================
        //  HOMEPAGE ENGINE
        // ============================================================
        class HomepageEngine {
            async getFeaturedProducts(limit = 8) {
                const products = await window.DB.products.where('featured', '==', true).exec();
                return products.slice(0, limit);
            }

            async getLatestProducts(limit = 8) {
                return await window.DB.products.latest(limit);
            }

            async getTrendingProducts(limit = 8) {
                const products = await window.DB.products.where('trending', '==', true).exec();
                return products.slice(0, limit);
            }

            async getOffers(limit = 6) {
                const now = new Date().toISOString();
                const offers = await window.DB.offers.where('active', '==', true).exec();
                return offers
                    .filter(o => !o.expiresAt || o.expiresAt > now)
                    .slice(0, limit);
            }

            async getBanners(limit = 5) {
                const banners = await window.DB.homepage.where('type', '==', 'banner').exec();
                return banners.slice(0, limit);
            }

            async getCategories(limit = 12) {
                return await window.DB.categories.latest(limit);
            }

            async getTestimonials(limit = 6) {
                return await window.DB.testimonials.latest(limit);
            }

            async getPartners(limit = 8) {
                return await window.DB.partners.latest(limit);
            }

            listenRealtime(callback) {
                const unsubscribes = [];
                const collections = ['products', 'offers', 'categories'];
                
                collections.forEach(col => {
                    const unsub = window.DB[col].listen(() => {
                        Promise.all([
                            this.getFeaturedProducts(),
                            this.getLatestProducts(),
                            this.getOffers(),
                            this.getCategories()
                        ]).then(([featured, latest, offers, categories]) => {
                            callback({ featured, latest, offers, categories });
                        }).catch(err => {
                            console.error('Error updating homepage data:', err);
                        });
                    });
                    unsubscribes.push(unsub);
                });

                return () => {
                    unsubscribes.forEach(unsub => {
                        if (typeof unsub === 'function') unsub();
                    });
                };
            }
        }

        // ============================================================
        //  PRODUCT ENGINE
        // ============================================================
        class ProductEngine {
            async search(query, options = {}) {
                try {
                    const allProducts = await window.DB.products.all();
                    let results = allProducts.filter(p => {
                        const searchLower = query.toLowerCase();
                        return p.name?.toLowerCase().includes(searchLower) ||
                               p.description?.toLowerCase().includes(searchLower) ||
                               p.category?.toLowerCase().includes(searchLower) ||
                               p.sku?.toLowerCase().includes(searchLower);
                    });

                    // Apply filters
                    if (options.category) {
                        results = results.filter(p => p.category === options.category);
                    }
                    if (options.minPrice !== undefined) {
                        results = results.filter(p => (p.offerPrice || p.price) >= options.minPrice);
                    }
                    if (options.maxPrice !== undefined) {
                        results = results.filter(p => (p.offerPrice || p.price) <= options.maxPrice);
                    }
                    if (options.inStock) {
                        results = results.filter(p => p.stock > 0);
                    }
                    if (options.onOffer) {
                        results = results.filter(p => p.offerPrice && p.offerPrice < p.price);
                    }
                    if (options.minRating) {
                        results = results.filter(p => p.rating >= options.minRating);
                    }

                    // Sort
                    switch (options.sort) {
                        case 'price-asc':
                            results.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
                            break;
                        case 'price-desc':
                            results.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
                            break;
                        case 'rating':
                            results.sort((a, b) => b.rating - a.rating);
                            break;
                        case 'popular':
                            results.sort((a, b) => (b.sales || 0) - (a.sales || 0));
                            break;
                        default:
                            break;
                    }

                    // Pagination
                    const page = options.page || 1;
                    const perPage = options.perPage || 20;
                    const total = results.length;
                    const start = (page - 1) * perPage;
                    const paginated = results.slice(start, start + perPage);

                    return {
                        items: paginated,
                        total,
                        page,
                        perPage,
                        totalPages: Math.ceil(total / perPage)
                    };
                } catch (error) {
                    console.error('Error searching products:', error);
                    throw { code: 'DB_PRODUCT_SEARCH_ERROR', message: error.message };
                }
            }

            async updateStock(productId, newStock) {
                return await window.DB.products.update(productId, { 
                    stock: newStock,
                    stockUpdatedAt: serverTimestamp()
                });
            }

            async updatePrice(productId, price, offerPrice = null) {
                const data = { price };
                if (offerPrice !== null) data.offerPrice = offerPrice;
                return await window.DB.products.update(productId, data);
            }

            async updateImages(productId, images) {
                return await window.DB.products.update(productId, { images });
            }

            listenRealtime(callback) {
                return window.DB.products.listen((products) => {
                    callback(products);
                });
            }
        }

        // ============================================================
        //  STORAGE ENGINE
        // ============================================================
        class StorageEngine {
            async uploadFile(path, file, metadata = {}) {
                try {
                    const storageRef = ref(storage, path);
                    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
                    
                    return new Promise((resolve, reject) => {
                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                if (this.onProgress) this.onProgress(progress);
                            },
                            (error) => reject(error),
                            async () => {
                                const url = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve({
                                    url,
                                    path,
                                    metadata: await getMetadata(uploadTask.snapshot.ref),
                                    ref: uploadTask.snapshot.ref
                                });
                            }
                        );
                    });
                } catch (error) {
                    console.error('Error uploading file:', error);
                    throw { code: 'DB_STORAGE_UPLOAD_ERROR', message: error.message };
                }
            }

            async uploadProductImage(productId, file, index = 0) {
                const path = `products/${productId}/image_${Date.now()}_${index}.jpg`;
                const result = await this.uploadFile(path, file, {
                    contentType: file.type,
                    productId
                });
                return result.url;
            }

            async uploadCustomerImage(customerId, file) {
                const path = `customers/${customerId}/profile_${Date.now()}.jpg`;
                const result = await this.uploadFile(path, file, {
                    contentType: file.type,
                    customerId
                });
                return result.url;
            }

            async uploadBlogImage(blogId, file) {
                const path = `blogs/${blogId}/image_${Date.now()}.jpg`;
                const result = await this.uploadFile(path, file, {
                    contentType: file.type,
                    blogId
                });
                return result.url;
            }

            async deleteFile(path) {
                try {
                    const storageRef = ref(storage, path);
                    await deleteObject(storageRef);
                    return { deleted: true, path };
                } catch (error) {
                    console.error('Error deleting file:', error);
                    throw { code: 'DB_STORAGE_DELETE_ERROR', message: error.message };
                }
            }

            async getDownloadURL(path) {
                try {
                    const storageRef = ref(storage, path);
                    return await getDownloadURL(storageRef);
                } catch (error) {
                    console.error('Error getting download URL:', error);
                    throw { code: 'DB_STORAGE_URL_ERROR', message: error.message };
                }
            }

            async listFiles(prefix) {
                try {
                    const storageRef = ref(storage, prefix);
                    const result = await listAll(storageRef);
                    return {
                        items: result.items.map(item => ({
                            name: item.name,
                            path: item.fullPath,
                            ref: item
                        })),
                        prefixes: result.prefixes
                    };
                } catch (error) {
                    console.error('Error listing files:', error);
                    throw { code: 'DB_STORAGE_LIST_ERROR', message: error.message };
                }
            }

            setProgressCallback(callback) {
                this.onProgress = callback;
            }
        }

        // ============================================================
        //  AUTH HELPERS        // ============================================================
        class AuthHelpers {
            get currentUser() {
                return auth.currentUser;
            }

            get isLoggedIn() {
                return !!auth.currentUser;
            }

            async getUserRole() {
                try {
                    if (!auth.currentUser) return null;
                    const userDoc = await window.DB.users.get(auth.currentUser.uid);
                    return userDoc?.role || 'customer';
                } catch (error) {
                    console.error('Error getting user role:', error);
                    return null;
                }
            }

            async isAdmin() {
                try {
                    const role = await this.getUserRole();
                    return role === 'admin' || role === 'super_admin';
                } catch (error) {
                    return false;
                }
            }

            async logout() {
                try {
                    await auth.signOut();
                    window.location.reload();
                } catch (error) {
                    console.error('Error logging out:', error);
                    throw { code: 'DB_LOGOUT_ERROR', message: error.message };
                }
            }

            async ensureAdmin() {
                const isAdmin = await this.isAdmin();
                if (!isAdmin) {
                    throw { code: 'DB_AUTH_ADMIN_REQUIRED', message: 'Admin privileges required' };
                }
                return true;
            }
        }

        // ============================================================
        //  UTILITY FUNCTIONS
        // ============================================================
        class DBUtilities {
            now() {
                return new Date().toISOString();
            }

            uid() {
                return Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
            }

            serverTime() {
                return serverTimestamp();
            }

            info() {
                return {
                    version: '1.0.0',
                    collections: Object.keys(this.collections),
                    timestamp: this.now()
                };
            }

            async ping() {
                try {
                    const start = performance.now();
                    await window.DB.products.count();
                    const end = performance.now();
                    return {
                        status: 'connected',
                        latency: end - start,
                        timestamp: this.now()
                    };
                } catch (error) {
                    return {
                        status: 'error',
                        error: error.message,
                        timestamp: this.now()
                    };
                }
            }

            delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            random(min = 0, max = 100) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }

            collections() {
                return Object.keys(this.collections);
            }
        }

        // ============================================================
        //  DB MAIN OBJECT
        // ============================================================
        const DB = {};

        // Collection names
        const COLLECTIONS = [
            'products', 'categories', 'customers', 'orders', 'inventory',
            'homepage', 'settings', 'crm', 'franchise', 'cloudKitchen',
            'offers', 'blogs', 'testimonials', 'partners', 'analytics',
            'reports', 'notifications', 'activityLogs', 'users', 'coupons',
            'wishlist', 'cart', 'invoices', 'payments', 'vendors',
            'supportTickets'
        ];

        // Initialize collections
        COLLECTIONS.forEach(name => {
            DB[name] = new CollectionManager(name);
        });

        // Initialize engines
        DB.dashboard = new DashboardEngine();
        DB.analytics = new AnalyticsEngine();
        DB.notifications = new NotificationEngine();
        DB.activity = new ActivityEngine();
        DB.homepage = new HomepageEngine();
        DB.products = new ProductEngine();
        DB.storage = new StorageEngine();
        DB.auth = new AuthHelpers();
        DB.utils = new DBUtilities();

        // Utility shortcuts
        DB.now = () => new Date().toISOString();
        DB.uid = () => Math.random().toString(36).substring(2, 15);
        DB.serverTime = serverTimestamp;
        DB.ping = async () => {
            try {
                const start = performance.now();
                await DB.products.count();
                return { status: 'connected', latency: performance.now() - start };
            } catch {
                return { status: 'error' };
            }
        };

        // Collection reference
        DB.collections = COLLECTIONS;

        // Batch operations helper
        DB.batch = async (operations) => {
            try {
                const batch = writeBatch(db);
                for (const op of operations) {
                    const { collection: col, id, data, type = 'set' } = op;
                    const ref = doc(collection(db, col), id);
                    if (type === 'set') {
                        batch.set(ref, { ...data, updatedAt: serverTimestamp() });
                    } else if (type === 'update') {
                        batch.update(ref, { ...data, updatedAt: serverTimestamp() });
                    } else if (type === 'delete') {
                        batch.delete(ref);
                    }
                }
                await batch.commit();
                return { success: true, count: operations.length };
            } catch (error) {
                console.error('Batch operation failed:', error);
                throw { code: 'DB_BATCH_ERROR', message: error.message };
            }
        };

        // Transaction helper
        DB.transaction = async (callback) => {
            try {
                return await runTransaction(db, async (transaction) => {
                    return await callback(transaction);
                });
            } catch (error) {
                console.error('Transaction failed:', error);
                throw { code: 'DB_TRANSACTION_ERROR', message: error.message };
            }
        };

        // ============================================================
        //  EXPOSE DB
        // ============================================================
        window.DB = DB;

        console.log('✅ Database Engine initialized successfully');
        console.log(`📦 ${COLLECTIONS.length} collections ready`);
        console.log('🔗 Real-time listeners active');

        // Emit ready event
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('DBReady', { detail: { DB } }));
        }

        // ============================================================
        //  INIT COMPLETE
        // ============================================================
        return DB;
    }

    // ============================================================
    //  START
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForFirebase);
    } else {
        waitForFirebase();
    }

})();
