/**
 * KFK Marketplace - Core Engine
 * Production Ready - Enterprise Grade
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete core engine for KFK Marketplace.
 * Built on Firebase v12 Modular SDK.
 * No dependencies except firebase-init.js.
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
            console.error('[KFK Core] Firebase initialization timeout');
            return;
        }
        setTimeout(() => waitForFirebase(retries + 1), 200);
    }

    // ============================================================
    //  INITIALIZE CORE
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
        //  UTILITY HELPER
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
             * Get current timestamp as ISO string
             * @returns {string} ISO timestamp
             */
            now() {
                return new Date().toISOString();
            },

            /**
             * Get server timestamp (Firestore)
             * @returns {Object} Server timestamp
             */
            serverTime() {
                return serverTimestamp();
            },

            /**
             * Generate a slug from text
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
             * Format price in INR
             * @param {number} amount - Amount to format
             * @returns {string} Formatted price
             */
            formatPrice(amount) {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(amount);
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
             * Deep clone an object
             * @param {Object} obj - Object to clone
             * @returns {Object} Cloned object
             */
            clone(obj) {
                return JSON.parse(JSON.stringify(obj));
            },

            /**
             * Deep merge objects
             * @param {Object} target - Target object
             * @param {Object} source - Source object
             * @returns {Object} Merged object
             */
            merge(target, source) {
                const result = { ...target };
                for (const key in source) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        result[key] = this.merge(result[key] || {}, source[key]);
                    } else {
                        result[key] = source[key];
                    }
                }
                return result;
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
             * Get random number between min and max
             * @param {number} min - Minimum value
             * @param {number} max - Maximum value
             * @returns {number} Random number
             */
            random(min = 0, max = 100) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },

            /**
             * Log with timestamp
             * @param {string} level - Log level (info, warn, error)
             * @param {string} message - Log message
             * @param {*} data - Additional data
             */
            log(level, message, data = null) {
                const timestamp = this.now();
                const logEntry = { timestamp, level, message, data };
                console.log(`[KFK] ${timestamp} [${level.toUpperCase()}] ${message}`, data || '');
                return logEntry;
            }
        };

        // ============================================================
        //  COLLECTION MANAGER
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
                    const result = { id: docRef.id, ...data };
                    this._invalidateCache();
                    return result;
                } catch (error) {
                    Utils.log('error', `[${this.name}] Add failed`, error);
                    throw { code: 'DB_ADD_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Set a document with specific ID
             * @param {string} id - Document ID
             * @param {Object} data - Document data
             * @param {boolean} merge - Whether to merge with existing
             * @returns {Promise<Object>} Set document
             */
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
                    Utils.log('error', `[${this.name}] Set failed`, error);
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
                    Utils.log('error', `[${this.name}] Get failed`, error);
                    throw { code: 'DB_GET_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Get all documents
             * @param {Object} options - Query options
             * @returns {Promise<Array>} Array of documents
             */
            async all(options = {}) {
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
                    Utils.log('error', `[${this.name}] All failed`, error);
                    throw { code: 'DB_ALL_ERROR', message: error.message, collection: this.name };
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
                    Utils.log('error', `[${this.name}] Count failed`, error);
                    throw { code: 'DB_COUNT_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Check if document exists
             * @param {string} id - Document ID
             * @returns {Promise<boolean>} True if exists
             */
            async exists(id) {
                try {
                    const docRef = doc(this.collectionRef, id);
                    const snapshot = await getDoc(docRef);
                    return snapshot.exists();
                } catch (error) {
                    Utils.log('error', `[${this.name}] Exists failed`, error);
                    throw { code: 'DB_EXISTS_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Get first document
             * @returns {Promise<Object|null>} First document or null
             */
            async first() {
                try {
                    const q = query(this.collectionRef, orderBy('_createdAt', 'asc'), limit(1));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) return null;
                    const doc = snapshot.docs[0];
                    return { id: doc.id, ...doc.data() };
                } catch (error) {
                    Utils.log('error', `[${this.name}] First failed`, error);
                    throw { code: 'DB_FIRST_ERROR', message: error.message, collection: this.name };
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
                    Utils.log('error', `[${this.name}] Latest failed`, error);
                    throw { code: 'DB_LATEST_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Paginate documents
             * @param {number} page - Page number (1-based)
             * @param {number} size - Page size
             * @returns {Promise<Object>} Paginated results
             */
            async page(page = 1, size = 20) {
                try {
                    const startIndex = (page - 1) * size;
                    let q = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(size));
                    
                    if (page > 1) {
                        const prevQuery = query(this.collectionRef, orderBy('_createdAt', 'desc'), limit(startIndex));
                        const prevSnapshot = await getDocs(prevQuery);
                        const lastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
                        if (lastDoc) {
                            q = query(this.collectionRef, orderBy('_createdAt', 'desc'), startAfter(lastDoc), limit(size));
                        }
                    }
                    
                    const snapshot = await getDocs(q);
                    const results = [];
                    snapshot.forEach(doc => {
                        results.push({ id: doc.id, ...doc.data() });
                    });
                    
                    return {
                        items: results,
                        page: page,
                        size: size,
                        total: await this.count(),
                        totalPages: Math.ceil(await this.count() / size)
                    };
                } catch (error) {
                    Utils.log('error', `[${this.name}] Page failed`, error);
                    throw { code: 'DB_PAGE_ERROR', message: error.message, collection: this.name };
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
                    this._invalidateCache();
                    const snapshot = await getDoc(docRef);
                    return { id: snapshot.id, ...snapshot.data() };
                } catch (error) {
                    Utils.log('error', `[${this.name}] Update failed`, error);
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
                    this._invalidateCache();
                    return { id, deleted: true };
                } catch (error) {
                    Utils.log('error', `[${this.name}] Delete failed`, error);
                    throw { code: 'DB_DELETE_ERROR', message: error.message, collection: this.name };
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
                            Utils.log('error', `[${this._collection.name}] Where exec failed`, error);
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
                            Utils.log('error', `[${this._collection.name}] Where listen failed`, error);
                            callback(null, error);
                        });
                    }
                };
            }

            /**
             * Search documents by field
             * @param {string} field - Field to search
             * @param {string} term - Search term
             * @param {Object} options - Additional options
             * @returns {Object} Search builder
             */
            search(field, term, options = {}) {
                const searchLower = term.toLowerCase();
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
                            Utils.log('error', `[${this._collection.name}] Search failed`, error);
                            throw { code: 'DB_SEARCH_ERROR', message: error.message };
                        }
                    }
                };
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
                        Utils.log('error', `[${this.name}] Listen failed`, error);
                        callback(null, error);
                    });
                    
                    this._listeners.push(unsubscribe);
                    return unsubscribe;
                } catch (error) {
                    Utils.log('error', `[${this.name}] Listen setup failed`, error);
                    throw { code: 'DB_LISTEN_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Export collection to JSON
             * @returns {Promise<Array>} Exported data
             */
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
                    Utils.log('error', `[${this.name}] Export failed`, error);
                    throw { code: 'DB_EXPORT_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Import data to collection
             * @param {Array|string} data - Data to import
             * @returns {Promise<Array>} Imported documents
             */
            async import(data) {
                try {
                    const items = typeof data === 'string' ? JSON.parse(data) : data;
                    if (!Array.isArray(items)) {
                        throw new Error('Import data must be an array');
                    }
                    return await this.addMany(items);
                } catch (error) {
                    Utils.log('error', `[${this.name}] Import failed`, error);
                    throw { code: 'DB_IMPORT_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Add multiple documents
             * @param {Array} dataArray - Array of documents
             * @returns {Promise<Array>} Created documents
             */
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
                    Utils.log('error', `[${this.name}] AddMany failed`, error);
                    throw { code: 'DB_BULK_ADD_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Update multiple documents
             * @param {Array} ids - Document IDs
             * @param {Object} data - Update data
             * @returns {Promise<Array>} Updated IDs
             */
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
                    Utils.log('error', `[${this.name}] UpdateMany failed`, error);
                    throw { code: 'DB_BULK_UPDATE_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Delete multiple documents
             * @param {Array} ids - Document IDs
             * @returns {Promise<Object>} Deleted count
             */
            async deleteMany(ids) {
                try {
                    const batch = writeBatch(db);
                    for (const id of ids) {
                        const docRef = doc(this.collectionRef, id);
                        batch.delete(docRef);
                    }
                    await batch.commit();
                    this._invalidateCache();
                    return { deleted: ids.length };
                } catch (error) {
                    Utils.log('error', `[${this.name}] DeleteMany failed`, error);
                    throw { code: 'DB_BULK_DELETE_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Clear all documents in collection
             * @returns {Promise<Object>} Deleted count
             */
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
                    Utils.log('error', `[${this.name}] Clear failed`, error);
                    throw { code: 'DB_CLEAR_ERROR', message: error.message, collection: this.name };
                }
            }

            /**
             * Invalidate cache
             * @private
             */
            _invalidateCache() {
                this._cache.clear();
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
        //  COLLECTION INSTANCES
        // ============================================================
        const collections = {};
        const COLLECTION_NAMES = [
            'products', 'categories', 'customers', 'orders', 'inventory',
            'homepage', 'settings', 'crm', 'franchise', 'cloudKitchen',
            'offers', 'blogs', 'testimonials', 'partners', 'analytics',
            'reports', 'notifications', 'activityLogs', 'users',
            'wishlist', 'cart', 'payments', 'invoices', 'vendors',
            'supportTickets', 'coupons'
        ];

        COLLECTION_NAMES.forEach(name => {
            collections[name] = new CollectionManager(name);
        });

        // ============================================================
        //  BATCH OPERATIONS
        // ============================================================
        const batch = {
            /**
             * Execute batch operations
             * @param {Array} operations - Array of operations
             * @returns {Promise<Object>} Batch result
             */
            async execute(operations) {
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
                    Utils.log('error', 'Batch execute failed', error);
                    throw { code: 'DB_BATCH_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  TRANSACTION HELPER
        // ============================================================
        const transaction = {
            /**
             * Execute a transaction
             * @param {Function} callback - Transaction callback
             * @returns {Promise<*>} Transaction result
             */
            async run(callback) {
                try {
                    return await runTransaction(db, async (txn) => {
                        return await callback(txn);
                    });
                } catch (error) {
                    Utils.log('error', 'Transaction failed', error);
                    throw { code: 'DB_TRANSACTION_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  PRODUCT ENGINE
        // ============================================================
        const product = {
            /**
             * Search products with filters
             * @param {Object} options - Search options
             * @returns {Promise<Object>} Search results
             */
            async search(options = {}) {
                try {
                    let results = await collections.products.all();

                    // Category filter
                    if (options.category) {
                        results = results.filter(p => p.category === options.category);
                    }

                    // Price filter
                    if (options.minPrice !== undefined) {
                        results = results.filter(p => (p.offerPrice || p.price) >= options.minPrice);
                    }
                    if (options.maxPrice !== undefined) {
                        results = results.filter(p => (p.offerPrice || p.price) <= options.maxPrice);
                    }

                    // Stock filter
                    if (options.inStock) {
                        results = results.filter(p => (p.stock || 0) > 0);
                    }

                    // Offer filter
                    if (options.onOffer) {
                        results = results.filter(p => p.offerPrice && p.offerPrice < p.price);
                    }

                    // Rating filter
                    if (options.minRating) {
                        results = results.filter(p => (p.rating || 0) >= options.minRating);
                    }

                    // Search term
                    if (options.term) {
                        const term = options.term.toLowerCase();
                        results = results.filter(p => 
                            p.name?.toLowerCase().includes(term) ||
                            p.description?.toLowerCase().includes(term) ||
                            p.category?.toLowerCase().includes(term)
                        );
                    }

                    // Sort
                    switch (options.sort) {
                        case 'price_asc':
                            results.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
                            break;
                        case 'price_desc':
                            results.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
                            break;
                        case 'rating':
                            results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                            break;
                        case 'popular':
                            results.sort((a, b) => (b.sales || 0) - (a.sales || 0));
                            break;
                        default:
                            results.sort((a, b) => (a._createdAt || '') < (b._createdAt || '') ? 1 : -1);
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
                        total: total,
                        page: page,
                        perPage: perPage,
                        totalPages: Math.ceil(total / perPage)
                    };
                } catch (error) {
                    Utils.log('error', 'Product search failed', error);
                    throw { code: 'PRODUCT_SEARCH_ERROR', message: error.message };
                }
            },

            /**
             * Get featured products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Featured products
             */
            async getFeatured(limit = 8) {
                const products = await collections.products.where('featured', '==', true).exec();
                return products.slice(0, limit);
            },

            /**
             * Get trending products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Trending products
             */
            async getTrending(limit = 8) {
                const products = await collections.products.where('trending', '==', true).exec();
                return products.slice(0, limit);
            },

            /**
             * Get new arrivals
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} New arrivals
             */
            async getNewArrivals(limit = 8) {
                return await collections.products.latest(limit);
            },

            /**
             * Update product stock
             * @param {string} productId - Product ID
             * @param {number} stock - New stock count
             * @returns {Promise<Object>} Updated product
             */
            async updateStock(productId, stock) {
                return await collections.products.update(productId, {
                    stock: stock,
                    stockUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Update product price
             * @param {string} productId - Product ID
             * @param {number} price - New price
             * @param {number|null} offerPrice - New offer price
             * @returns {Promise<Object>} Updated product
             */
            async updatePrice(productId, price, offerPrice = null) {
                const data = { price };
                if (offerPrice !== null) data.offerPrice = offerPrice;
                return await collections.products.update(productId, data);
            },

            /**
             * Listen to product updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                return collections.products.listen(callback);
            }
        };

        // ============================================================
        //  ORDER ENGINE
        // ============================================================
        const order = {
            /**
             * Create a new order
             * @param {Object} data - Order data
             * @returns {Promise<Object>} Created order
             */
            async create(data) {
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

                const orderData = {
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
                };

                const result = await collections.orders.add(orderData);

                // Update inventory
                for (const item of items) {
                    const inventory = await collections.inventory.get(item.productId);
                    if (inventory) {
                        await collections.inventory.update(item.productId, {
                            stock: (inventory.stock || 0) - item.quantity
                        });
                    }
                }

                return result;
            },

            /**
             * Get customer orders
             * @param {string} customerId - Customer ID
             * @returns {Promise<Array>} Customer orders
             */
            async getByCustomer(customerId) {
                return await collections.orders.where('customerId', '==', customerId).exec();
            },

            /**
             * Get orders by status
             * @param {string} status - Order status
             * @returns {Promise<Array>} Orders
             */
            async getByStatus(status) {
                return await collections.orders.where('status', '==', status).exec();
            },

            /**
             * Update order status
             * @param {string} orderId - Order ID
             * @param {string} status - New status
             * @returns {Promise<Object>} Updated order
             */
            async updateStatus(orderId, status) {
                return await collections.orders.update(orderId, {
                    status: status,
                    statusUpdatedAt: serverTimestamp()
                });
            },

            /**
             * Get order revenue
             * @param {string} period - Period filter
             * @returns {Promise<number>} Revenue
             */
            async getRevenue(period = 'all') {
                const orders = await collections.orders.where('status', 'in', ['delivered', 'completed']).exec();
                return orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
            },

            /**
             * Listen to order updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                return collections.orders.listen(callback);
            }
        };

        // ============================================================
        //  CUSTOMER ENGINE
        // ============================================================
        const customer = {
            /**
             * Get customer by ID
             * @param {string} customerId - Customer ID
             * @returns {Promise<Object>} Customer
             */
            async get(customerId) {
                return await collections.customers.get(customerId);
            },

            /**
             * Create a new customer
             * @param {Object} data - Customer data
             * @returns {Promise<Object>} Created customer
             */
            async create(data) {
                return await collections.customers.add({
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            },

            /**
             * Update customer
             * @param {string} customerId - Customer ID
             * @param {Object} data - Update data
             * @returns {Promise<Object>} Updated customer
             */
            async update(customerId, data) {
                return await collections.customers.update(customerId, {
                    ...data,
                    updatedAt: serverTimestamp()
                });
            },

            /**
             * Get customer orders
             * @param {string} customerId - Customer ID
             * @returns {Promise<Array>} Customer orders
             */
            async getOrders(customerId) {
                return await collections.orders.where('customerId', '==', customerId).exec();
            },

            /**
             * Get customer statistics
             * @param {string} customerId - Customer ID
             * @returns {Promise<Object>} Customer statistics
             */
            async getStats(customerId) {
                const orders = await collections.orders.where('customerId', '==', customerId).exec();
                const totalOrders = orders.length;
                const totalSpent = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
                const averageOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
                const lastOrder = orders.length > 0 ? orders[0] : null;

                return {
                    totalOrders,
                    totalSpent,
                    averageOrder,
                    lastOrder,
                    orderHistory: orders
                };
            },

            /**
             * Get all customers
             * @param {Object} options - Query options
             * @returns {Promise<Array>} Customers
             */
            async all(options = {}) {
                return await collections.customers.all(options);
            },

            /**
             * Listen to customer updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                return collections.customers.listen(callback);
            }
        };

        // ============================================================
        //  HOMEPAGE ENGINE
        // ============================================================
        const homepage = {
            /**
             * Get all homepage data
             * @returns {Promise<Object>} Homepage data
             */
            async getAll() {
                try {
                    const [featured, trending, latest, offers, banners, categories, testimonials, partners] = await Promise.all([
                        product.getFeatured(8),
                        product.getTrending(8),
                        product.getNewArrivals(8),
                        collections.offers.where('active', '==', true).exec(),
                        collections.banners.where('active', '==', true).exec(),
                        collections.categories.latest(12),
                        collections.testimonials.latest(6),
                        collections.partners.latest(8)
                    ]);

                    return {
                        featured,
                        trending,
                        latest,
                        offers: offers.filter(o => !o.expiresAt || o.expiresAt > Utils.now()),
                        banners,
                        categories,
                        testimonials,
                        partners
                    };
                } catch (error) {
                    Utils.log('error', 'Homepage data fetch failed', error);
                    throw { code: 'HOMEPAGE_ERROR', message: error.message };
                }
            },

            /**
             * Get featured products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Featured products
             */
            getFeatured(limit = 8) {
                return product.getFeatured(limit);
            },

            /**
             * Get trending products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Trending products
             */
            getTrending(limit = 8) {
                return product.getTrending(limit);
            },

            /**
             * Get latest products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Latest products
             */
            getLatest(limit = 8) {
                return product.getNewArrivals(limit);
            },

            /**
             * Get active offers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Active offers
             */
            async getOffers(limit = 6) {
                const offers = await collections.offers.where('active', '==', true).exec();
                return offers.filter(o => !o.expiresAt || o.expiresAt > Utils.now()).slice(0, limit);
            },

            /**
             * Get active banners
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Active banners
             */
            async getBanners(limit = 5) {
                return await collections.banners.where('active', '==', true).exec();
            },

            /**
             * Listen to homepage updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                const unsubscribes = [];
                const collectionsToWatch = ['products', 'offers', 'categories', 'banners', 'testimonials', 'partners'];
                
                collectionsToWatch.forEach(name => {
                    const unsub = collections[name].listen(() => {
                        this.getAll().then(callback).catch(err => {
                            Utils.log('error', 'Homepage listen update failed', err);
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
        //  DASHBOARD ENGINE
        // ============================================================
        const dashboard = {
            /**
             * Get dashboard summary
             * @returns {Promise<Object>} Dashboard summary
             */
            async getSummary() {
                try {
                    const [products, customers, orders, categories, inventory] = await Promise.all([
                        collections.products.count(),
                        collections.customers.count(),
                        collections.orders.count(),
                        collections.categories.count(),
                        collections.inventory.all()
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
                        lowStockItems: lowStock.slice(0, 10),
                        timestamp: Utils.now()
                    };
                } catch (error) {
                    Utils.log('error', 'Dashboard summary failed', error);
                    throw { code: 'DASHBOARD_ERROR', message: error.message };
                }
            },

            /**
             * Get top customers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Top customers
             */
            async getTopCustomers(limit = 5) {
                try {
                    const orders = await collections.orders.all();
                    const customerMap = {};
                    
                    orders.forEach(order => {
                        const id = order.customerId;
                        if (!id) return;
                        if (!customerMap[id]) {
                            customerMap[id] = { customerId: id, total: 0, orders: 0 };
                        }
                        customerMap[id].total += order.grandTotal || 0;
                        customerMap[id].orders += 1;
                    });

                    const customers = await Promise.all(
                        Object.keys(customerMap).map(async (id) => {
                            const customer = await collections.customers.get(id);
                            return {
                                ...customer,
                                totalSpent: customerMap[id].total,
                                orderCount: customerMap[id].orders
                            };
                        })
                    );

                    return customers
                        .filter(c => c && c.totalSpent)
                        .sort((a, b) => b.totalSpent - a.totalSpent)
                        .slice(0, limit);
                } catch (error) {
                    Utils.log('error', 'Top customers failed', error);
                    throw { code: 'DASHBOARD_TOP_CUSTOMERS_ERROR', message: error.message };
                }
            },

            /**
             * Get top products
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Top products
             */
            async getTopProducts(limit = 5) {
                try {
                    const orders = await collections.orders.all();
                    const productMap = {};
                    
                    orders.forEach(order => {
                        (order.items || []).forEach(item => {
                            const id = item.productId || item.id;
                            if (!id) return;
                            if (!productMap[id]) {
                                productMap[id] = { productId: id, total: 0, quantity: 0 };
                            }
                            productMap[id].total += (item.price || 0) * (item.quantity || 1);
                            productMap[id].quantity += item.quantity || 1;
                        });
                    });

                    const products = await Promise.all(
                        Object.keys(productMap).map(async (id) => {
                            const product = await collections.products.get(id);
                            return {
                                ...product,
                                totalSales: productMap[id].total,
                                quantitySold: productMap[id].quantity
                            };
                        })
                    );

                    return products
                        .filter(p => p && p.totalSales)
                        .sort((a, b) => b.totalSales - a.totalSales)
                        .slice(0, limit);
                } catch (error) {
                    Utils.log('error', 'Top products failed', error);
                    throw { code: 'DASHBOARD_TOP_PRODUCTS_ERROR', message: error.message };
                }
            },

            /**
             * Get recent orders
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Recent orders
             */
            async getRecentOrders(limit = 5) {
                return await collections.orders.latest(limit);
            },

            /**
             * Get recent customers
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Recent customers
             */
            async getRecentCustomers(limit = 5) {
                return await collections.customers.latest(limit);
            },

            /**
             * Listen to dashboard updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                const unsubscribes = [];
                const collectionsToWatch = ['products', 'customers', 'orders', 'categories', 'inventory'];
                
                collectionsToWatch.forEach(name => {
                    const unsub = collections[name].listen(() => {
                        this.getSummary().then(callback).catch(err => {
                            Utils.log('error', 'Dashboard listen update failed', err);
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
        //  ANALYTICS ENGINE
        // ============================================================
        const analytics = {
            /**
             * Get revenue analytics
             * @returns {Promise<Object>} Revenue analytics
             */
            async getRevenue() {
                try {
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
                    const totalOrders = orders.length;

                    return {
                        todayRevenue,
                        monthlyRevenue,
                        yearlyRevenue,
                        totalRevenue,
                        averageOrder,
                        totalOrders
                    };
                } catch (error) {
                    Utils.log('error', 'Analytics revenue failed', error);
                    throw { code: 'ANALYTICS_REVENUE_ERROR', message: error.message };
                }
            },

            /**
             * Get sales chart data
             * @param {number} days - Number of days
             * @returns {Promise<Array>} Sales chart data
             */
            async getSalesChart(days = 30) {
                try {
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
                } catch (error) {
                    Utils.log('error', 'Analytics sales chart failed', error);
                    throw { code: 'ANALYTICS_SALES_CHART_ERROR', message: error.message };
                }
            },

            /**
             * Get order status distribution
             * @returns {Promise<Object>} Order status distribution
             */
            async getOrderStatusChart() {
                try {
                    const orders = await collections.orders.all();
                    const statuses = {};
                    orders.forEach(order => {
                        const status = order.status || 'pending';
                        statuses[status] = (statuses[status] || 0) + 1;
                    });
                    return statuses;
                } catch (error) {
                    Utils.log('error', 'Analytics order status failed', error);
                    throw { code: 'ANALYTICS_ORDER_STATUS_ERROR', message: error.message };
                }
            },

            /**
             * Get customer growth data
             * @param {number} days - Number of days
             * @returns {Promise<Array>} Customer growth data
             */
            async getCustomerGrowth(days = 30) {
                try {
                    const customers = await collections.customers.all();
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
                } catch (error) {
                    Utils.log('error', 'Analytics customer growth failed', error);
                    throw { code: 'ANALYTICS_CUSTOMER_GROWTH_ERROR', message: error.message };
                }
            },

            /**
             * Get inventory value
             * @returns {Promise<number>} Inventory value
             */
            async getInventoryValue() {
                try {
                    const inventory = await collections.inventory.all();
                    return inventory.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
                } catch (error) {
                    Utils.log('error', 'Analytics inventory value failed', error);
                    throw { code: 'ANALYTICS_INVENTORY_VALUE_ERROR', message: error.message };
                }
            }
        };

        // ============================================================
        //  STORAGE ENGINE
        // ============================================================
        const storage = {
            _onProgress: null,

            /**
             * Upload a file
             * @param {string} path - Storage path
             * @param {File} file - File to upload
             * @param {Object} metadata - File metadata
             * @returns {Promise<Object>} Upload result
             */
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
                                const meta = await getMetadata(uploadTask.snapshot.ref);
                                resolve({
                                    url,
                                    path,
                                    metadata: meta,
                                    ref: uploadTask.snapshot.ref
                                });
                            }
                        );
                    });
                } catch (error) {
                    Utils.log('error', 'Storage upload failed', error);
                    throw { code: 'STORAGE_UPLOAD_ERROR', message: error.message };
                }
            },

            /**
             * Upload product image
             * @param {string} productId - Product ID
             * @param {File} file - Image file
             * @returns {Promise<string>} Image URL
             */
            async uploadProductImage(productId, file) {
                const path = `products/${productId}/image_${Date.now()}.jpg`;
                const result = await this.upload(path, file, { contentType: file.type, productId });
                return result.url;
            },

            /**
             * Upload customer profile image
             * @param {string} customerId - Customer ID
             * @param {File} file - Image file
             * @returns {Promise<string>} Image URL
             */
            async uploadCustomerImage(customerId, file) {
                const path = `customers/${customerId}/profile_${Date.now()}.jpg`;
                const result = await this.upload(path, file, { contentType: file.type, customerId });
                return result.url;
            },

            /**
             * Upload blog image
             * @param {string} blogId - Blog ID
             * @param {File} file - Image file
             * @returns {Promise<string>} Image URL
             */
            async uploadBlogImage(blogId, file) {
                const path = `blogs/${blogId}/image_${Date.now()}.jpg`;
                const result = await this.upload(path, file, { contentType: file.type, blogId });
                return result.url;
            },

            /**
             * Delete a file
             * @param {string} path - File path
             * @returns {Promise<Object>} Delete result
             */
            async delete(path) {
                try {
                    const storageRef = ref(storage, path);
                    await deleteObject(storageRef);
                    return { deleted: true, path };
                } catch (error) {
                    Utils.log('error', 'Storage delete failed', error);
                    throw { code: 'STORAGE_DELETE_ERROR', message: error.message };
                }
            },

            /**
             * Get download URL
             * @param {string} path - File path
             * @returns {Promise<string>} Download URL
             */
            async getURL(path) {
                try {
                    const storageRef = ref(storage, path);
                    return await getDownloadURL(storageRef);
                } catch (error) {
                    Utils.log('error', 'Storage get URL failed', error);
                    throw { code: 'STORAGE_URL_ERROR', message: error.message };
                }
            },

            /**
             * List files in a directory
             * @param {string} prefix - Directory prefix
             * @returns {Promise<Object>} File list
             */
            async list(prefix) {
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
                    Utils.log('error', 'Storage list failed', error);
                    throw { code: 'STORAGE_LIST_ERROR', message: error.message };
                }
            },

            /**
             * Set progress callback
             * @param {Function} callback - Progress callback
             */
            onProgress(callback) {
                this._onProgress = callback;
            }
        };

        // ============================================================
        //  NOTIFICATION ENGINE
        // ============================================================
        const notification = {
            /**
             * Send a notification
             * @param {string} userId - User ID
             * @param {string} title - Notification title
             * @param {string} message - Notification message
             * @param {string} type - Notification type
             * @param {Object} data - Additional data
             * @returns {Promise<Object>} Created notification
             */
            async send(userId, title, message, type = 'info', data = {}) {
                return await collections.notifications.add({
                    userId,
                    title,
                    message,
                    type,
                    data,
                    read: false,
                    createdAt: serverTimestamp()
                });
            },

            /**
             * Mark notification as read
             * @param {string} id - Notification ID
             * @returns {Promise<Object>} Updated notification
             */
            async markRead(id) {
                return await collections.notifications.update(id, { read: true });
            },

            /**
             * Mark all notifications as read
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Result
             */
            async markAllRead(userId) {
                const notifications = await collections.notifications.where('userId', '==', userId).exec();
                const ids = notifications.map(n => n.id);
                if (ids.length === 0) return { count: 0 };
                await collections.notifications.updateMany(ids, { read: true });
                return { count: ids.length };
            },

            /**
             * Get unread count
             * @param {string} userId - User ID
             * @returns {Promise<number>} Unread count
             */
            async getUnreadCount(userId) {
                const notifications = await collections.notifications.where('userId', '==', userId).exec();
                return notifications.filter(n => !n.read).length;
            },

            /**
             * Get user notifications
             * @param {string} userId - User ID
             * @param {Object} options - Query options
             * @returns {Promise<Array>} Notifications
             */
            async getByUser(userId, options = {}) {
                return await collections.notifications.where('userId', '==', userId).exec();
            },

            /**
             * Delete notification
             * @param {string} id - Notification ID
             * @returns {Promise<Object>} Delete result
             */
            async delete(id) {
                return await collections.notifications.delete(id);
            },

            /**
             * Listen to notifications
             * @param {string} userId - User ID
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(userId, callback) {
                return collections.notifications.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }],
                    orderBy: '_createdAt',
                    orderDirection: 'desc'
                });
            }
        };

        // ============================================================
        //  ACTIVITY ENGINE
        // ============================================================
        const activity = {
            /**
             * Log an activity
             * @param {string} action - Action name
             * @param {Object} details - Activity details
             * @returns {Promise<Object>} Created activity
             */
            async log(action, details = {}) {
                const user = auth.currentUser;
                return await collections.activityLogs.add({
                    action,
                    details: Utils.sanitize(details),
                    userId: user?.uid || 'system',
                    userEmail: user?.email || 'system',
                    timestamp: serverTimestamp(),
                    date: Utils.now()
                });
            },

            /**
             * Get recent activities
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} Recent activities
             */
            async getRecent(limit = 50) {
                return await collections.activityLogs.latest(limit);
            },

            /**
             * Get user activities
             * @param {string} userId - User ID
             * @param {number} limit - Maximum number
             * @returns {Promise<Array>} User activities
             */
            async getByUser(userId, limit = 20) {
                const activities = await collections.activityLogs.where('userId', '==', userId).exec();
                return activities.slice(0, limit);
            },

            /**
             * Listen to activities
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                return collections.activityLogs.listen(callback);
            }
        };

        // ============================================================
        //  AUTH HELPER
        // ============================================================
        const auth = {
            /**
             * Get current user
             * @returns {Object|null} Current user
             */
            get currentUser() {
                return window.auth.currentUser;
            },

            /**
             * Check if user is logged in
             * @returns {boolean} Logged in status
             */
            get isLoggedIn() {
                return !!window.auth.currentUser;
            },

            /**
             * Get user role
             * @returns {Promise<string|null>} User role
             */
            async getRole() {
                try {
                    if (!this.currentUser) return null;
                    const userDoc = await collections.users.get(this.currentUser.uid);
                    return userDoc?.role || 'customer';
                } catch (error) {
                    Utils.log('error', 'Get role failed', error);
                    return null;
                }
            },

            /**
             * Check if user is admin
             * @returns {Promise<boolean>} True if admin
             */
            async isAdmin() {
                const role = await this.getRole();
                return role === 'admin' || role === 'super_admin';
            },

            /**
             * Check if user is vendor
             * @returns {Promise<boolean>} True if vendor
             */
            async isVendor() {
                const role = await this.getRole();
                return role === 'vendor' || role === 'admin' || role === 'super_admin';
            },

            /**
             * Logout user
             * @returns {Promise<void>}
             */
            async logout() {
                try {
                    await window.auth.signOut();
                    window.location.reload();
                } catch (error) {
                    Utils.log('error', 'Logout failed', error);
                    throw { code: 'AUTH_LOGOUT_ERROR', message: error.message };
                }
            },

            /**
             * Require admin role
             * @returns {Promise<boolean>} True if admin
             */
            async requireAdmin() {
                const isAdmin = await this.isAdmin();
                if (!isAdmin) {
                    throw { code: 'AUTH_REQUIRED', message: 'Admin privileges required' };
                }
                return true;
            },

            /**
             * Require vendor role
             * @returns {Promise<boolean>} True if vendor
             */
            async requireVendor() {
                const isVendor = await this.isVendor();
                if (!isVendor) {
                    throw { code: 'AUTH_REQUIRED', message: 'Vendor privileges required' };
                }
                return true;
            }
        };

        // ============================================================
        //  CART ENGINE
        // ============================================================
        const cart = {
            /**
             * Add item to cart
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @param {number} quantity - Quantity
             * @param {Object} variant - Product variant
             * @returns {Promise<Object>} Cart item
             */
            async addItem(userId, productId, quantity = 1, variant = null) {
                const existing = await collections.cart.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                
                if (existing.length > 0) {
                    const item = existing[0];
                    return await collections.cart.update(item.id, {
                        quantity: (item.quantity || 0) + quantity,
                        _updatedAt: serverTimestamp()
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
                    variant,
                    _createdAt: serverTimestamp()
                });
            },

            /**
             * Remove item from cart
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Result
             */
            async removeItem(userId, productId) {
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
            async updateQuantity(userId, productId, quantity) {
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
            async getCart(userId) {
                return await collections.cart.where('userId', '==', userId).exec();
            },

            /**
             * Get cart total
             * @param {string} userId - User ID
             * @returns {Promise<number>} Cart total
             */
            async getTotal(userId) {
                const items = await this.getCart(userId);
                return items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
            },

            /**
             * Clear cart
             * @param {string} userId - User ID
             * @returns {Promise<Object>} Result
             */
            async clear(userId) {
                const items = await this.getCart(userId);
                const ids = items.map(i => i.id);
                if (ids.length > 0) {
                    return await collections.cart.deleteMany(ids);
                }
                return { deleted: 0 };
            },

            /**
             * Listen to cart updates
             * @param {string} userId - User ID
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(userId, callback) {
                return collections.cart.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }]
                });
            }
        };

        // ============================================================
        //  WISHLIST ENGINE
        // ============================================================
        const wishlist = {
            /**
             * Add item to wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Wishlist item
             */
            async addItem(userId, productId) {
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
                    productImage: product?.images?.[0] || '',
                    _createdAt: serverTimestamp()
                });
            },

            /**
             * Remove item from wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<Object>} Result
             */
            async removeItem(userId, productId) {
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
            async getWishlist(userId) {
                return await collections.wishlist.where('userId', '==', userId).exec();
            },

            /**
             * Check if item is in wishlist
             * @param {string} userId - User ID
             * @param {string} productId - Product ID
             * @returns {Promise<boolean>} True if in wishlist
             */
            async isInWishlist(userId, productId) {
                const items = await collections.wishlist.where('userId', '==', userId)
                    .where('productId', '==', productId)
                    .exec();
                return items.length > 0;
            },

            /**
             * Listen to wishlist updates
             * @param {string} userId - User ID
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(userId, callback) {
                return collections.wishlist.listen(callback, {
                    where: [{ field: 'userId', operator: '==', value: userId }]
                });
            }
        };

        // ============================================================
        //  COUPON ENGINE
        // ============================================================
        const coupon = {
            /**
             * Validate coupon code
             * @param {string} code - Coupon code
             * @returns {Promise<Object>} Coupon data
             */
            async validate(code) {
                const coupons = await collections.coupons.where('code', '==', code.toUpperCase()).exec();
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

            /**
             * Use a coupon
             * @param {string} code - Coupon code
             * @returns {Promise<Object>} Updated coupon
             */
            async use(code) {
                const coupon = await this.validate(code);
                return await collections.coupons.update(coupon.id, {
                    usedCount: (coupon.usedCount || 0) + 1,
                    lastUsedAt: serverTimestamp()
                });
            },

            /**
             * Create a new coupon
             * @param {Object} data - Coupon data
             * @returns {Promise<Object>} Created coupon
             */
            async create(data) {
                return await collections.coupons.add({
                    ...data,
                    code: data.code.toUpperCase(),
                    usedCount: 0,
                    active: true,
                    _createdAt: serverTimestamp()
                });
            },

            /**
             * Get active coupons
             * @returns {Promise<Array>} Active coupons
             */
            async getActive() {
                const now = Utils.now();
                const coupons = await collections.coupons.where('active', '==', true).exec();
                return coupons.filter(c => !c.expiresAt || c.expiresAt > now);
            },

            /**
             * Listen to coupon updates
             * @param {Function} callback - Callback function
             * @returns {Function} Unsubscribe function
             */
            listen(callback) {
                return collections.coupons.listen(callback);
            }
        };

        // ============================================================
        //  SYSTEM HELPER
        // ============================================================
        const system = {
            /**
             * Check system health
             * @returns {Promise<Object>} Health status
             */
            async health() {
                try {
                    const start = performance.now();
                    await collections.products.count();
                    const latency = performance.now() - start;
                    return {
                        status: 'healthy',
                        latency,
                        timestamp: Utils.now(),
                        collections: Object.keys(collections).length,
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

            /**
             * Ping database
             * @returns {Promise<Object>} Ping result
             */
            async ping() {
                const start = performance.now();
                await collections.products.count();
                return {
                    latency: performance.now() - start,
                    timestamp: Utils.now()
                };
            },

            /**
             * Get system info
             * @returns {Object} System info
             */
            getInfo() {
                return {
                    version: '1.0.0',
                    collections: Object.keys(collections).length,
                    collectionNames: Object.keys(collections),
                    timestamp: Utils.now()
                };
            }
        };

        // ============================================================
        //  BUILD DB OBJECT
        // ============================================================
        const DB = {
            collections: collections,
            product: product,
            order: order,
            customer: customer,
            homepage: homepage,
            dashboard: dashboard,
            analytics: analytics,
            storage: storage,
            notification: notification,
            activity: activity,
            auth: auth,
            cart: cart,
            wishlist: wishlist,
            coupon: coupon,
            batch: batch,
            transaction: transaction,
            system: system,
            utils: Utils
        };

        // ============================================================
        //  EXPOSE & INIT
        // ============================================================
        window.DB = DB;

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('DBReady', { detail: { DB } }));

        console.log('✅ KFK Core Engine Ready');
        console.log(`📦 ${Object.keys(collections).length} collections initialized`);
        console.log('🔗 12+ engines loaded');

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
