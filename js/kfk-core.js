/**
 * KFK Marketplace - Core Database Engine
 * Enterprise Production Ready - Firebase v12 Modular SDK
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Main database engine for KFK Marketplace.
 * All data operations go through this module.
 * Fully compatible with firebase-init.js
 */

(function() {
    'use strict';

    // ============================================================
    //  WAIT FOR FIREBASE INITIALIZATION
    // ============================================================
    function waitForFirebase(retries = 0) {
        if (window.db && window.auth && window.storage && window.firestoreFunctions) {
            initializeCore();
            return;
        }
        if (retries > 30) {
            console.error('[KFK Core] Firebase initialization timeout');
            return;
        }
        setTimeout(() => waitForFirebase(retries + 1), 200);
    }

    // ============================================================
    //  INITIALIZE CORE ENGINE
    // ============================================================
    function initializeCore() {
        const { db, auth, storage } = window;
        const {
            collection,
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
            startAfter,
            onSnapshot,
            serverTimestamp,
            Timestamp,
            increment,
            arrayUnion,
            arrayRemove
        } = window.firestoreFunctions;

        const {
            ref,
            uploadBytesResumable,
            getDownloadURL,
            deleteObject,
            listAll
        } = window.firebaseStorageFunctions;

        // ============================================================
        //  UTILITY FUNCTIONS
        // ============================================================
        const Utils = {
            /**
             * Generate a unique ID
             * @returns {string} Unique ID
             */
            uid() {
                return Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
            },

            /**
             * Get current ISO timestamp
             * @returns {string} ISO timestamp
             */
            now() {
                return new Date().toISOString();
            },

            /**
             * Get server timestamp
             * @returns {Object} Server timestamp
             */
            serverTime() {
                return serverTimestamp();
            },

            /**
             * Format date
             * @param {string|Date} date - Date to format
             * @returns {string} Formatted date
             */
            formatDate(date) {
                return new Date(date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            },

            /**
             * Format currency
             * @param {number} amount - Amount to format
             * @returns {string} Formatted currency
             */
            formatCurrency(amount) {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(amount);
            },

            /**
             * Deep clone object
             * @param {Object} obj - Object to clone
             * @returns {Object} Cloned object
             */
            clone(obj) {
                return JSON.parse(JSON.stringify(obj));
            },

            /**
             * Sanitize data for storage
             * @param {*} data - Data to sanitize
             * @returns {*} Sanitized data
             */
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

            /**
             * Delay execution
             * @param {number} ms - Milliseconds to delay
             * @returns {Promise} Promise that resolves after delay
             */
            delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            },

            /**
             * Generate slug from text
             * @param {string} text - Text to slugify
             * @returns {string} Slug
             */
            slugify(text) {
                return text
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
            },

            /**
             * Check if object is empty
             * @param {Object} obj - Object to check
             * @returns {boolean} True if empty
             */
            isEmpty(obj) {
                return !obj || Object.keys(obj).length === 0;
            },

            /**
             * Pluck field from array of objects
             * @param {Array} arr - Array of objects
             * @param {string} field - Field to pluck
             * @returns {Array} Plucked values
             */
            pluck(arr, field) {
                return arr.map(item => item[field]);
            },

            /**
             * Group array by field
             * @param {Array} arr - Array to group
             * @param {string} field - Field to group by
             * @returns {Object} Grouped object
             */
            groupBy(arr, field) {
                return arr.reduce((acc, item) => {
                    const key = item[field] || 'unknown';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                }, {});
            }
        };

        // ============================================================
        //  COLLECTION MANAGER CLASS
        // ============================================================
        class CollectionManager {
            /**
             * Create a new collection manager
             * @param {string} name - Collection name
             */
            constructor(name) {
                this.name = name;
                this.collectionRef = collection(db, name);
                this._listeners = [];
                this._cache = new Map();
            }

            /**
             * Add a new document
             * @param {Object} data - Document data
             * @returns {Promise<Object>} Created document
             */
            async add(data) {
                try {
                    const docRef = await addDoc(this.collectionRef, {
                        ...data,
                        _createdAt: serverTimestamp(),
                        _updatedAt: serverTimestamp(),
                        _id: Utils.uid()
                    });
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`[${this.name}] Add error:`, error);
                    throw { code: 'DB_ADD_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Set a document with specific ID
             * @param {string} id - Document ID
             * @param {Object} data - Document data
             * @param {boolean} merge - Whether to merge
             * @returns {Promise<Object>} Set document
             */
            async set(id, data, merge = true) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await setDoc(docRef, {
                        ...data,
                        _updatedAt: serverTimestamp()
                    }, { merge });
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`[${this.name}] Set error:`, error);
                    throw { code: 'DB_SET_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Get a document by ID
             * @param {string} id - Document ID
             * @returns {Promise<Object|null>} Document or null
             */
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

            /**
             * Get all documents
             * @param {Object} options - Query options
             * @returns {Promise<Array>} Array of documents
             */
            async getAll(options = {}) {
                try {
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
                    return results;
                } catch (error) {
                    console.error(`[${this.name}] GetAll error:`, error);
                    throw { code: 'DB_GET_ALL_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Count documents in collection
             * @returns {Promise<number>} Document count
             */
            async count() {
                try {
                    const snapshot = await getCountFromServer(this.collectionRef);
                    return snapshot.data().count;
                } catch (error) {
                    console.error(`[${this.name}] Count error:`, error);
                    throw { code: 'DB_COUNT_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Update a document
             * @param {string} id - Document ID
             * @param {Object} data - Update data
             * @returns {Promise<Object>} Updated document
             */
            async update(id, data) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await updateDoc(docRef, {
                        ...data,
                        _updatedAt: serverTimestamp()
                    });
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    console.error(`[${this.name}] Update error:`, error);
                    throw { code: 'DB_UPDATE_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Delete a document
             * @param {string} id - Document ID
             * @returns {Promise<Object>} Deleted document info
             */
            async delete(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    await deleteDoc(docRef);
                    return { id, deleted: true };
                } catch (error) {
                    console.error(`[${this.name}] Delete error:`, error);
                    throw { code: 'DB_DELETE_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Get latest documents
             * @param {number} count - Number of documents
             * @returns {Promise<Array>} Latest documents
             */
            async latest(count = 10) {
                try {
                    const q = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(count));
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

            /**
             * Search documents by field
             * @param {string} field - Field to search
             * @param {string} term - Search term
             * @param {Object} options - Additional options
             * @returns {Promise<Array>} Search results
             */
            async search(field, term, options = {}) {
                try {
                    const data = await this.getAll(options);
                    const searchLower = term.toLowerCase();
                    return data.filter(item => {
                        const value = item[field] || '';
                        return String(value).toLowerCase().includes(searchLower);
                    });
                } catch (error) {
                    console.error(`[${this.name}] Search error:`, error);
                    throw { code: 'DB_SEARCH_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Listen to realtime updates
             * @param {Function} callback - Callback function
             * @param {Object} conditions - Query conditions
             * @returns {Function} Unsubscribe function
             */
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
                        console.error(`[${this.name}] Listen error:`, error);
                        callback(null, error);
                    });

                    this._listeners.push(unsubscribe);
                    return unsubscribe;
                } catch (error) {
                    console.error(`[${this.name}] Listen setup error:`, error);
                    throw { code: 'DB_LISTEN_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Query with where conditions
             * @param {string} field - Field name
             * @param {string} operator - Query operator
             * @param {*} value - Query value
             * @returns {Object} Query builder
             */
            where(field, operator, value) {
                return {
                    _collection: this,
                    _query: query(this.collectionRef, where(field, operator, value)),

                    async exec() {
                        try {
                            const snapshot = await getDocs(this._query);
                            const results = [];
                            snapshot.forEach(doc => {
                                results.push({ id: doc.id, ...doc.data() });
                            });
                            return results;
                        } catch (error) {
                            console.error(`[${this._collection.name}] Where exec error:`, error);
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
                            console.error(`[${this._collection.name}] Where listen error:`, error);
                            callback(null, error);
                        });
                    }
                };
            }

            /**
             * Batch write multiple operations
             * @param {Array} operations - Array of operations
             * @returns {Promise<Object>} Batch result
             */
            async batch(operations) {
                try {
                    const batch = writeBatch(db);
                    for (const op of operations) {
                        const ref = doc(this.collectionRef, op.id);
                        if (op.type === 'set') {
                            batch.set(ref, { ...op.data, _updatedAt: serverTimestamp() }, { merge: op.merge !== false });
                        } else if (op.type === 'update') {
                            batch.update(ref, { ...op.data, _updatedAt: serverTimestamp() });
                        } else if (op.type === 'delete') {
                            batch.delete(ref);
                        }
                    }
                    await batch.commit();
                    return { success: true, count: operations.length };
                } catch (error) {
                    console.error(`[${this.name}] Batch error:`, error);
                    throw { code: 'DB_BATCH_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Run a transaction
             * @param {Function} callback - Transaction callback
             * @returns {Promise<*>} Transaction result
             */
            async transaction(callback) {
                try {
                    return await runTransaction(db, async (transaction) => {
                        return await callback(transaction, this.collectionRef);
                    });
                } catch (error) {
                    console.error(`[${this.name}] Transaction error:`, error);
                    throw { code: 'DB_TRANSACTION_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Delete all documents
             * @returns {Promise<Object>} Deleted count
             */
            async deleteAll() {
                try {
                    const snapshot = await getDocs(this.collectionRef);
                    const batch = writeBatch(db);
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    return { deleted: snapshot.size };
                } catch (error) {
                    console.error(`[${this.name}] DeleteAll error:`, error);
                    throw { code: 'DB_DELETE_ALL_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Get document reference
             * @param {string} id - Document ID
             * @returns {Object} Document reference
             */
            ref(id) {
                return doc(this.collectionRef, id);
            }
        }

        // ============================================================
        //  CREATE COLLECTION MANAGERS
        // ============================================================
        const collections = {};
        const COLLECTION_NAMES = [
            'products', 'categories', 'customers', 'orders', 'inventory',
            'users', 'offers', 'blogs', 'notifications', 'activityLogs',
            'analytics', 'settings', 'cart', 'wishlist', 'crm',
            'franchise', 'cloudKitchen', 'supportTickets', 'coupons',
            'reviews', 'banners', 'testimonials', 'partners'
        ];

        COLLECTION_NAMES.forEach(name => {
            collections[name] = new CollectionManager(name);
        });

        // ============================================================
        //  PRODUCTS MODULE
        // ============================================================
        const products = {
            /**
             * Add a product
             * @param {Object} data - Product data
             * @returns {Promise<Object>} Created product
             */
            add: (data) => collections.products.add(data),

            /**
             * Update a product
             * @param {string} id - Product ID
             * @param {Object} data - Update data
             * @returns {Promise<Object>} Updated product
             */
            update: (id, data) => collections.products.update(id, data),

            /**
             * Delete a product
             * @param {string} id - Product ID
             * @returns {Promise<Object>} Deleted product
             */
            delete: (id) => collections.products.delete(id),

            /**
             * Get a product by ID
             * @param {string} id - Product ID
             * @returns {Promise<Object|null>} Product or null
             */
            get: (id) => collections.products.get(id),

            /**
             * Get all products
             * @param {Object} options - Query options
             * @returns {Promise<Array>} Products
             */
            getAll: (options) => collections.products.getAll(options),

            /**
             * Count products
             * @returns {Promise<number>} Product count
             */
            count: () => collections.products.count(),

            /**
             * Get latest products
             * @param {number} count - Number of products
             * @returns {Promise<Array>} Latest products
             */
            latest: (count) => collections.products.latest(count),

            /**
             * Search products
             * @param {string} term - Search term
             * @param {Object} options - Search options
             * @returns {Promise<Array>} Search results
             */
            search: (term, options) => collections.products.search('name', term, options),

            /**
             * Listen to product updates
             * @param {Function} callback - Callback function
             * @param {Object} conditions - Query conditions
             * @returns {Function} Unsubscribe function
             */
            listen: (callback, conditions) => collections.products.listen(callback, conditions),

            /**
             * Update product stock
             * @param {string} id - Product ID
             * @param {number} stock - New stock
             * @returns {Promise<Object>} Updated product
             */
            updateStock: async (id, stock) => {
                return await collections.products.update(id, { stock, stockUpdatedAt: serverTimestamp() });
            },

            /**
             * Update product price
             * @param {string} id - Product ID
             * @param {number} price - New price
             * @param {number} offerPrice - New offer price
             * @returns {Promise<Object>} Updated product
             */
            updatePrice: async (id, price, offerPrice = null) => {
                const data = { price };
                if (offerPrice !== null) data.offerPrice = offerPrice;
                return await collections.products.update(id, data);
            },

            /**
             * Get featured products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Featured products
             */
            getFeatured: async (limit = 8) => {
                const products = await collections.products.where('featured', '==', true).exec();
                return products.slice(0, limit);
            },

            /**
             * Get trending products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Trending products
             */
            getTrending: async (limit = 8) => {
                const products = await collections.products.where('trending', '==', true).exec();
                return products.slice(0, limit);
            },

            /**
             * Get products by category
             * @param {string} category - Category name
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Products
             */
            getByCategory: async (category, limit = 20) => {
                return await collections.products.where('category', '==', category).exec();
            },

            /**
             * Get products by offer
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Products with offers
             */
            getByOffer: async (limit = 20) => {
                const products = await collections.products.all();
                return products
                    .filter(p => p.offerPrice && p.offerPrice < p.price)
                    .slice(0, limit);
            },

            /**
             * Batch update products
             * @param {Array} operations - Array of operations
             * @returns {Promise<Object>} Batch result
             */
            batch: (operations) => collections.products.batch(operations),

            /**
             * Run transaction on products
             * @param {Function} callback - Transaction callback
             * @returns {Promise<*>} Transaction result
             */
            transaction: (callback) => collections.products.transaction(callback)
        };

        // ============================================================
        //  CATEGORIES MODULE
        // ============================================================
        const categories = {
            add: (data) => collections.categories.add(data),
            update: (id, data) => collections.categories.update(id, data),
            delete: (id) => collections.categories.delete(id),
            get: (id) => collections.categories.get(id),
            getAll: (options) => collections.categories.getAll(options),
            count: () => collections.categories.count(),
            latest: (count) => collections.categories.latest(count),
            search: (term, options) => collections.categories.search('name', term, options),
            listen: (callback, conditions) => collections.categories.listen(callback, conditions),
            batch: (operations) => collections.categories.batch(operations),
            transaction: (callback) => collections.categories.transaction(callback)
        };

        // ============================================================
        //  ORDERS MODULE
        // ============================================================
        const orders = {
            add: (data) => collections.orders.add(data),
            update: (id, data) => collections.orders.update(id, data),
            delete: (id) => collections.orders.delete(id),
            get: (id) => collections.orders.get(id),
            getAll: (options) => collections.orders.getAll(options),
            count: () => collections.orders.count(),
            latest: (count) => collections.orders.latest(count),
            search: (term, options) => collections.orders.search('id', term, options),
            listen: (callback, conditions) => collections.orders.listen(callback, conditions),
            batch: (operations) => collections.orders.batch(operations),
            transaction: (callback) => collections.orders.transaction(callback),

            /**
             * Create an order
             * @param {Object} data - Order data
             * @returns {Promise<Object>} Created order
             */
            create: async (data) => {
                const {
                    customerId,
                    items,
                    shippingAddress,
                    paymentMethod,
                    notes = ''
                } = data;

                const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const tax = subtotal * 0.05;
                const deliveryCharge = subtotal > 499 ? 0 : 49;
                const total = subtotal + tax + deliveryCharge;

                return await collections.orders.add({
                    customerId,
                    items: items.map(item => ({
                        ...item,
                        subtotal: item.price * item.quantity
                    })),
                    shippingAddress,
                    paymentMethod,
                    notes,
                    subtotal,
                    tax,
                    deliveryCharge,
                    grandTotal: total,
                    status: 'pending',
                    paymentStatus: 'pending'
                });
            },

            /**
             * Update order status
             * @param {string} id - Order ID
             * @param {string} status - New status
             * @returns {Promise<Object>} Updated order
             */
            updateStatus: async (id, status) => {
                return await collections.orders.update(id, {
                    status,
                    statusUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Get orders by customer
             * @param {string} customerId - Customer ID
             * @returns {Promise<Array>} Orders
             */
            getByCustomer: async (customerId) => {
                return await collections.orders.where('customerId', '==', customerId).exec();
            },

            /**
             * Get orders by status
             * @param {string} status - Order status
             * @returns {Promise<Array>} Orders
             */
            getByStatus: async (status) => {
                return await collections.orders.where('status', '==', status).exec();
            },

            /**
             * Get revenue
             * @param {string} period - Period filter
             * @returns {Promise<number>} Revenue
             */
            getRevenue: async (period = 'all') => {
                const orders = await collections.orders.where('status', 'in', ['delivered', 'completed']).exec();
                return orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
            },

            /**
             * Get order count by status
             * @returns {Promise<Object>} Status counts
             */
            getStatusCounts: async () => {
                const allOrders = await collections.orders.getAll();
                const statuses = {};
                allOrders.forEach(order => {
                    const status = order.status || 'pending';
                    statuses[status] = (statuses[status] || 0) + 1;
                });
                return statuses;
            }
        };

        // ============================================================
        //  CUSTOMERS MODULE
        // ============================================================
        const customers = {
            add: (data) => collections.customers.add(data),
            update: (id, data) => collections.customers.update(id, data),
            delete: (id) => collections.customers.delete(id),
            get: (id) => collections.customers.get(id),
            getAll: (options) => collections.customers.getAll(options),
            count: () => collections.customers.count(),
            latest: (count) => collections.customers.latest(count),
            search: (term, options) => collections.customers.search('name', term, options),
            listen: (callback, conditions) => collections.customers.listen(callback, conditions),
            batch: (operations) => collections.customers.batch(operations),
            transaction: (callback) => collections.customers.transaction(callback),

            /**
             * Get customer orders
             * @param {string} id - Customer ID
             * @returns {Promise<Array>} Customer orders
             */
            getOrders: async (id) => {
                return await collections.orders.where('customerId', '==', id).exec();
            },

            /**
             * Get customer statistics
             * @param {string} id - Customer ID
             * @returns {Promise<Object>} Customer statistics
             */
            getStats: async (id) => {
                const orders = await collections.orders.where('customerId', '==', id).exec();
                const totalOrders = orders.length;
                const totalSpent = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                const averageOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

                return {
                    totalOrders,
                    totalSpent,
                    averageOrder,
                    lastOrder: orders.length > 0 ? orders[0] : null
                };
            },

            /**
             * Get top customers by spending
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Top customers
             */
            getTopSpenders: async (limit = 10) => {
                const allCustomers = await collections.customers.getAll();
                const customerSpending = await Promise.all(
                    allCustomers.map(async (customer) => {
                        const stats = await customers.getStats(customer.id);
                        return { ...customer, ...stats };
                    })
                );
                return customerSpending
                    .filter(c => c.totalSpent > 0)
                    .sort((a, b) => b.totalSpent - a.totalSpent)
                    .slice(0, limit);
            }
        };

        // ============================================================
        //  INVENTORY MODULE
        // ============================================================
        const inventory = {
            add: (data) => collections.inventory.add(data),
            update: (id, data) => collections.inventory.update(id, data),
            delete: (id) => collections.inventory.delete(id),
            get: (id) => collections.inventory.get(id),
            getAll: (options) => collections.inventory.getAll(options),
            count: () => collections.inventory.count(),
            latest: (count) => collections.inventory.latest(count),
            search: (term, options) => collections.inventory.search('name', term, options),
            listen: (callback, conditions) => collections.inventory.listen(callback, conditions),
            batch: (operations) => collections.inventory.batch(operations),
            transaction: (callback) => collections.inventory.transaction(callback),

            /**
             * Update stock
             * @param {string} id - Product ID
             * @param {number} stock - New stock
             * @returns {Promise<Object>} Updated inventory
             */
            updateStock: async (id, stock) => {
                return await collections.inventory.update(id, {
                    stock,
                    stockUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Adjust stock (add or subtract)
             * @param {string} id - Product ID
             * @param {number} adjustment - Adjustment value
             * @returns {Promise<Object>} Updated inventory
             */
            adjustStock: async (id, adjustment) => {
                const item = await collections.inventory.get(id);
                if (!item) {
                    throw new Error('Inventory item not found');
                }
                const newStock = (item.stock || 0) + adjustment;
                if (newStock < 0) {
                    throw new Error('Insufficient stock');
                }
                return await collections.inventory.update(id, {
                    stock: newStock,
                    stockUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Get low stock items
             * @param {number} threshold - Stock threshold
             * @returns {Promise<Array>} Low stock items
             */
            getLowStock: async (threshold = 5) => {
                const items = await collections.inventory.getAll();
                return items.filter(item => (item.stock || 0) < threshold);
            },

            /**
             * Get out of stock items
             * @returns {Promise<Array>} Out of stock items
             */
            getOutOfStock: async () => {
                const items = await collections.inventory.getAll();
                return items.filter(item => (item.stock || 0) <= 0);
            },

            /**
             * Get inventory value
             * @returns {Promise<number>} Total inventory value
             */
            getValue: async () => {
                const items = await collections.inventory.getAll();
                return items.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
            }
        };

        // ============================================================
        //  USERS MODULE
        // ============================================================
        const users = {
            add: (data) => collections.users.add(data),
            update: (id, data) => collections.users.update(id, data),
            delete: (id) => collections.users.delete(id),
            get: (id) => collections.users.get(id),
            getAll: (options) => collections.users.getAll(options),
            count: () => collections.users.count(),
            latest: (count) => collections.users.latest(count),
            search: (term, options) => collections.users.search('name', term, options),
            listen: (callback, conditions) => collections.users.listen(callback, conditions),
            batch: (operations) => collections.users.batch(operations),
            transaction: (callback) => collections.users.transaction(callback),

            /**
             * Get user by email
             * @param {string} email - User email
             * @returns {Promise<Object|null>} User or null
             */
            getByEmail: async (email) => {
                const users = await collections.users.where('email', '==', email).exec();
                return users.length > 0 ? users[0] : null;
            },

            /**
             * Get user by role
             * @param {string} role - User role
             * @returns {Promise<Array>} Users with role
             */
            getByRole: async (role) => {
                return await collections.users.where('role', '==', role).exec();
            },

            /**
             * Update user role
             * @param {string} id - User ID
             * @param {string} role - New role
             * @returns {Promise<Object>} Updated user
             */
            updateRole: async (id, role) => {
                return await collections.users.update(id, { role });
            }
        };

        // ============================================================
        //  OFFERS MODULE
        // ============================================================
        const offers = {
            add: (data) => collections.offers.add(data),
            update: (id, data) => collections.offers.update(id, data),
            delete: (id) => collections.offers.delete(id),
            get: (id) => collections.offers.get(id),
            getAll: (options) => collections.offers.getAll(options),
            count: () => collections.offers.count(),
            latest: (count) => collections.offers.latest(count),
            search: (term, options) => collections.offers.search('title', term, options),
            listen: (callback, conditions) => collections.offers.listen(callback, conditions),
            batch: (operations) => collections.offers.batch(operations),
            transaction: (callback) => collections.offers.transaction(callback),

            /**
             * Get active offers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Active offers
             */
            getActive: async (limit = 10) => {
                const now = Utils.now();
                const offers = await collections.offers.where('active', '==', true).exec();
                return offers
                    .filter(o => !o.expiresAt || o.expiresAt > now)
                    .slice(0, limit);
            },

            /**
             * Get offers by type
             * @param {string} type - Offer type
             * @returns {Promise<Array>} Offers
             */
            getByType: async (type) => {
                return await collections.offers.where('type', '==', type).exec();
            }
        };

        // ============================================================
        //  BLOGS MODULE
        // ============================================================
        const blogs = {
            add: (data) => collections.blogs.add(data),
            update: (id, data) => collections.blogs.update(id, data),
            delete: (id) => collections.blogs.delete(id),
            get: (id) => collections.blogs.get(id),
            getAll: (options) => collections.blogs.getAll(options),
            count: () => collections.blogs.count(),
            latest: (count) => collections.blogs.latest(count),
            search: (term, options) => collections.blogs.search('title', term, options),
            listen: (callback, conditions) => collections.blogs.listen(callback, conditions),
            batch: (operations) => collections.blogs.batch(operations),
            transaction: (callback) => collections.blogs.transaction(callback),

            /**
             * Get published blogs
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Published blogs
             */
            getPublished: async (limit = 10) => {
                const blogs = await collections.blogs.where('published', '==', true).exec();
                return blogs.slice(0, limit);
            },

            /**
             * Get blogs by category
             * @param {string} category - Category name
             * @returns {Promise<Array>} Blogs
             */
            getByCategory: async (category) => {
                return await collections.blogs.where('category', '==', category).exec();
            },

            /**
             * Get blogs by author
             * @param {string} author - Author name
             * @returns {Promise<Array>} Blogs
             */
            getByAuthor: async (author) => {
                return await collections.blogs.where('author', '==', author).exec();
            },

            /**
             * Publish a blog
             * @param {string} id - Blog ID
             * @returns {Promise<Object>} Updated blog
             */
            publish: async (id) => {
                return await collections.blogs.update(id, {
                    published: true,
                    publishedAt: serverTimestamp()
                });
            },

            /**
             * Unpublish a blog
             * @param {string} id - Blog ID
             * @returns {Promise<Object>} Updated blog
             */
            unpublish: async (id) => {
                return await collections.blogs.update(id, {
                    published: false
                });
            }
        };

        // ============================================================
        //  NOTIFICATIONS MODULE
        // ============================================================
        const notifications = {
            add: (data) => collections.notifications.add(data),
            update: (id, data) => collections.notifications.update(id, data),
            delete: (id) => collections.notifications.delete(id),
            get: (id) => collections.notifications.get(id),
            getAll: (options) => collections.notifications.getAll(options),
            count: () => collections.notifications.count(),
            latest: (count) => collections.notifications.latest(count),
            listen: (callback, conditions) => collections.notifications.listen(callback, conditions),
            batch: (operations) => collections.notifications.batch(operations),
            transaction: (callback) => collections.notifications.transaction(callback),

            /**
             * Create notification for user
             * @param {string} userId - User ID
             * @param {string} title - Notification title
             * @param {string} message - Notification message
             * @param {string} type - Notification type
             * @param {Object} data - Additional data
             * @returns {Promise<Object>} Created notification
             */
            send: async (userId, title, message, type = 'info', data = {}) => {
                return await collections.notifications.add({
                    userId,
                    title,
                    message,
                    type,
                    data,
                    read: false
                });
            },

            /**
             * Mark notification as read
             * @param {string} id - Notification ID
             * @returns {Promise<Object>} Updated notification
             */
            markRead: async (id) => {
                return await collections.notifications.update(id, { read: true });
            },

            /**
             * Mark all notifications as read for user
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Result
             */
            markAllRead: async (userId) => {
                const notifs = await collections.notifications.where('userId', '==', userId).exec();
                const ids = notifs.map(n => n.id);
                if (ids.length === 0) return { count: 0 };
                await collections.notifications.batch(
                    ids.map(id => ({ id, type: 'update', data: { read: true } }))
                );
                return { count: ids.length };
            },

            /**
             * Get unread count for user
             * @param {string} userId - User ID
             * @returns {Promise<number>} Unread count
             */
            getUnreadCount: async (userId) => {
                const notifs = await collections.notifications.where('userId', '==', userId).exec();
                return notifs.filter(n => !n.read).length;
            },

            /**
             * Get notifications for user
             * @param {string} userId - User ID
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Notifications
             */
            getByUser: async (userId, limit = 50) => {
                const notifs = await collections.notifications.where('userId', '==', userId).exec();
                return notifs.slice(0, limit);
            },

            /**
             * Delete notification for user
             * @param {string} id - Notification ID
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Deleted notification
             */
            deleteForUser: async (id, userId) => {
                const notif = await collections.notifications.get(id);
                if (notif && notif.userId === userId) {
                    return await collections.notifications.delete(id);
                }
                throw new Error('Notification not found or unauthorized');
            }
        };

        // ============================================================
        //  ACTIVITY LOGS MODULE
        // ============================================================
        const activityLogs = {
            add: (data) => collections.activityLogs.add(data),
            update: (id, data) => collections.activityLogs.update(id, data),
            delete: (id) => collections.activityLogs.delete(id),
            get: (id) => collections.activityLogs.get(id),
            getAll: (options) => collections.activityLogs.getAll(options),
            count: () => collections.activityLogs.count(),
            latest: (count) => collections.activityLogs.latest(count),
            listen: (callback, conditions) => collections.activityLogs.listen(callback, conditions),
            batch: (operations) => collections.activityLogs.batch(operations),
            transaction: (callback) => collections.activityLogs.transaction(callback),

            /**
             * Log an activity
             * @param {string} action - Action name
             * @param {Object} details - Activity details
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Created activity
             */
            log: async (action, details = {}, userId = null) => {
                const user = userId || auth.currentUser?.uid || 'system';
                return await collections.activityLogs.add({
                    action,
                    details: Utils.sanitize(details),
                    userId: user,
                    userEmail: auth.currentUser?.email || 'system',
                    timestamp: serverTimestamp(),
                    date: Utils.now()
                });
            },

            /**
             * Get activities by user
             * @param {string} userId - User ID
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Activities
             */
            getByUser: async (userId, limit = 20) => {
                const activities = await collections.activityLogs.where('userId', '==', userId).exec();
                return activities.slice(0, limit);
            },

            /**
             * Get activities by action
             * @param {string} action - Action name
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Activities
             */
            getByAction: async (action, limit = 20) => {
                const activities = await collections.activityLogs.where('action', '==', action).exec();
                return activities.slice(0, limit);
            },

            /**
             * Get recent activities with pagination
             * @param {number} page - Page number
             * @param {number} size - Page size
             * @returns {Promise<Object>} Paginated activities
             */
            getRecent: async (page = 1, size = 20) => {
                return await collections.activityLogs.page(page, size);
            }
        };

        // ============================================================
        //  ANALYTICS MODULE
        // ============================================================
        const analytics = {
            /**
             * Get revenue analytics
             * @returns {Promise<Object>} Revenue analytics
             */
            getRevenue: async () => {
                const orders = await collections.orders.where('status', 'in', ['delivered', 'completed']).exec();
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const yearStart = new Date(today.getFullYear(), 0, 1);

                const todayRevenue = orders
                    .filter(o => new Date(o._updatedAt || o._createdAt) >= today)
                    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

                const monthlyRevenue = orders
                    .filter(o => new Date(o._updatedAt || o._createdAt) >= monthStart)
                    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

                const yearlyRevenue = orders
                    .filter(o => new Date(o._updatedAt || o._createdAt) >= yearStart)
                    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

                const totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                const averageOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

                return {
                    todayRevenue,
                    monthlyRevenue,
                    yearlyRevenue,
                    totalRevenue,
                    averageOrder,
                    totalOrders: orders.length
                };
            },

            /**
             * Get sales chart data
             * @param {number} days - Number of days
             * @returns {Promise<Array>} Sales chart data
             */
            getSalesChart: async (days = 30) => {
                const orders = await collections.orders.where('status', 'in', ['delivered', 'completed']).exec();
                const chart = {};
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);

                orders.forEach(order => {
                    const date = new Date(order._updatedAt || order._createdAt);
                    if (date < startDate) return;
                    const key = date.toISOString().split('T')[0];
                    if (!chart[key]) {
                        chart[key] = { date: key, revenue: 0, orders: 0 };
                    }
                    chart[key].revenue += order.grandTotal || 0;
                    chart[key].orders += 1;
                });

                return Object.values(chart).sort((a, b) => a.date.localeCompare(b.date));
            },

            /**
             * Get order status distribution
             * @returns {Promise<Object>} Order status distribution
             */
            getOrderStatus: async () => {
                const orders = await collections.orders.getAll();
                const statuses = {};
                orders.forEach(order => {
                    const status = order.status || 'pending';
                    statuses[status] = (statuses[status] || 0) + 1;
                });
                return statuses;
            },

            /**
             * Get customer growth
             * @param {number} days - Number of days
             * @returns {Promise<Array>} Customer growth data
             */
            getCustomerGrowth: async (days = 30) => {
                const customers = await collections.customers.getAll();
                const growth = {};
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);

                customers.forEach(customer => {
                    const date = new Date(customer._createdAt || customer.createdAt);
                    if (date < startDate) return;
                    const key = date.toISOString().split('T')[0];
                    if (!growth[key]) {
                        growth[key] = { date: key, new: 0, total: 0 };
                    }
                    growth[key].new += 1;
                });

                let runningTotal = customers.filter(c => {
                    const date = new Date(c._createdAt || c.createdAt);
                    return date < startDate;
                }).length;

                Object.values(growth).sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
                    runningTotal += item.new;
                    item.total = runningTotal;
                });

                return Object.values(growth).sort((a, b) => a.date.localeCompare(b.date));
            },

            /**
             * Get inventory value
             * @returns {Promise<number>} Inventory value
             */
            getInventoryValue: async () => {
                const items = await collections.inventory.getAll();
                return items.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
            },

            /**
             * Get top selling products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Top selling products
             */
            getTopSelling: async (limit = 10) => {
                const orders = await collections.orders.getAll();
                const productSales = {};

                orders.forEach(order => {
                    (order.items || []).forEach(item => {
                        const id = item.productId || item.id;
                        if (!id) return;
                        if (!productSales[id]) {
                            productSales[id] = { productId: id, quantity: 0, revenue: 0, product: item };
                        }
                        productSales[id].quantity += item.quantity || 1;
                        productSales[id].revenue += (item.price || 0) * (item.quantity || 1);
                    });
                });

                return Object.values(productSales)
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, limit);
            }
        };

        // ============================================================
        //  DASHBOARD MODULE
        // ============================================================
        const dashboard = {
            /**
             * Get dashboard summary
             * @returns {Promise<Object>} Dashboard summary
             */
            getSummary: async () => {
                const [products, customers, orders, categories, inventory] = await Promise.all([
                    collections.products.count(),
                    collections.customers.count(),
                    collections.orders.count(),
                    collections.categories.count(),
                    collections.inventory.getAll()
                ]);

                const pendingOrders = await collections.orders.where('status', '==', 'pending').exec();
                const deliveredOrders = await collections.orders.where('status', '==', 'delivered').exec();
                const cancelledOrders = await collections.orders.where('status', '==', 'cancelled').exec();

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
            },

            /**
             * Get recent orders
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Recent orders
             */
            getRecentOrders: (limit = 5) => collections.orders.latest(limit),

            /**
             * Get recent customers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Recent customers
             */
            getRecentCustomers: (limit = 5) => collections.customers.latest(limit),

            /**
             * Get low stock items
             * @param {number} threshold - Stock threshold
             * @returns {Promise<Array>} Low stock items
             */
            getLowStock: async (threshold = 5) => {
                const items = await collections.inventory.getAll();
                return items.filter(item => (item.stock || 0) < threshold);
            },

            /**
             * Get chart data
             * @returns {Promise<Object>} Chart data
             */
            getCharts: async () => {
                const [sales, orderStatus, customerGrowth] = await Promise.all([
                    analytics.getSalesChart(30),
                    analytics.getOrderStatus(),
                    analytics.getCustomerGrowth(30)
                ]);

                return { sales, orderStatus, customerGrowth };
            },

            /**
             * Get quick stats for dashboard
             * @returns {Promise<Object>} Quick stats
             */
            getQuickStats: async () => {
                const [revenue, products, customers, orders] = await Promise.all([
                    analytics.getRevenue(),
                    collections.products.count(),
                    collections.customers.count(),
                    collections.orders.count()
                ]);

                return {
                    revenue,
                    totalProducts: products,
                    totalCustomers: customers,
                    totalOrders: orders
                };
            }
        };

        // ============================================================
        //  STORAGE MODULE
        // ============================================================
        const storage = {
            /**
             * Upload a file
             * @param {string} path - Storage path
             * @param {File} file - File to upload
             * @param {Object} metadata - File metadata
             * @param {Function} onProgress - Progress callback
             * @returns {Promise<Object>} Upload result
             */
            upload: async (path, file, metadata = {}, onProgress = null) => {
                try {
                    const storageRef = ref(storage, path);
                    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

                    return new Promise((resolve, reject) => {
                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                if (onProgress) onProgress(progress);
                            },
                            (error) => reject(error),
                            async () => {
                                const url = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve({
                                    url,
                                    path,
                                    ref: uploadTask.snapshot.ref,
                                    metadata: {
                                        name: file.name,
                                        size: file.size,
                                        type: file.type
                                    }
                                });
                            }
                        );
                    });
                } catch (error) {
                    console.error('Storage upload error:', error);
                    throw { code: 'STORAGE_UPLOAD_ERROR', message: error.message };
                }
            },

            /**
             * Upload product image
             * @param {string} productId - Product ID
             * @param {File} file - Image file
             * @param {Function} onProgress - Progress callback
             * @returns {Promise<string>} Image URL
             */
            uploadProductImage: async (productId, file, onProgress = null) => {
                const path = `products/${productId}/image_${Date.now()}.jpg`;
                const result = await storage.upload(path, file, { contentType: file.type }, onProgress);
                return result.url;
            },

            /**
             * Upload customer profile image
             * @param {string} customerId - Customer ID
             * @param {File} file - Image file
             * @param {Function} onProgress - Progress callback
             * @returns {Promise<string>} Image URL
             */
            uploadCustomerImage: async (customerId, file, onProgress = null) => {
                const path = `customers/${customerId}/profile_${Date.now()}.jpg`;
                const result = await storage.upload(path, file, { contentType: file.type }, onProgress);
                return result.url;
            },

            /**
             * Upload blog image
             * @param {string} blogId - Blog ID
             * @param {File} file - Image file
             * @param {Function} onProgress - Progress callback
             * @returns {Promise<string>} Image URL
             */
            uploadBlogImage: async (blogId, file, onProgress = null) => {
                const path = `blogs/${blogId}/image_${Date.now()}.jpg`;
                const result = await storage.upload(path, file, { contentType: file.type }, onProgress);
                return result.url;
            },

            /**
             * Delete a file
             * @param {string} path - File path
             * @returns {Promise<Object>} Delete result
             */
            delete: async (path) => {
                try {
                    const storageRef = ref(storage, path);
                    await deleteObject(storageRef);
                    return { deleted: true, path };
                } catch (error) {
                    console.error('Storage delete error:', error);
                    throw { code: 'STORAGE_DELETE_ERROR', message: error.message };
                }
            },

            /**
             * Get download URL
             * @param {string} path - File path
             * @returns {Promise<string>} Download URL
             */
            getURL: async (path) => {
                try {
                    const storageRef = ref(storage, path);
                    return await getDownloadURL(storageRef);
                } catch (error) {
                    console.error('Storage get URL error:', error);
                    throw { code: 'STORAGE_URL_ERROR', message: error.message };
                }
            },

            /**
             * List files in a directory
             * @param {string} prefix - Directory prefix
             * @returns {Promise<Object>} File list
             */
            list: async (prefix) => {
                try {
                    const storageRef = ref(storage, prefix);
                    const result = await listAll(storageRef);
                    return {
                        items: result.items.map(item => ({
                            name: item.name,
                            path: item.fullPath
                        })),
                        prefixes: result.prefixes
                    };
                } catch (error) {
                    console.error('Storage list error:', error);
                    throw { code: 'STORAGE_LIST_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  AUTH MODULE
        // ============================================================
        const auth = {
            /**
             * Get current user
             * @returns {Object|null} Current user
             */
            get currentUser() {
                return auth.currentUser;
            },

            /**
             * Check if user is logged in
             * @returns {boolean} Logged in status
             */
            get isLoggedIn() {
                return !!auth.currentUser;
            },

            /**
             * Get user role
             * @param {string} userId - User ID
             * @returns {Promise<string|null>} User role
             */
            getRole: async (userId = null) => {
                try {
                    const uid = userId || auth.currentUser?.uid;
                    if (!uid) return null;
                    const userDoc = await collections.users.get(uid);
                    return userDoc?.role || 'customer';
                } catch (error) {
                    console.error('Get role error:', error);
                    return null;
                }
            },

            /**
             * Check if user is admin
             * @param {string} userId - User ID
             * @returns {Promise<boolean>} True if admin
             */
            isAdmin: async (userId = null) => {
                const role = await auth.getRole(userId);
                return role === 'admin' || role === 'super_admin';
            },

            /**
             * Check if user is vendor
             * @param {string} userId - User ID
             * @returns {Promise<boolean>} True if vendor
             */
            isVendor: async (userId = null) => {
                const role = await auth.getRole(userId);
                return role === 'vendor' || role === 'admin' || role === 'super_admin';
            },

            /**
             * Require admin role
             * @param {string} userId - User ID
             * @returns {Promise<boolean>} True if admin
             */
            requireAdmin: async (userId = null) => {
                const isAdmin = await auth.isAdmin(userId);
                if (!isAdmin) {
                    throw { code: 'AUTH_REQUIRED', message: 'Admin privileges required' };
                }
                return true;
            },

            /**
             * Require vendor role
             * @param {string} userId - User ID
             * @returns {Promise<boolean>} True if vendor
             */
            requireVendor: async (userId = null) => {
                const isVendor = await auth.isVendor(userId);
                if (!isVendor) {
                    throw { code: 'AUTH_REQUIRED', message: 'Vendor privileges required' };
                }
                return true;
            },

            /**
             * Update user profile
             * @param {Object} data - Profile data
             * @returns {Promise<Object>} Updated profile
             */
            updateProfile: async (data) => {
                const user = auth.currentUser;
                if (!user) throw new Error('Not authenticated');
                return await collections.users.update(user.uid, data);
            },

            /**
             * Get user profile
             * @param {string} userId - User ID
             * @returns {Promise<Object|null>} User profile
             */
            getProfile: async (userId = null) => {
                const uid = userId || auth.currentUser?.uid;
                if (!uid) return null;
                return await collections.users.get(uid);
            },

            /**
             * Logout user
             * @returns {Promise<void>}
             */
            logout: async () => {
                try {
                    await auth.signOut();
                } catch (error) {
                    console.error('Logout error:', error);
                    throw { code: 'AUTH_LOGOUT_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  CART MODULE
        // ============================================================
        const cart = {
            add: (data) => collections.cart.add(data),
            update: (id, data) => collections.cart.update(id, data),
            delete: (id) => collections.cart.delete(id),
            get: (id) => collections.cart.get(id),
            getAll: (options) => collections.cart.getAll(options),
            count: () => collections.cart.count(),
            listen: (callback, conditions) => collections.cart.listen(callback, conditions),
            batch: (operations) => collections.cart.batch(operations),
            transaction: (callback) => collections.cart.transaction(callback),

            /**
             * Add item to cart
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @param {number} quantity - Quantity
             * @param {Object} variant - Product variant
             * @returns {Promise<Object>} Cart item
             */
            addItem: async (userId, productId, quantity = 1, variant = null) => {
                const existing = await collections.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();

                if (existing.length > 0) {
                    const item = existing[0];
                    return await collections.cart.update(item.id, {
                        quantity: (item.quantity || 0) + quantity
                    });
                }

                const product = await collections.products.get(productId);
                return await collections.cart.add({
                    userId,
                    productId,
                    productName: product?.name || 'Unknown',
                    productPrice: product?.offerPrice || product?.price || 0,
                    productImage: product?.images?.[0] || '',
                    quantity,
                    variant
                });
            },

            /**
             * Remove item from cart
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Result
             */
            removeItem: async (userId, productId) => {
                const items = await collections.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0) {
                    return await collections.cart.delete(items[0].id);
                }
                return null;
            },

            /**
             * Update item quantity
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @param {number} quantity - New quantity
             * @returns {Promise<Object>} Updated item
             */
            updateQuantity: async (userId, productId, quantity) => {
                const items = await collections.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0 && quantity > 0) {
                    return await collections.cart.update(items[0].id, { quantity });
                } else if (items.length > 0 && quantity <= 0) {
                    return await collections.cart.delete(items[0].id);
                }
                return null;
            },

            /**
             * Get user cart
             * @param {string} userId - User ID
             * @returns {Promise<Array>} Cart items
             */
            getCart: async (userId) => {
                return await collections.cart.where('userId', '==', userId).exec();
            },

            /**
             * Get cart total
             * @param {string} userId - User ID
             * @returns {Promise<number>} Cart total
             */
            getTotal: async (userId) => {
                const items = await collections.cart.where('userId', '==', userId).exec();
                return items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
            },

            /**
             * Clear cart
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Result
             */
            clear: async (userId) => {
                const items = await collections.cart.where('userId', '==', userId).exec();
                const ids = items.map(i => i.id);
                if (ids.length > 0) {
                    return await collections.cart.batch(
                        ids.map(id => ({ id, type: 'delete' }))
                    );
                }
                return { deleted: 0 };
            }
        };

        // ============================================================
        //  WISHLIST MODULE
        // ============================================================
        const wishlist = {
            add: (data) => collections.wishlist.add(data),
            update: (id, data) => collections.wishlist.update(id, data),
            delete: (id) => collections.wishlist.delete(id),
            get: (id) => collections.wishlist.get(id),
            getAll: (options) => collections.wishlist.getAll(options),
            count: () => collections.wishlist.count(),
            listen: (callback, conditions) => collections.wishlist.listen(callback, conditions),
            batch: (operations) => collections.wishlist.batch(operations),
            transaction: (callback) => collections.wishlist.transaction(callback),

            /**
             * Add item to wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Wishlist item
             */
            addItem: async (userId, productId) => {
                const existing = await collections.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();

                if (existing.length > 0) {
                    return existing[0];
                }

                const product = await collections.products.get(productId);
                return await collections.wishlist.add({
                    userId,
                    productId,
                    productName: product?.name || 'Unknown',
                    productPrice: product?.offerPrice || product?.price || 0,
                    productImage: product?.images?.[0] || ''
                });
            },

            /**
             * Remove item from wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Result
             */
            removeItem: async (userId, productId) => {
                const items = await collections.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                if (items.length > 0) {
                    return await collections.wishlist.delete(items[0].id);
                }
                return null;
            },

            /**
             * Get user wishlist
             * @param {string} userId - User ID
             * @returns {Promise<Array>} Wishlist items
             */
            getWishlist: async (userId) => {
                return await collections.wishlist.where('userId', '==', userId).exec();
            },

            /**
             * Check if item is in wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<boolean>} True if in wishlist
             */
            isInWishlist: async (userId, productId) => {
                const items = await collections.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                return items.length > 0;
            }
        };

        // ============================================================
        //  SETTINGS MODULE
        // ============================================================
        const settings = {
            add: (data) => collections.settings.add(data),
            update: (id, data) => collections.settings.update(id, data),
            delete: (id) => collections.settings.delete(id),
            get: (id) => collections.settings.get(id),
            getAll: (options) => collections.settings.getAll(options),
            count: () => collections.settings.count(),
            listen: (callback, conditions) => collections.settings.listen(callback, conditions),
            batch: (operations) => collections.settings.batch(operations),
            transaction: (callback) => collections.settings.transaction(callback),

            /**
             * Get setting by key
             * @param {string} key - Setting key
             * @returns {Promise<Object|null>} Setting or null
             */
            getByKey: async (key) => {
                const settings = await collections.settings.where('key', '==', key).exec();
                return settings.length > 0 ? settings[0] : null;
            },

            /**
             * Set setting value
             * @param {string} key - Setting key
             * @param {*} value - Setting value
             * @returns {Promise<Object>} Setting
             */
            set: async (key, value) => {
                const existing = await collections.settings.where('key', '==', key).exec();
                if (existing.length > 0) {
                    return await collections.settings.update(existing[0].id, { value });
                }
                return await collections.settings.add({ key, value });
            },

            /**
             * Get multiple settings
             * @param {Array} keys - Setting keys
             * @returns {Promise<Object>} Settings object
             */
            getMultiple: async (keys) => {
                const result = {};
                for (const key of keys) {
                    const setting = await settings.getByKey(key);
                    if (setting) result[key] = setting.value;
                }
                return result;
            }
        };

        // ============================================================
        //  HOMEPAGE MODULE
        // ============================================================
        const homepage = {
            /**
             * Get all homepage data
             * @returns {Promise<Object>} Homepage data
             */
            getAll: async () => {
                const [featured, trending, latest, offers, banners, categories, testimonials, partners] = await Promise.all([
                    products.getFeatured(8),
                    products.getTrending(8),
                    products.latest(8),
                    offers.getActive(6),
                    collections.banners.where('active', '==', true).exec(),
                    collections.categories.latest(12),
                    collections.testimonials.latest(6),
                    collections.partners.latest(8)
                ]);

                return {
                    featured,
                    trending,
                    latest,
                    offers,
                    banners,
                    categories,
                    testimonials,
                    partners,
                    timestamp: Utils.now()
                };
            },

            /**
             * Get featured products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Featured products
             */
            getFeatured: (limit = 8) => products.getFeatured(limit),

            /**
             * Get trending products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Trending products
             */
            getTrending: (limit = 8) => products.getTrending(limit),

            /**
             * Get latest products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Latest products
             */
            getLatest: (limit = 8) => products.latest(limit),

            /**
             * Get active offers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Active offers
             */
            getOffers: (limit = 6) => offers.getActive(limit),

            /**
             * Get active banners
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Active banners
             */
            getBanners: async (limit = 5) => {
                return await collections.banners.where('active', '==', true).exec();
            },

            /**
             * Get categories
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Categories
             */
            getCategories: (limit = 12) => collections.categories.latest(limit),

            /**
             * Get testimonials
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Testimonials
             */
            getTestimonials: (limit = 6) => collections.testimonials.latest(limit),

            /**
             * Get partners
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Partners
             */
            getPartners: (limit = 8) => collections.partners.latest(limit),

            /**
             * Listen to homepage updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen: (callback) => {
                const unsubscribes = [];
                const collectionsToWatch = ['products', 'offers', 'categories', 'banners', 'testimonials', 'partners'];

                collectionsToWatch.forEach(name => {
                    const unsub = collections[name].listen(() => {
                        homepage.getAll().then(callback).catch(err => {
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
        //  CRM MODULE (Customer Relationship Management)
        // ============================================================
        const crm = {
            add: (data) => collections.crm.add(data),
            update: (id, data) => collections.crm.update(id, data),
            delete: (id) => collections.crm.delete(id),
            get: (id) => collections.crm.get(id),
            getAll: (options) => collections.crm.getAll(options),
            count: () => collections.crm.count(),
            latest: (count) => collections.crm.latest(count),
            search: (term, options) => collections.crm.search('name', term, options),
            listen: (callback, conditions) => collections.crm.listen(callback, conditions),
            batch: (operations) => collections.crm.batch(operations),
            transaction: (callback) => collections.crm.transaction(callback),

            /**
             * Get leads by status
             * @param {string} status - Lead status
             * @returns {Promise<Array>} Leads
             */
            getByStatus: async (status) => {
                return await collections.crm.where('status', '==', status).exec();
            },

            /**
             * Get leads by assigned user
             * @param {string} userId - User ID
             * @returns {Promise<Array>} Leads
             */
            getByAssigned: async (userId) => {
                return await collections.crm.where('assignedTo', '==', userId).exec();
            },

            /**
             * Update lead status
             * @param {string} id - Lead ID
             * @param {string} status - New status
             * @returns {Promise<Object>} Updated lead
             */
            updateStatus: async (id, status) => {
                return await collections.crm.update(id, {
                    status,
                    statusUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Assign lead to user
             * @param {string} id - Lead ID
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Updated lead
             */
            assign: async (id, userId) => {
                return await collections.crm.update(id, {
                    assignedTo: userId,
                    assignedAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  FRANCHISE MODULE
        // ============================================================
        const franchise = {
            add: (data) => collections.franchise.add(data),
            update: (id, data) => collections.franchise.update(id, data),
            delete: (id) => collections.franchise.delete(id),
            get: (id) => collections.franchise.get(id),
            getAll: (options) => collections.franchise.getAll(options),
            count: () => collections.franchise.count(),
            latest: (count) => collections.franchise.latest(count),
            search: (term, options) => collections.franchise.search('name', term, options),
            listen: (callback, conditions) => collections.franchise.listen(callback, conditions),
            batch: (operations) => collections.franchise.batch(operations),
            transaction: (callback) => collections.franchise.transaction(callback),

            /**
             * Get applications by status
             * @param {string} status - Application status
             * @returns {Promise<Array>} Applications
             */
            getByStatus: async (status) => {
                return await collections.franchise.where('status', '==', status).exec();
            },

            /**
             * Approve franchise application
             * @param {string} id - Application ID
             * @returns {Promise<Object>} Updated application
             */
            approve: async (id) => {
                return await collections.franchise.update(id, {
                    status: 'approved',
                    approvedAt: serverTimestamp()
                });
            },

            /**
             * Reject franchise application
             * @param {string} id - Application ID
             * @param {string} reason - Rejection reason
             * @returns {Promise<Object>} Updated application
             */
            reject: async (id, reason) => {
                return await collections.franchise.update(id, {
                    status: 'rejected',
                    rejectionReason: reason,
                    rejectedAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  CLOUD KITCHEN MODULE
        // ============================================================
        const cloudKitchen = {
            add: (data) => collections.cloudKitchen.add(data),
            update: (id, data) => collections.cloudKitchen.update(id, data),
            delete: (id) => collections.cloudKitchen.delete(id),
            get: (id) => collections.cloudKitchen.get(id),
            getAll: (options) => collections.cloudKitchen.getAll(options),
            count: () => collections.cloudKitchen.count(),
            latest: (count) => collections.cloudKitchen.latest(count),
            search: (term, options) => collections.cloudKitchen.search('name', term, options),
            listen: (callback, conditions) => collections.cloudKitchen.listen(callback, conditions),
            batch: (operations) => collections.cloudKitchen.batch(operations),
            transaction: (callback) => collections.cloudKitchen.transaction(callback),

            /**
             * Get kitchens by status
             * @param {string} status - Kitchen status
             * @returns {Promise<Array>} Kitchens
             */
            getByStatus: async (status) => {
                return await collections.cloudKitchen.where('status', '==', status).exec();
            },

            /**
             * Update kitchen status
             * @param {string} id - Kitchen ID
             * @param {string} status - New status
             * @returns {Promise<Object>} Updated kitchen
             */
            updateStatus: async (id, status) => {
                return await collections.cloudKitchen.update(id, {
                    status,
                    statusUpdatedAt: serverTimestamp()
                });
            }
        };

        // ============================================================
        //  BUILD MAIN OBJECT
        // ============================================================
        const KFK = {
            // Core utilities
            utils: Utils,

            // Collection managers (for advanced use)
            collections,

            // Business modules
            products,
            categories,
            orders,
            customers,
            inventory,
            users,
            offers,
            blogs,
            notifications,
            activityLogs,
            analytics,
            dashboard,
            storage,
            auth,
            settings,
            homepage,
            cart,
            wishlist,
            crm,
            franchise,
            cloudKitchen
        };

        // ============================================================
        //  EXPOSE GLOBALLY
        // ============================================================
        window.KFK = KFK;

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('KFKReady', { detail: { KFK } }));

        console.log('✅ KFK Core Engine Ready');
        console.log(`📦 ${COLLECTION_NAMES.length} collections initialized`);
        console.log('🔗 18+ business modules loaded');

        return KFK;
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
