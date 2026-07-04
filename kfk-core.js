/**
 * KFK Marketplace - Core Backend Engine
 * Production Ready - Enterprise Grade
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete database abstraction layer with all business modules.
 * Runs entirely in browser using Firebase Firestore.
 */

(function() {
    'use strict';

    // ============================================================
    //  WAIT FOR FIREBASE
    // ============================================================
    function waitForFirebase(retries = 0) {
        if (window.db && window.auth && window.storage && window.firestoreFunctions) {
            initializeCore();
            return;
        }
        if (retries > 30) {
            console.error('Firebase initialization timeout');
            return;
        }
        setTimeout(() => waitForFirebase(retries + 1), 200);
    }

    // ============================================================
    //  MAIN CORE ENGINE
    // ============================================================
    function initializeCore() {
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
            query,
            where,
            orderBy,
            limit,
            startAfter,
            onSnapshot,
            serverTimestamp,
            Timestamp,
            increment,
            arrayUnion,
            arrayRemove,
            writeBatch,
            runTransaction,
            getCountFromServer
        } = window.firestoreFunctions;

        const {
            ref,
            uploadBytesResumable,
            getDownloadURL,
            deleteObject,
            listAll,
            getMetadata
        } = window.firebaseStorageFunctions;

        // ============================================================
        //  UTILITY FUNCTIONS
        // ============================================================
        const Utils = {
            uid() {
                return Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
            },

            now() {
                return new Date().toISOString();
            },

            serverTime() {
                return serverTimestamp();
            },

            generateSlug(text) {
                return text
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
            },

            sanitize(data) {
                const seen = new WeakSet();
                return JSON.parse(JSON.stringify(data, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) return '[Circular]';
                        seen.add(value);
                    }
                    return value;
                }));
            },

            isObject(value) {
                return value && typeof value === 'object' && !Array.isArray(value);
            },

            deepMerge(target, source) {
                const result = { ...target };
                for (const key in source) {
                    if (this.isObject(source[key]) && this.isObject(result[key])) {
                        result[key] = this.deepMerge(result[key], source[key]);
                    } else {
                        result[key] = source[key];
                    }
                }
                return result;
            },

            formatPrice(amount) {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(amount);
            },

            formatDate(date) {
                return new Date(date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            }
        };

        // ============================================================
        //  COLLECTION MANAGER CLASS
        // ============================================================
        class CollectionManager {
            constructor(name) {
                this.name = name;
                this.collectionRef = collection(db, name);
                this._listeners = new Map();
                this._cache = null;
                this._cacheTime = null;
                this._cacheTTL = 5000; // 5 seconds
            }

            // ---- CREATE ----
            async add(data) {
                try {
                    const docRef = await addDoc(this.collectionRef, {
                        ...data,
                        _createdAt: serverTimestamp(),
                        _updatedAt: serverTimestamp(),
                        _id: Utils.uid()
                    });
                    const result = { id: docRef.id, ...data };
                    this._invalidateCache();
                    return result;
                } catch (error) {
                    console.error(`[${this.name}] Add error:`, error);
                    throw { code: 'DB_ADD_ERROR', message: error.message, collection: this.name };
                }
            }

            async set(id, data, merge = true) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await setDoc(docRef, {
                        ...data,
                        _updatedAt: serverTimestamp()
                    }, { merge });
                    this._invalidateCache();
                    return { id, ...data };
                } catch (error) {
                    console.error(`[${this.name}] Set error:`, error);
                    throw { code: 'DB_SET_ERROR', message: error.message, collection: this.name };
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
                            _createdAt: serverTimestamp(),
                            _updatedAt: serverTimestamp(),
                            _id: Utils.uid()
                        });
                        results.push({ id: docRef.id, ...data });
                    }
                    await batch.commit();
                    this._invalidateCache();
                    return results;
                } catch (error) {
                    console.error(`[${this.name}] AddMany error:`, error);
                    throw { code: 'DB_BULK_ADD_ERROR', message: error.message, collection: this.name };
                }
            }

            // ---- READ ----
            async get(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    const snapshot = await getDoc(docRef);
                    if (!snapshot.exists()) return null;
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`[${this.name}] Get error:`, error);
                    throw { code: 'DB_GET_ERROR', message: error.message, collection: this.name };
                }
            }

            async all(options = {}) {
                try {
                    const cacheKey = JSON.stringify(options);
                    if (this._cache && this._cacheKey === cacheKey && 
                        Date.now() - this._cacheTime < this._cacheTTL) {
                        return this._cache;
                    }

                    let q = this.collectionRef;
                    if (options.orderBy) {
                        q = query(q, orderBy(options.orderBy, options.orderDirection || 'asc'));
                    }
                    if (options.limit) {
                        q = query(q, limit(options.limit));
                    }
                    if (options.where) {
                        for (const condition of options.where) {
                            q = query(q, where(condition.field, condition.operator, condition.value));
                        }
                    }

                    const snapshot = await getDocs(q);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });

                    this._cache = results;
                    this._cacheKey = cacheKey;
                    this._cacheTime = Date.now();
                    
                    return results;
                } catch (error) {
                    console.error(`[${this.name}] All error:`, error);
                    throw { code: 'DB_ALL_ERROR', message: error.message, collection: this.name };
                }
            }

            async count() {
                try {
                    const snapshot = await getCountFromServer(this.collectionRef);
                    return snapshot.data().count;
                } catch (error) {
                    console.error(`[${this.name}] Count error:`, error);
                    throw { code: 'DB_COUNT_ERROR', message: error.message, collection: this.name };
                }
            }

            async exists(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    const snapshot = await getDoc(docRef);
                    return snapshot.exists();
                } catch (error) {
                    console.error(`[${this.name}] Exists error:`, error);
                    throw { code: 'DB_EXISTS_ERROR', message: error.message, collection: this.name };
                }
            }

            async first() {
                try {
                    const q = query(this.collectionRef, orderBy('_createdAt', 'asc'), limit(1));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) return null;
                    const doc = snapshot.docs[0];
                    return { id: doc.id, ...doc.data() };
                } catch (error) {
                    console.error(`[${this.name}] First error:`, error);
                    throw { code: 'DB_FIRST_ERROR', message: error.message, collection: this.name };
                }
            }

            async latest(limitNum = 10) {
                try {
                    const q = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(limitNum));
                    const snapshot = await getDocs(q);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });
                    return results;
                } catch (error) {
                    console.error(`[${this.name}] Latest error:`, error);
                    throw { code: 'DB_LATEST_ERROR', message: error.message, collection: this.name };
                }
            }

            async page(pageNumber = 1, pageSize = 20) {
                try {
                    const startIndex = (pageNumber - 1) * pageSize;
                    let q = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(pageSize));
                    
                    if (pageNumber > 1) {
                        const prevQuery = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(startIndex));
                        const prevSnapshot = await getDocs(prevQuery);
                        const lastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
                        if (lastDoc) {
                            q = query(this.collectionRef, orderBy('_createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
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
                    console.error(`[${this.name}] Page error:`, error);
                    throw { code: 'DB_PAGE_ERROR', message: error.message, collection: this.name };
                }
            }

            search(field, searchTerm, options = {}) {
                const searchLower = searchTerm.toLowerCase();
                return {
                    _collection: this,
                    async exec() {
                        try {
                            const data = await this._collection.all(options);
                            return data.filter(item => {
                                const value = item[field] || '';
                                return String(value).toLowerCase().includes(searchLower);
                            });
                        } catch (error) {
                            console.error(`[${this._collection.name}] Search error:`, error);
                            throw { code: 'DB_SEARCH_ERROR', message: error.message };
                        }
                    }
                };
            }

            where(field, operator, value) {
                return {
                    _collection: this,
                    _query: query(this._collection.collectionRef, where(field, operator, value)),
                    async exec() {
                        try {
                            const snapshot = await getDocs(this._query);
                            const results = [];
                            snapshot.forEach(doc => {
                                results.push({ id: doc.id, ...doc.data() });
                            });
                            return results;
                        } catch (error) {
                            console.error(`[${this._collection.name}] Where error:`, error);
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
                            console.error(`[${this._collection.name}] Where listener error:`, error);
                            callback(null, error);
                        });
                    }
                };
            }

            // ---- UPDATE ----
            async update(id, data) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await updateDoc(docRef, {
                        ...data,
                        _updatedAt: serverTimestamp()
                    });
                    this._invalidateCache();
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`[${this.name}] Update error:`, error);
                    throw { code: 'DB_UPDATE_ERROR', message: error.message, collection: this.name };
                }
            }

            async updateMany(ids, data) {
                try {
                    const batch = writeBatch(db);
                    for (const id of ids) {
                        const docRef = doc(this.collectionRef, id);
                        batch.update(docRef, {
                            ...data,
                            _updatedAt: serverTimestamp()
                        });
                    }
                    await batch.commit();
                    this._invalidateCache();
                    return ids;
                } catch (error) {
                    console.error(`[${this.name}] UpdateMany error:`, error);
                    throw { code: 'DB_BULK_UPDATE_ERROR', message: error.message, collection: this.name };
                }
            }

            // ---- DELETE ----
            async delete(id, hard = false) {
                try {
                    if (hard) {
                        const docRef = doc(this.collectionRef, id);
                        await deleteDoc(docRef);
                        this._invalidateCache();
                        return { id, hard: true };
                    } else {
                        // Soft delete
                        return await this.update(id, { _deleted: true, _deletedAt: serverTimestamp() });
                    }
                } catch (error) {
                    console.error(`[${this.name}] Delete error:`, error);
                    throw { code: 'DB_DELETE_ERROR', message: error.message, collection: this.name };
                }
            }

            async deleteMany(ids, hard = false) {
                try {
                    const batch = writeBatch(db);
                    for (const id of ids) {
                        if (hard) {
                            const docRef = doc(this.collectionRef, id);
                            batch.delete(docRef);
                        } else {
                            const docRef = doc(this.collectionRef, id);
                            batch.update(docRef, {
                                _deleted: true,
                                _deletedAt: serverTimestamp(),
                                _updatedAt: serverTimestamp()
                            });
                        }
                    }
                    await batch.commit();
                    this._invalidateCache();
                    return ids;
                } catch (error) {
                    console.error(`[${this.name}] DeleteMany error:`, error);
                    throw { code: 'DB_BULK_DELETE_ERROR', message: error.message, collection: this.name };
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
                    this._invalidateCache();
                    return { deleted: snapshot.size };
                } catch (error) {
                    console.error(`[${this.name}] Clear error:`, error);
                    throw { code: 'DB_CLEAR_ERROR', message: error.message, collection: this.name };
                }
            }

            // ---- REALTIME ----
            listen(callback, conditions = null) {
                try {
                    let q = this.collectionRef;
                    if (conditions) {
                        if (conditions.where) {
                            for (const condition of conditions.where) {
                                q = query(q, where(condition.field, condition.operator, condition.value));
                            }
                        }
                        if (conditions.orderBy) {
                            q = query(q, orderBy(conditions.orderBy, conditions.orderDirection || 'asc'));
                        }
                        if (conditions.limit) {
                            q = query(q, limit(conditions.limit));
                        }
                    }
                    
                    const unsubscribe = onSnapshot(q, (snapshot) => {
                        const results = [];
                        snapshot.forEach(doc => {
                            results.push({ id: doc.id, ...doc.data() });
                        });
                        callback(results);
                    }, (error) => {
                        console.error(`[${this.name}] Listener error:`, error);
                        callback(null, error);
                    });
                    
                    this._listeners.set(callback, unsubscribe);
                    return unsubscribe;
                } catch (error) {
                    console.error(`[${this.name}] Listen error:`, error);
                    throw { code: 'DB_LISTEN_ERROR', message: error.message, collection: this.name };
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
                    a.download = `${this.name}_export_${Utils.now().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    return data;
                } catch (error) {
                    console.error(`[${this.name}] Export error:`, error);
                    throw { code: 'DB_EXPORT_ERROR', message: error.message, collection: this.name };
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
                    console.error(`[${this.name}] Import error:`, error);
                    throw { code: 'DB_IMPORT_ERROR', message: error.message, collection: this.name };
                }
            }

            // ---- CACHE ----
            _invalidateCache() {
                this._cache = null;
                this._cacheTime = null;
            }

            clearCache() {
                this._invalidateCache();
            }

            // ---- UTILITY ----
            ref(id) {
                return doc(this.collectionRef, id);
            }
        }

        // ============================================================
        //  COLLECTION INSTANCES
        // ============================================================
        const DB = {};

        const COLLECTIONS = [
            'products', 'categories', 'customers', 'orders', 'inventory',
            'users', 'admins', 'vendors', 'offers', 'banners',
            'homepage', 'blogs', 'blogCategories', 'testimonials', 'partners',
            'wishlist', 'cart', 'payments', 'transactions', 'notifications',
            'activityLogs', 'reports', 'analytics', 'crm', 'franchise',
            'cloudKitchen', 'supportTickets', 'settings', 'coupons', 'reviews',
            'enquiries', 'contacts', 'newsletter'
        ];

        COLLECTIONS.forEach(name => {
            DB[name] = new CollectionManager(name);
        });

        // ============================================================
        //  BATCH OPERATIONS
        // ============================================================
        DB.batch = async (operations) => {
            try {
                const batch = writeBatch(db);
                for (const op of operations) {
                    const { collection: col, id, data, type = 'set' } = op;
                    const ref = doc(collection(db, col), id);
                    if (type === 'set') {
                        batch.set(ref, { ...data, _updatedAt: serverTimestamp() });
                    } else if (type === 'update') {
                        batch.update(ref, { ...data, _updatedAt: serverTimestamp() });
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

        // ============================================================
        //  TRANSACTION HELPER
        // ============================================================
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
        //  DASHBOARD ENGINE
        // ============================================================
        DB.dashboard = {
            async getSummary() {
                try {
                    const [products, customers, orders, categories, inventory] = await Promise.all([
                        DB.products.count(),
                        DB.customers.count(),
                        DB.orders.count(),
                        DB.categories.count(),
                        DB.inventory.all()
                    ]);

                    const pendingOrders = await DB.orders.where('status', '==', 'pending').exec();
                    const deliveredOrders = await DB.orders.where('status', '==', 'delivered').exec();
                    const cancelledOrders = await DB.orders.where('status', '==', 'cancelled').exec();

                    const lowStock = inventory.filter(item => (item.stock || 0) < (item.minStock || 5));
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
                        timestamp: Utils.now()
                    };
                } catch (error) {
                    console.error('Dashboard summary error:', error);
                    throw { code: 'DB_DASHBOARD_ERROR', message: error.message };
                }
            },

            async getRecentOrders(limit = 5) {
                return await DB.orders.latest(limit);
            },

            async getRecentCustomers(limit = 5) {
                return await DB.customers.latest(limit);
            },

            async getLowStockItems() {
                const inventory = await DB.inventory.all();
                return inventory.filter(item => (item.stock || 0) < (item.minStock || 5));
            }
        };

        // ============================================================
        //  ANALYTICS ENGINE
        // ============================================================
        DB.analytics = {
            async getRevenue() {
                try {
                    const orders = await DB.orders.all();
                    const delivered = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const todayRevenue = delivered
                        .filter(o => new Date(o._updatedAt || o._createdAt) >= today)
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const monthlyRevenue = delivered
                        .filter(o => {
                            const d = new Date(o._updatedAt || o._createdAt);
                            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                        })
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const yearlyRevenue = delivered
                        .filter(o => new Date(o._updatedAt || o._createdAt).getFullYear() === currentYear)
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    
                    const totalRevenue = delivered.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                    const averageOrder = delivered.length > 0 ? totalRevenue / delivered.length : 0;
                    const totalOrders = delivered.length;

                    return { todayRevenue, monthlyRevenue, yearlyRevenue, totalRevenue, averageOrder, totalOrders };
                } catch (error) {
                    console.error('Revenue analytics error:', error);
                    throw { code: 'DB_ANALYTICS_ERROR', message: error.message };
                }
            },

            async getSalesChart(days = 30) {
                try {
                    const orders = await DB.orders.where('status', 'in', ['delivered', 'completed']).exec();
                    const chart = {};
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    
                    orders.forEach(order => {
                        const date = new Date(order._updatedAt || order._createdAt);
                        if (date < startDate) return;
                        const key = date.toISOString().split('T')[0];
                        if (!chart[key]) chart[key] = { date: key, revenue: 0, orders: 0 };
                        chart[key].revenue += order.grandTotal || 0;
                        chart[key].orders += 1;
                    });
                    
                    return Object.values(chart).sort((a, b) => a.date.localeCompare(b.date));
                } catch (error) {
                    console.error('Sales chart error:', error);
                    throw { code: 'DB_SALES_CHART_ERROR', message: error.message };
                }
            },

            async getOrderStatusChart() {
                try {
                    const orders = await DB.orders.all();
                    const statuses = {};
                    orders.forEach(order => {
                        const status = order.status || 'pending';
                        statuses[status] = (statuses[status] || 0) + 1;
                    });
                    return statuses;
                } catch (error) {
                    console.error('Order status chart error:', error);
                    throw { code: 'DB_ORDER_STATUS_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  NOTIFICATION ENGINE
        // ============================================================
        DB.notifications = {
            async send(userId, title, message, type = 'info', data = {}) {
                return await DB.notifications.add({
                    userId,
                    title,
                    message,
                    type,
                    data,
                    read: false,
                    _createdAt: serverTimestamp()
                });
            },

            async markRead(id) {
                return await DB.notifications.update(id, { read: true });
            },

            async markAllRead(userId) {
                const notifs = await DB.notifications.where('userId', '==', userId).exec();
                const ids = notifs.map(n => n.id);
                if (ids.length === 0) return { count: 0 };
                return await DB.notifications.updateMany(ids, { read: true });
            },

            async getUnreadCount(userId) {
                const notifs = await DB.notifications.where('userId', '==', userId).exec();
                return notifs.filter(n => !n.read).length;
            },

            listenRealtime(userId, callback) {
                return DB.notifications.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }],
                    orderBy: '_createdAt',
                    orderDirection: 'desc'
                });
            }
        };

        // ============================================================
        //  ACTIVITY LOG ENGINE
        // ============================================================
        DB.activity = {
            async log(action, details = {}) {
                const user = auth.currentUser;
                return await DB.activityLogs.add({
                    action,
                    details: Utils.sanitize(details),
                    userId: user?.uid || 'system',
                    userEmail: user?.email || 'system',
                    userRole: user?.role || 'system',
                    timestamp: serverTimestamp(),
                    date: Utils.now()
                });
            },

            async getRecent(limit = 50) {
                return await DB.activityLogs.latest(limit);
            },

            listenRealtime(callback) {
                return DB.activityLogs.listen(callback);
            },

            async getUserActivity(userId, limit = 20) {
                return await DB.activityLogs.where('userId', '==', userId).exec();
            }
        };

        // ============================================================
        //  HOMEPAGE ENGINE
        // ============================================================
        DB.homepage = {
            async getFeatured(limit = 8) {
                const products = await DB.products.where('featured', '==', true).exec();
                return products.slice(0, limit);
            },

            async getTrending(limit = 8) {
                const products = await DB.products.where('trending', '==', true).exec();
                return products.slice(0, limit);
            },

            async getLatest(limit = 8) {
                return await DB.products.latest(limit);
            },

            async getOffers(limit = 6) {
                const now = Utils.now();
                const offers = await DB.offers.where('active', '==', true).exec();
                return offers.filter(o => !o.expiresAt || o.expiresAt > now).slice(0, limit);
            },

            async getBanners(limit = 5) {
                const banners = await DB.banners.where('active', '==', true).exec();
                return banners.slice(0, limit);
            },

            async getCategories(limit = 12) {
                return await DB.categories.latest(limit);
            },

            async getTestimonials(limit = 6) {
                return await DB.testimonials.latest(limit);
            },

            async getPartners(limit = 8) {
                return await DB.partners.latest(limit);
            },

            listenRealtime(callback) {
                const unsubscribes = [];
                const collections = ['products', 'offers', 'categories'];
                
                collections.forEach(col => {
                    const unsub = DB[col].listen(() => {
                        Promise.all([
                            this.getFeatured(),
                            this.getLatest(),
                            this.getOffers(),
                            this.getCategories()
                        ]).then(([featured, latest, offers, categories]) => {
                            callback({ featured, latest, offers, categories });
                        }).catch(err => {
                            console.error('Homepage update error:', err);
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
        };

        // ============================================================
        //  STORAGE ENGINE
        // ============================================================
        DB.storage = {
            async upload(path, file, metadata = {}) {
                try {
                    const storageRef = ref(storage, path);
                    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
                    
                    return new Promise((resolve, reject) => {
                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                if (this._onProgress) this._onProgress(progress);
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
                    console.error('Upload error:', error);
                    throw { code: 'DB_STORAGE_UPLOAD_ERROR', message: error.message };
                }
            },

            async uploadProductImage(productId, file) {
                const path = `products/${productId}/image_${Date.now()}.jpg`;
                const result = await this.upload(path, file, { contentType: file.type, productId });
                return result.url;
            },

            async uploadCustomerImage(customerId, file) {
                const path = `customers/${customerId}/profile_${Date.now()}.jpg`;
                const result = await this.upload(path, file, { contentType: file.type, customerId });
                return result.url;
            },

            async delete(path) {
                try {
                    const storageRef = ref(storage, path);
                    await deleteObject(storageRef);
                    return { deleted: true, path };
                } catch (error) {
                    console.error('Delete error:', error);
                    throw { code: 'DB_STORAGE_DELETE_ERROR', message: error.message };
                }
            },

            async getURL(path) {
                try {
                    const storageRef = ref(storage, path);
                    return await getDownloadURL(storageRef);
                } catch (error) {
                    console.error('Get URL error:', error);
                    throw { code: 'DB_STORAGE_URL_ERROR', message: error.message };
                }
            },

            async list(prefix) {
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
                    console.error('List error:', error);
                    throw { code: 'DB_STORAGE_LIST_ERROR', message: error.message };
                }
            },

            onProgress(callback) {
                this._onProgress = callback;
            }
        };

        // ============================================================
        //  CART ENGINE
        // ============================================================
        DB.cart = {
            async addItem(userId, productId, quantity = 1, variant = null) {
                const existing = await DB.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                
                if (existing.length > 0) {
                    const item = existing[0];
                    return await DB.cart.update(item.id, {
                        quantity: item.quantity + quantity,
                        _updatedAt: serverTimestamp()
                    });
                } else {
                    const product = await DB.products.get(productId);
                    return await DB.cart.add({
                        userId,
                        productId,
                        productName: product?.name || 'Unknown',
                        productPrice: product?.offerPrice || product?.price || 0,
                        productImage: product?.images?.[0] || '',
                        quantity,
                        variant,
                        _createdAt: serverTimestamp(),
                        _updatedAt: serverTimestamp()
                    });
                }
            },

            async removeItem(userId, productId) {
                const items = await DB.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0) {
                    return await DB.cart.delete(items[0].id);
                }
                return null;
            },

            async updateQuantity(userId, productId, quantity) {
                const items = await DB.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0 && quantity > 0) {
                    return await DB.cart.update(items[0].id, { quantity });
                } else if (items.length > 0 && quantity <= 0) {
                    return await DB.cart.delete(items[0].id);
                }
                return null;
            },

            async getCart(userId) {
                return await DB.cart.where('userId', '==', userId).exec();
            },

            async getTotal(userId) {
                const items = await this.getCart(userId);
                return items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
            },

            async clearCart(userId) {
                const items = await this.getCart(userId);
                const ids = items.map(i => i.id);
                if (ids.length > 0) {
                    return await DB.cart.deleteMany(ids);
                }
                return { deleted: 0 };
            },

            listenRealtime(userId, callback) {
                return DB.cart.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }]
                });
            }
        };

        // ============================================================
        //  WISHLIST ENGINE
        // ============================================================
        DB.wishlist = {
            async addItem(userId, productId) {
                const existing = await DB.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                
                if (existing.length > 0) {
                    return existing[0];
                }
                
                const product = await DB.products.get(productId);
                return await DB.wishlist.add({
                    userId,
                    productId,
                    productName: product?.name || 'Unknown',
                    productPrice: product?.offerPrice || product?.price || 0,
                    productImage: product?.images?.[0] || '',
                    _createdAt: serverTimestamp()
                });
            },

            async removeItem(userId, productId) {
                const items = await DB.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0) {
                    return await DB.wishlist.delete(items[0].id);
                }
                return null;
            },

            async getWishlist(userId) {
                return await DB.wishlist.where('userId', '==', userId).exec();
            },

            async isInWishlist(userId, productId) {
                const items = await DB.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                return items.length > 0;
            },

            listenRealtime(userId, callback) {
                return DB.wishlist.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }]
                });
            }
        };

        // ============================================================
        //  INVENTORY ENGINE
        // ============================================================
        DB.inventory = {
            async updateStock(productId, newStock) {
                return await DB.inventory.update(productId, {
                    stock: newStock,
                    lastStockUpdate: serverTimestamp()
                });
            },

            async adjustStock(productId, adjustment) {
                const item = await DB.inventory.get(productId);
                if (!item) {
                    throw new Error('Product not found in inventory');
                }
                const newStock = (item.stock || 0) + adjustment;
                if (newStock < 0) {
                    throw new Error('Insufficient stock');
                }
                return await this.updateStock(productId, newStock);
            },

            async getLowStock(threshold = 5) {
                const inventory = await DB.inventory.all();
                return inventory.filter(item => (item.stock || 0) < threshold);
            },

            async getOutOfStock() {
                const inventory = await DB.inventory.all();
                return inventory.filter(item => (item.stock || 0) <= 0);
            },

            async getInventoryValue() {
                const inventory = await DB.inventory.all();
                return inventory.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
            },

            listenRealtime(callback) {
                return DB.inventory.listen(callback);
            }
        };

        // ============================================================
        //  COUPON ENGINE
        // ============================================================
        DB.coupons = {
            async validate(code) {
                const coupons = await DB.coupons.where('code', '==', code.toUpperCase()).exec();
                if (coupons.length === 0) {
                    throw new Error('Invalid coupon code');
                }
                const coupon = coupons[0];
                const now = Utils.now();
                
                if (!coupon.active) {
                    throw new Error('Coupon is not active');
                }
                if (coupon.expiresAt && coupon.expiresAt < now) {
                    throw new Error('Coupon has expired');
                }
                if (coupon.usedCount >= coupon.maxUses) {
                    throw new Error('Coupon usage limit reached');
                }
                
                return coupon;
            },

            async use(code) {
                const coupon = await this.validate(code);
                return await DB.coupons.update(coupon.id, {
                    usedCount: (coupon.usedCount || 0) + 1,
                    lastUsedAt: serverTimestamp()
                });
            },

            async create(data) {
                return await DB.coupons.add({
                    ...data,
                    code: data.code.toUpperCase(),
                    usedCount: 0,
                    active: true,
                    _createdAt: serverTimestamp()
                });
            },

            async getActive() {
                const now = Utils.now();
                const coupons = await DB.coupons.where('active', '==', true).exec();
                return coupons.filter(c => !c.expiresAt || c.expiresAt > now);
            }
        };

        // ============================================================
        //  ORDER ENGINE
        // ============================================================
        DB.orders = {
            async createOrder(customerId, items, shippingAddress, paymentMethod) {
                const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const tax = subtotal * 0.05;
                const deliveryCharge = subtotal > 499 ? 0 : 49;
                const total = subtotal + tax + deliveryCharge;

                const order = {
                    customerId,
                    items: items.map(item => ({
                        ...item,
                        subtotal: item.price * item.quantity
                    })),
                    shippingAddress,
                    paymentMethod,
                    subtotal,
                    tax,
                    deliveryCharge,
                    grandTotal: total,
                    status: 'pending',
                    paymentStatus: 'pending',
                    orderDate: serverTimestamp(),
                    _createdAt: serverTimestamp(),
                    _updatedAt: serverTimestamp()
                };

                const result = await DB.orders.add(order);
                
                // Update inventory
                for (const item of items) {
                    try {
                        await DB.inventory.adjustStock(item.productId, -item.quantity);
                    } catch (e) {
                        console.error(`Failed to update stock for ${item.productId}:`, e);
                    }
                }

                // Clear cart
                try {
                    await DB.cart.clearCart(customerId);
                } catch (e) {
                    console.error('Failed to clear cart:', e);
                }

                return result;
            },

            async getCustomerOrders(customerId) {
                return await DB.orders.where('customerId', '==', customerId).exec();
            },

            async getByStatus(status) {
                return await DB.orders.where('status', '==', status).exec();
            },

            async updateStatus(orderId, status) {
                return await DB.orders.update(orderId, {
                    status,
                    statusUpdatedAt: serverTimestamp()
                });
            },

            async getRevenue(period = 'all') {
                const orders = await DB.orders.where('status', 'in', ['delivered', 'completed']).exec();
                return orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
            },

            listenRealtime(callback) {
                return DB.orders.listen(callback);
            }
        };

        // ============================================================
        //  USER / AUTH ENGINE
        // ============================================================
        DB.auth = {
            get currentUser() {
                return auth.currentUser;
            },

            get isLoggedIn() {
                return !!auth.currentUser;
            },

            async getUserRole() {
                try {
                    if (!auth.currentUser) return null;
                    const userDoc = await DB.users.get(auth.currentUser.uid);
                    return userDoc?.role || 'customer';
                } catch (error) {
                    console.error('Get user role error:', error);
                    return null;
                }
            },

            async isAdmin() {
                try {
                    const role = await this.getUserRole();
                    return role === 'admin' || role === 'super_admin';
                } catch (error) {
                    return false;
                }
            },

            async isVendor() {
                try {
                    const role = await this.getUserRole();
                    return role === 'vendor' || role === 'admin' || role === 'super_admin';
                } catch (error) {
                    return false;
                }
            },

            async isAdminOrVendor() {
                return await this.isAdmin() || await this.isVendor();
            },

            async logout() {
                try {
                    await auth.signOut();
                    window.location.reload();
                } catch (error) {
                    console.error('Logout error:', error);
                    throw { code: 'DB_LOGOUT_ERROR', message: error.message };
                }
            },

            async requireAdmin() {
                const isAdmin = await this.isAdmin();
                if (!isAdmin) {
                    throw { code: 'DB_AUTH_REQUIRED', message: 'Admin privileges required' };
                }
                return true;
            }
        };

        // ============================================================
        //  INVOICE ENGINE
        // ============================================================
        DB.invoices = {
            async generate(orderId) {
                const order = await DB.orders.get(orderId);
                if (!order) {
                    throw new Error('Order not found');
                }

                const invoice = {
                    orderId,
                    invoiceNumber: `INV-${Utils.now().slice(0, 10)}-${orderId.slice(0, 6)}`,
                    customerId: order.customerId,
                    items: order.items,
                    subtotal: order.subtotal,
                    tax: order.tax,
                    deliveryCharge: order.deliveryCharge,
                    grandTotal: order.grandTotal,
                    status: 'draft',
                    generatedAt: serverTimestamp()
                };

                return await DB.invoices.add(invoice);
            },

            async getByOrder(orderId) {
                const invoices = await DB.invoices.where('orderId', '==', orderId).exec();
                return invoices[0] || null;
            },

            async markPaid(invoiceId) {
                return await DB.invoices.update(invoiceId, {
                    status: 'paid',
                    paidAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  PAYMENT ENGINE
        // ============================================================
        DB.payments = {
            async createPayment(orderId, amount, method, transactionId) {
                return await DB.payments.add({
                    orderId,
                    amount,
                    method,
                    transactionId,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    _createdAt: serverTimestamp()
                });
            },

            async markSuccess(paymentId) {
                const payment = await DB.payments.get(paymentId);
                if (!payment) {
                    throw new Error('Payment not found');
                }
                await DB.payments.update(paymentId, {
                    status: 'success',
                    completedAt: serverTimestamp()
                });
                await DB.orders.updateStatus(payment.orderId, 'confirmed');
                return payment;
            },

            async markFailed(paymentId, error) {
                return await DB.payments.update(paymentId, {
                    status: 'failed',
                    error: error,
                    failedAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  REVIEW ENGINE
        // ============================================================
        DB.reviews = {
            async addProductReview(productId, customerId, rating, review) {
                const existing = await DB.reviews.where('productId', '==', productId)
                    .where('customerId', '==', customerId)
                    .exec();
                
                if (existing.length > 0) {
                    throw new Error('You have already reviewed this product');
                }

                const result = await DB.reviews.add({
                    productId,
                    customerId,
                    rating,
                    review,
                    status: 'pending',
                    _createdAt: serverTimestamp()
                });

                // Update product rating
                const allReviews = await DB.reviews.where('productId', '==', productId).exec();
                const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
                await DB.products.update(productId, {
                    rating: Math.round(avgRating * 10) / 10,
                    reviewCount: allReviews.length
                });

                return result;
            },

            async getProductReviews(productId) {
                return await DB.reviews.where('productId', '==', productId).exec();
            },

            async approve(reviewId) {
                return await DB.reviews.update(reviewId, {
                    status: 'approved',
                    approvedAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  SUPPORT TICKET ENGINE
        // ============================================================
        DB.supportTickets = {
            async create(customerId, subject, message, category = 'general') {
                return await DB.supportTickets.add({
                    customerId,
                    subject,
                    message,
                    category,
                    status: 'open',
                    priority: 'medium',
                    _createdAt: serverTimestamp(),
                    _updatedAt: serverTimestamp()
                });
            },

            async reply(ticketId, message, isInternal = false) {
                const ticket = await DB.supportTickets.get(ticketId);
                if (!ticket) {
                    throw new Error('Ticket not found');
                }

                const replies = ticket.replies || [];
                replies.push({
                    message,
                    isInternal,
                    createdAt: serverTimestamp(),
                    author: auth.currentUser?.email || 'system'
                });

                return await DB.supportTickets.update(ticketId, {
                    replies,
                    status: ticket.status === 'closed' ? 'reopened' : ticket.status,
                    _updatedAt: serverTimestamp()
                });
            },

            async close(ticketId) {
                return await DB.supportTickets.update(ticketId, {
                    status: 'closed',
                    closedAt: serverTimestamp(),
                    _updatedAt: serverTimestamp()
                });
            },

            async getCustomerTickets(customerId) {
                return await DB.supportTickets.where('customerId', '==', customerId).exec();
            }
        };

        // ============================================================
        //  GLOBAL UTILITIES
        // ============================================================
        DB.utils = Utils;

        // ============================================================
        //  SYSTEM HELPERS
        // ============================================================
        DB.system = {
            async health() {
                try {
                    const start = performance.now();
                    await DB.products.count();
                    const latency = performance.now() - start;
                    return {
                        status: 'healthy',
                        latency,
                        timestamp: Utils.now(),
                        collections: COLLECTIONS.length,
                        firebase: {
                            app: !!window.app,
                            db: !!window.db,
                            auth: !!window.auth,
                            storage: !!window.storage
                        }
                    };
                } catch (error) {
                    return {
                        status: 'unhealthy',
                        error: error.message,
                        timestamp: Utils.now()
                    };
                }
            },

            async ping() {
                const start = performance.now();
                await DB.products.count();
                return {
                    latency: performance.now() - start,
                    timestamp: Utils.now()
                };
            },

            getCollections() {
                return COLLECTIONS;
            },

            getStats() {
                return {
                    collections: COLLECTIONS.length,
                    version: '1.0.0',
                    timestamp: Utils.now()
                };
            }
        };

        // ============================================================
        //  EXPOSE & INIT
        // ============================================================
        window.DB = DB;

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('DBReady', { detail: { DB } }));

        console.log('🚀 KFK Core Ready');
        console.log(`📦 ${COLLECTIONS.length} collections initialized`);
        console.log('🔗 Realtime listeners active');

        return DB;
    }

    // ============================================================
    //  START ENGINE
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForFirebase);
    } else {
        waitForFirebase();
    }

})();
