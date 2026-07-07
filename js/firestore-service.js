/**
 * KFK Marketplace - Firestore Service
 * Enterprise Production Ready - Firebase Modular SDK v10+
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete Firestore service layer for KFK Marketplace.
 * This is the ONLY bridge between Firebase and all pages.
 * All CRUD operations go through this service.
 */

import { 
    db, auth, storage,
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, startAfter, onSnapshot,
    serverTimestamp, Timestamp, increment, arrayUnion, arrayRemove,
    writeBatch, runTransaction, getCountFromServer
} from '../firebase/firebase-init.js';

import {
    ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll
} from 'firebase/storage';

// ============================================================
//  UTILITY HELPERS
// ============================================================

/**
 * Standard API Response wrapper
 */
function apiResponse(success, message, data = null, error = null) {
    return {
        success,
        message,
        data,
        error: error ? error.message || error : null,
        timestamp: new Date().toISOString()
    };
}

/**
 * Validate required fields
 */
function validateRequired(data, fields) {
    const missing = fields.filter(field => !data[field] && data[field] !== 0);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

/**
 * Sanitize data for Firestore
 */
function sanitizeData(data) {
    const clean = { ...data };
    delete clean.id;
    delete clean._id;
    delete clean._createdAt;
    delete clean._updatedAt;
    return clean;
}

// ============================================================
//  COLLECTION REFERENCE HELPERS
// ============================================================

function getCollection(name) {
    return collection(db, name);
}

function getDocument(collectionName, docId) {
    return doc(db, collectionName, docId);
}

// ============================================================
//  GENERIC CRUD FUNCTIONS
// ============================================================

/**
 * Get all documents from a collection
 */
async function getAll(collectionName, options = {}) {
    try {
        let q = getCollection(collectionName);
        
        if (options.where) {
            options.where.forEach(condition => {
                q = query(q, where(condition.field, condition.operator, condition.value));
            });
        }
        
        if (options.orderBy) {
            q = query(q, orderBy(options.orderBy, options.orderDirection || 'asc'));
        }
        
        if (options.limit) {
            q = query(q, limit(options.limit));
        }
        
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() });
        });
        
        return apiResponse(true, 'Data retrieved successfully', results);
    } catch (error) {
        console.error(`[Firestore] getAll(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to retrieve data', null, error);
    }
}

/**
 * Get document by ID
 */
async function getById(collectionName, id) {
    try {
        if (!id) {
            return apiResponse(false, 'Document ID is required', null);
        }
        
        const docRef = getDocument(collectionName, id);
        const snapshot = await getDoc(docRef);
        
        if (!snapshot.exists()) {
            return apiResponse(false, 'Document not found', null);
        }
        
        return apiResponse(true, 'Document retrieved successfully', { id: snapshot.id, ...snapshot.data() });
    } catch (error) {
        console.error(`[Firestore] getById(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to retrieve document', null, error);
    }
}

/**
 * Add a new document
 */
async function addDocument(collectionName, data) {
    try {
        if (!data || typeof data !== 'object') {
            return apiResponse(false, 'Invalid data provided', null);
        }
        
        const cleanData = sanitizeData(data);
        const docRef = await addDoc(getCollection(collectionName), {
            ...cleanData,
            _createdAt: serverTimestamp(),
            _updatedAt: serverTimestamp()
        });
        
        const snapshot = await getDoc(docRef);
        return apiResponse(true, 'Document added successfully', { id: docRef.id, ...snapshot.data() });
    } catch (error) {
        console.error(`[Firestore] addDocument(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to add document', null, error);
    }
}

/**
 * Update a document
 */
async function updateDocument(collectionName, id, data) {
    try {
        if (!id) {
            return apiResponse(false, 'Document ID is required', null);
        }
        
        if (!data || typeof data !== 'object') {
            return apiResponse(false, 'Invalid data provided', null);
        }
        
        const cleanData = sanitizeData(data);
        const docRef = getDocument(collectionName, id);
        
        await updateDoc(docRef, {
            ...cleanData,
            _updatedAt: serverTimestamp()
        });
        
        const snapshot = await getDoc(docRef);
        return apiResponse(true, 'Document updated successfully', { id: snapshot.id, ...snapshot.data() });
    } catch (error) {
        console.error(`[Firestore] updateDocument(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to update document', null, error);
    }
}

/**
 * Delete a document
 */
async function deleteDocument(collectionName, id) {
    try {
        if (!id) {
            return apiResponse(false, 'Document ID is required', null);
        }
        
        const docRef = getDocument(collectionName, id);
        await deleteDoc(docRef);
        
        return apiResponse(true, 'Document deleted successfully', { id });
    } catch (error) {
        console.error(`[Firestore] deleteDocument(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to delete document', null, error);
    }
}

/**
 * Count documents in a collection
 */
async function countDocuments(collectionName, conditions = null) {
    try {
        let q = getCollection(collectionName);
        
        if (conditions) {
            conditions.forEach(condition => {
                q = query(q, where(condition.field, condition.operator, condition.value));
            });
        }
        
        const snapshot = await getCountFromServer(q);
        return apiResponse(true, 'Count retrieved successfully', snapshot.data().count);
    } catch (error) {
        console.error(`[Firestore] countDocuments(${collectionName}) error:`, error);
        return apiResponse(false, 'Failed to count documents', null, error);
    }
}

/**
 * Listen to realtime updates
 */
function listenToCollection(collectionName, callback, conditions = null) {
    try {
        let q = getCollection(collectionName);
        
        if (conditions) {
            if (conditions.where) {
                conditions.where.forEach(condition => {
                    q = query(q, where(condition.field, condition.operator, condition.value));
                });
            }
            if (conditions.orderBy) {
                q = query(q, orderBy(conditions.orderBy, conditions.orderDirection || 'asc'));
            }
            if (conditions.limit) {
                q = query(q, limit(conditions.limit));
            }
        }
        
        return onSnapshot(q, (snapshot) => {
            const results = [];
            snapshot.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() });
            });
            callback(apiResponse(true, 'Realtime update received', results));
        }, (error) => {
            console.error(`[Firestore] listenToCollection(${collectionName}) error:`, error);
            callback(apiResponse(false, 'Realtime update failed', null, error));
        });
    } catch (error) {
        console.error(`[Firestore] listenToCollection(${collectionName}) setup error:`, error);
        return null;
    }
}

/**
 * Batch write operations
 */
async function batchWrite(collectionName, operations) {
    try {
        if (!operations || !Array.isArray(operations) || operations.length === 0) {
            return apiResponse(false, 'No operations provided', null);
        }
        
        const batch = writeBatch(db);
        
        operations.forEach(op => {
            const ref = getDocument(collectionName, op.id);
            if (op.type === 'set') {
                batch.set(ref, { ...op.data, _updatedAt: serverTimestamp() }, { merge: op.merge !== false });
            } else if (op.type === 'update') {
                batch.update(ref, { ...op.data, _updatedAt: serverTimestamp() });
            } else if (op.type === 'delete') {
                batch.delete(ref);
            }
        });
        
        await batch.commit();
        return apiResponse(true, `Batch operation completed (${operations.length} operations)`, { count: operations.length });
    } catch (error) {
        console.error(`[Firestore] batchWrite(${collectionName}) error:`, error);
        return apiResponse(false, 'Batch operation failed', null, error);
    }
}

/**
 * Run a transaction
 */
async function runTransaction(transactionCallback) {
    try {
        const result = await runTransaction(db, async (transaction) => {
            return await transactionCallback(transaction);
        });
        return apiResponse(true, 'Transaction completed successfully', result);
    } catch (error) {
        console.error('[Firestore] runTransaction error:', error);
        return apiResponse(false, 'Transaction failed', null, error);
    }
}

// ============================================================
//  PRODUCTS MODULE
// ============================================================

export const products = {
    getAll: (options) => getAll('products', options),
    getById: (id) => getById('products', id),
    add: (data) => addDocument('products', data),
    update: (id, data) => updateDocument('products', id, data),
    delete: (id) => deleteDocument('products', id),
    count: (conditions) => countDocuments('products', conditions),
    listen: (callback, conditions) => listenToCollection('products', callback, conditions),
    batch: (operations) => batchWrite('products', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Search products by name or description
     */
    search: async (term, options = {}) => {
        try {
            const result = await products.getAll(options);
            if (!result.success) return result;
            
            const searchTerm = term.toLowerCase();
            const filtered = result.data.filter(item => {
                const name = (item.name || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const sku = (item.sku || '').toLowerCase();
                return name.includes(searchTerm) || 
                       description.includes(searchTerm) || 
                       sku.includes(searchTerm);
            });
            
            return apiResponse(true, 'Search completed', filtered);
        } catch (error) {
            return apiResponse(false, 'Search failed', null, error);
        }
    },
    
    /**
     * Update product stock
     */
    updateStock: async (id, newStock) => {
        return await updateDocument('products', id, { stock: newStock });
    },
    
    /**
     * Increase stock
     */
    increaseStock: async (id, amount) => {
        const product = await getById('products', id);
        if (!product.success) return product;
        const currentStock = product.data.stock || 0;
        return await updateDocument('products', id, { stock: currentStock + amount });
    },
    
    /**
     * Decrease stock
     */
    decreaseStock: async (id, amount) => {
        const product = await getById('products', id);
        if (!product.success) return product;
        const currentStock = product.data.stock || 0;
        if (currentStock < amount) {
            return apiResponse(false, 'Insufficient stock', null);
        }
        return await updateDocument('products', id, { stock: currentStock - amount });
    },
    
    /**
     * Get featured products
     */
    getFeatured: async (limit = 8) => {
        return await getAll('products', {
            where: [{ field: 'featured', operator: '==', value: true }],
            limit: limit,
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
    },
    
    /**
     * Get products by category
     */
    getByCategory: async (category, limit = 20) => {
        return await getAll('products', {
            where: [{ field: 'category', operator: '==', value: category }],
            limit: limit
        });
    },
    
    /**
     * Get products with offers
     */
    getWithOffers: async (limit = 20) => {
        const result = await products.getAll({ limit });
        if (!result.success) return result;
        const filtered = result.data.filter(p => p.offerPrice && p.offerPrice < p.price);
        return apiResponse(true, 'Products with offers retrieved', filtered);
    },
    
    /**
     * Get low stock products
     */
    getLowStock: async (threshold = 10) => {
        const result = await products.getAll();
        if (!result.success) return result;
        const filtered = result.data.filter(p => (p.stock || 0) < threshold);
        return apiResponse(true, 'Low stock products retrieved', filtered);
    }
};

// ============================================================
//  CATEGORIES MODULE
// ============================================================

export const categories = {
    getAll: (options) => getAll('categories', options),
    getById: (id) => getById('categories', id),
    add: (data) => addDocument('categories', data),
    update: (id, data) => updateDocument('categories', id, data),
    delete: (id) => deleteDocument('categories', id),
    count: (conditions) => countDocuments('categories', conditions),
    listen: (callback, conditions) => listenToCollection('categories', callback, conditions),
    batch: (operations) => batchWrite('categories', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get categories with product count
     */
    getWithCounts: async () => {
        const categoriesResult = await categories.getAll();
        if (!categoriesResult.success) return categoriesResult;
        
        const productsResult = await products.getAll();
        const productCounts = {};
        if (productsResult.success) {
            productsResult.data.forEach(p => {
                const cat = p.category || 'uncategorized';
                productCounts[cat] = (productCounts[cat] || 0) + 1;
            });
        }
        
        const enriched = categoriesResult.data.map(c => ({
            ...c,
            productCount: productCounts[c.name] || 0
        }));
        
        return apiResponse(true, 'Categories with counts retrieved', enriched);
    },
    
    /**
     * Get active categories
     */
    getActive: async (limit = 20) => {
        return await getAll('categories', {
            where: [{ field: 'status', operator: '==', value: 'active' }],
            limit: limit,
            orderBy: 'displayOrder',
            orderDirection: 'asc'
        });
    }
};

// ============================================================
//  ORDERS MODULE
// ============================================================

export const orders = {
    getAll: (options) => getAll('orders', options),
    getById: (id) => getById('orders', id),
    add: (data) => addDocument('orders', data),
    update: (id, data) => updateDocument('orders', id, data),
    delete: (id) => deleteDocument('orders', id),
    count: (conditions) => countDocuments('orders', conditions),
    listen: (callback, conditions) => listenToCollection('orders', callback, conditions),
    batch: (operations) => batchWrite('orders', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get orders by customer
     */
    getByCustomer: async (customerId) => {
        return await getAll('orders', {
            where: [{ field: 'customerId', operator: '==', value: customerId }],
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
    },
    
    /**
     * Get orders by status
     */
    getByStatus: async (status) => {
        return await getAll('orders', {
            where: [{ field: 'status', operator: '==', value: status }],
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
    },
    
    /**
     * Update order status
     */
    updateStatus: async (id, status) => {
        return await updateDocument('orders', id, { 
            status, 
            statusUpdatedAt: serverTimestamp() 
        });
    },
    
    /**
     * Assign delivery partner
     */
    assignDelivery: async (id, deliveryPartner, trackingNumber = '') => {
        return await updateDocument('orders', id, {
            deliveryPartner,
            trackingNumber,
            assignedAt: serverTimestamp()
        });
    },
    
    /**
     * Cancel order
     */
    cancelOrder: async (id, reason = '') => {
        return await updateDocument('orders', id, {
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: serverTimestamp()
        });
    },
    
    /**
     * Get order revenue
     */
    getRevenue: async (period = 'all') => {
        try {
            const result = await getAll('orders', {
                where: [{ field: 'status', operator: 'in', value: ['delivered', 'completed'] }]
            });
            
            if (!result.success) return result;
            
            const totalRevenue = result.data.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
            const totalOrders = result.data.length;
            const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            
            return apiResponse(true, 'Revenue calculated', {
                totalRevenue,
                totalOrders,
                averageOrder,
                orders: result.data
            });
        } catch (error) {
            return apiResponse(false, 'Failed to calculate revenue', null, error);
        }
    },
    
    /**
     * Get order statistics by status
     */
    getStatusCounts: async () => {
        try {
            const result = await orders.getAll();
            if (!result.success) return result;
            
            const counts = {};
            result.data.forEach(order => {
                const status = order.status || 'pending';
                counts[status] = (counts[status] || 0) + 1;
            });
            
            return apiResponse(true, 'Status counts retrieved', counts);
        } catch (error) {
            return apiResponse(false, 'Failed to get status counts', null, error);
        }
    }
};

// ============================================================
//  CUSTOMERS MODULE
// ============================================================

export const customers = {
    getAll: (options) => getAll('customers', options),
    getById: (id) => getById('customers', id),
    add: (data) => addDocument('customers', data),
    update: (id, data) => updateDocument('customers', id, data),
    delete: (id) => deleteDocument('customers', id),
    count: (conditions) => countDocuments('customers', conditions),
    listen: (callback, conditions) => listenToCollection('customers', callback, conditions),
    batch: (operations) => batchWrite('customers', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Search customers by name or email
     */
    search: async (term) => {
        try {
            const result = await customers.getAll();
            if (!result.success) return result;
            
            const searchTerm = term.toLowerCase();
            const filtered = result.data.filter(item => {
                const name = (item.name || '').toLowerCase();
                const email = (item.email || '').toLowerCase();
                const phone = (item.phone || '');
                return name.includes(searchTerm) || 
                       email.includes(searchTerm) || 
                       phone.includes(searchTerm);
            });
            
            return apiResponse(true, 'Search completed', filtered);
        } catch (error) {
            return apiResponse(false, 'Search failed', null, error);
        }
    },
    
    /**
     * Get customer with orders
     */
    getWithOrders: async (id) => {
        const customerResult = await customers.getById(id);
        if (!customerResult.success) return customerResult;
        
        const ordersResult = await orders.getByCustomer(id);
        return apiResponse(true, 'Customer with orders retrieved', {
            ...customerResult.data,
            orders: ordersResult.success ? ordersResult.data : []
        });
    },
    
    /**
     * Get top customers by spending
     */
    getTopSpenders: async (limit = 10) => {
        try {
            const customersResult = await customers.getAll();
            if (!customersResult.success) return customersResult;
            
            const ordersResult = await orders.getAll();
            const spending = {};
            
            if (ordersResult.success) {
                ordersResult.data.forEach(order => {
                    const id = order.customerId;
                    if (id) {
                        spending[id] = (spending[id] || 0) + (order.grandTotal || 0);
                    }
                });
            }
            
            const enriched = customersResult.data.map(c => ({
                ...c,
                totalSpent: spending[c.id] || 0,
                orderCount: 0 // would need separate count
            }));
            
            const sorted = enriched.sort((a, b) => b.totalSpent - a.totalSpent);
            return apiResponse(true, 'Top spenders retrieved', sorted.slice(0, limit));
        } catch (error) {
            return apiResponse(false, 'Failed to get top spenders', null, error);
        }
    }
};

// ============================================================
//  INVENTORY MODULE
// ============================================================

export const inventory = {
    getAll: (options) => getAll('inventory', options),
    getById: (id) => getById('inventory', id),
    add: (data) => addDocument('inventory', data),
    update: (id, data) => updateDocument('inventory', id, data),
    delete: (id) => deleteDocument('inventory', id),
    count: (conditions) => countDocuments('inventory', conditions),
    listen: (callback, conditions) => listenToCollection('inventory', callback, conditions),
    batch: (operations) => batchWrite('inventory', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get low stock items
     */
    getLowStock: async (threshold = 10) => {
        const result = await inventory.getAll();
        if (!result.success) return result;
        const filtered = result.data.filter(item => (item.stock || 0) < threshold);
        return apiResponse(true, 'Low stock items retrieved', filtered);
    },
    
    /**
     * Update stock
     */
    updateStock: async (id, newStock) => {
        return await updateDocument('inventory', id, { 
            stock: newStock,
            lastStockUpdate: serverTimestamp()
        });
    },
    
    /**
     * Increase stock
     */
    increaseStock: async (id, amount) => {
        const item = await inventory.getById(id);
        if (!item.success) return item;
        const currentStock = item.data.stock || 0;
        return await inventory.updateStock(id, currentStock + amount);
    },
    
    /**
     * Decrease stock
     */
    decreaseStock: async (id, amount) => {
        const item = await inventory.getById(id);
        if (!item.success) return item;
        const currentStock = item.data.stock || 0;
        if (currentStock < amount) {
            return apiResponse(false, 'Insufficient stock', null);
        }
        return await inventory.updateStock(id, currentStock - amount);
    },
    
    /**
     * Get inventory value
     */
    getValue: async () => {
        const result = await inventory.getAll();
        if (!result.success) return result;
        const totalValue = result.data.reduce((sum, item) => {
            return sum + ((item.price || 0) * (item.stock || 0));
        }, 0);
        return apiResponse(true, 'Inventory value calculated', { totalValue });
    }
};

// ============================================================
//  HOMEPAGE MODULE
// ============================================================

export const homepage = {
    getById: (id) => getById('homepage', id),
    update: (id, data) => updateDocument('homepage', id, data),
    getAll: (options) => getAll('homepage', options),
    listen: (callback, conditions) => listenToCollection('homepage', callback, conditions),
    
    /**
     * Get hero banner
     */
    getHeroBanner: async () => {
        const result = await getAll('homepage', {
            where: [{ field: 'type', operator: '==', value: 'hero' }]
        });
        if (result.success && result.data.length > 0) {
            return apiResponse(true, 'Hero banner retrieved', result.data[0]);
        }
        return apiResponse(false, 'Hero banner not found', null);
    },
    
    /**
     * Update hero banner
     */
    updateHeroBanner: async (id, data) => {
        return await updateDocument('homepage', id, { ...data, type: 'hero' });
    },
    
    /**
     * Get featured products for homepage
     */
    getFeaturedProducts: async (limit = 8) => {
        return await products.getFeatured(limit);
    },
    
    /**
     * Get homepage sections
     */
    getSections: async () => {
        return await getAll('homepage', {
            where: [{ field: 'type', operator: '==', value: 'section' }],
            orderBy: 'displayOrder',
            orderDirection: 'asc'
        });
    },
    
    /**
     * Update homepage section
     */
    updateSection: async (id, data) => {
        return await updateDocument('homepage', id, { ...data, type: 'section' });
    }
};

// ============================================================
//  OFFERS MODULE
// ============================================================

export const offers = {
    getAll: (options) => getAll('offers', options),
    getById: (id) => getById('offers', id),
    add: (data) => addDocument('offers', data),
    update: (id, data) => updateDocument('offers', id, data),
    delete: (id) => deleteDocument('offers', id),
    count: (conditions) => countDocuments('offers', conditions),
    listen: (callback, conditions) => listenToCollection('offers', callback, conditions),
    batch: (operations) => batchWrite('offers', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get active offers
     */
    getActive: async () => {
        const now = new Date().toISOString();
        const result = await getAll('offers', {
            where: [{ field: 'active', operator: '==', value: true }]
        });
        if (!result.success) return result;
        const filtered = result.data.filter(o => !o.expiresAt || o.expiresAt > now);
        return apiResponse(true, 'Active offers retrieved', filtered);
    },
    
    /**
     * Get offers by type
     */
    getByType: async (type) => {
        return await getAll('offers', {
            where: [{ field: 'type', operator: '==', value: type }]
        });
    }
};

// ============================================================
//  CRM MODULE
// ============================================================

export const crm = {
    getAll: (options) => getAll('crm', options),
    getById: (id) => getById('crm', id),
    add: (data) => addDocument('crm', data),
    update: (id, data) => updateDocument('crm', id, data),
    delete: (id) => deleteDocument('crm', id),
    count: (conditions) => countDocuments('crm', conditions),
    listen: (callback, conditions) => listenToCollection('crm', callback, conditions),
    batch: (operations) => batchWrite('crm', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get leads by status
     */
    getByStatus: async (status) => {
        return await getAll('crm', {
            where: [{ field: 'status', operator: '==', value: status }]
        });
    },
    
    /**
     * Get leads by assigned user
     */
    getByAssigned: async (userId) => {
        return await getAll('crm', {
            where: [{ field: 'assignedTo', operator: '==', value: userId }]
        });
    },
    
    /**
     * Update lead status
     */
    updateStatus: async (id, status) => {
        return await updateDocument('crm', id, { 
            status, 
            statusUpdatedAt: serverTimestamp() 
        });
    },
    
    /**
     * Assign lead to user
     */
    assign: async (id, userId) => {
        return await updateDocument('crm', id, {
            assignedTo: userId,
            assignedAt: serverTimestamp()
        });
    }
};

// ============================================================
//  NOTIFICATIONS MODULE
// ============================================================

export const notifications = {
    getAll: (options) => getAll('notifications', options),
    getById: (id) => getById('notifications', id),
    add: (data) => addDocument('notifications', data),
    update: (id, data) => updateDocument('notifications', id, data),
    delete: (id) => deleteDocument('notifications', id),
    count: (conditions) => countDocuments('notifications', conditions),
    listen: (callback, conditions) => listenToCollection('notifications', callback, conditions),
    batch: (operations) => batchWrite('notifications', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get user notifications
     */
    getByUser: async (userId) => {
        return await getAll('notifications', {
            where: [{ field: 'userId', operator: '==', value: userId }],
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
    },
    
    /**
     * Mark notification as read
     */
    markRead: async (id) => {
        return await updateDocument('notifications', id, { read: true });
    },
    
    /**
     * Mark all as read for user
     */
    markAllRead: async (userId) => {
        const result = await notifications.getByUser(userId);
        if (!result.success) return result;
        const unread = result.data.filter(n => !n.read);
        if (unread.length === 0) {
            return apiResponse(true, 'No unread notifications', { count: 0 });
        }
        const operations = unread.map(n => ({
            id: n.id,
            type: 'update',
            data: { read: true }
        }));
        return await batchWrite('notifications', operations);
    },
    
    /**
     * Get unread count
     */
    getUnreadCount: async (userId) => {
        const result = await notifications.getByUser(userId);
        if (!result.success) return result;
        const count = result.data.filter(n => !n.read).length;
        return apiResponse(true, 'Unread count retrieved', { count });
    },
    
    /**
     * Send notification to user
     */
    send: async (userId, title, message, type = 'info', data = {}) => {
        return await addDocument('notifications', {
            userId,
            title,
            message,
            type,
            data,
            read: false
        });
    }
};

// ============================================================
//  FRANCHISE MODULE
// ============================================================

export const franchise = {
    getAll: (options) => getAll('franchise', options),
    getById: (id) => getById('franchise', id),
    add: (data) => addDocument('franchise', data),
    update: (id, data) => updateDocument('franchise', id, data),
    delete: (id) => deleteDocument('franchise', id),
    count: (conditions) => countDocuments('franchise', conditions),
    listen: (callback, conditions) => listenToCollection('franchise', callback, conditions),
    batch: (operations) => batchWrite('franchise', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get applications by status
     */
    getByStatus: async (status) => {
        return await getAll('franchise', {
            where: [{ field: 'status', operator: '==', value: status }]
        });
    },
    
    /**
     * Approve application
     */
    approve: async (id) => {
        return await updateDocument('franchise', id, {
            status: 'approved',
            approvedAt: serverTimestamp()
        });
    },
    
    /**
     * Reject application
     */
    reject: async (id, reason = '') => {
        return await updateDocument('franchise', id, {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: serverTimestamp()
        });
    }
};

// ============================================================
//  USERS MODULE
// ============================================================

export const users = {
    getAll: (options) => getAll('users', options),
    getById: (id) => getById('users', id),
    add: (data) => addDocument('users', data),
    update: (id, data) => updateDocument('users', id, data),
    delete: (id) => deleteDocument('users', id),
    count: (conditions) => countDocuments('users', conditions),
    listen: (callback, conditions) => listenToCollection('users', callback, conditions),
    batch: (operations) => batchWrite('users', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get user by email
     */
    getByEmail: async (email) => {
        const result = await getAll('users', {
            where: [{ field: 'email', operator: '==', value: email }]
        });
        if (result.success && result.data.length > 0) {
            return apiResponse(true, 'User found', result.data[0]);
        }
        return apiResponse(false, 'User not found', null);
    },
    
    /**
     * Get users by role
     */
    getByRole: async (role) => {
        return await getAll('users', {
            where: [{ field: 'role', operator: '==', value: role }]
        });
    },
    
    /**
     * Update user role
     */
    updateRole: async (id, role) => {
        return await updateDocument('users', id, { role });
    }
};

// ============================================================
//  ANALYTICS MODULE
// ============================================================

export const analytics = {
    getAll: (options) => getAll('analytics', options),
    getById: (id) => getById('analytics', id),
    add: (data) => addDocument('analytics', data),
    update: (id, data) => updateDocument('analytics', id, data),
    delete: (id) => deleteDocument('analytics', id),
    listen: (callback, conditions) => listenToCollection('analytics', callback, conditions),
    batch: (operations) => batchWrite('analytics', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get dashboard stats
     */
    getDashboardStats: async () => {
        try {
            const [productsCount, ordersCount, customersCount, revenue] = await Promise.all([
                products.count(),
                orders.count(),
                customers.count(),
                orders.getRevenue()
            ]);
            
            const pendingOrders = await orders.getByStatus('pending');
            const deliveredOrders = await orders.getByStatus('delivered');
            
            return apiResponse(true, 'Dashboard stats retrieved', {
                totalProducts: productsCount.success ? productsCount.data : 0,
                totalOrders: ordersCount.success ? ordersCount.data : 0,
                totalCustomers: customersCount.success ? customersCount.data : 0,
                totalRevenue: revenue.success ? revenue.data.totalRevenue : 0,
                pendingOrders: pendingOrders.success ? pendingOrders.data.length : 0,
                deliveredOrders: deliveredOrders.success ? deliveredOrders.data.length : 0
            });
        } catch (error) {
            return apiResponse(false, 'Failed to get dashboard stats', null, error);
        }
    },
    
    /**
     * Get sales data for chart
     */
    getSalesData: async (days = 30) => {
        try {
            const result = await orders.getAll();
            if (!result.success) return result;
            
            const now = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const dailySales = {};
            result.data.forEach(order => {
                const date = new Date(order._createdAt || order.createdAt);
                if (date < startDate) return;
                const key = date.toISOString().split('T')[0];
                if (!dailySales[key]) {
                    dailySales[key] = { date: key, revenue: 0, orders: 0 };
                }
                dailySales[key].revenue += order.grandTotal || 0;
                dailySales[key].orders += 1;
            });
            
            const chartData = Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date));
            return apiResponse(true, 'Sales data retrieved', chartData);
        } catch (error) {
            return apiResponse(false, 'Failed to get sales data', null, error);
        }
    }
};

// ============================================================
//  SETTINGS MODULE
// ============================================================

export const settings = {
    getAll: (options) => getAll('settings', options),
    getById: (id) => getById('settings', id),
    add: (data) => addDocument('settings', data),
    update: (id, data) => updateDocument('settings', id, data),
    delete: (id) => deleteDocument('settings', id),
    listen: (callback, conditions) => listenToCollection('settings', callback, conditions),
    batch: (operations) => batchWrite('settings', operations),
    transaction: (callback) => runTransaction(callback),
    
    /**
     * Get setting by key
     */
    getByKey: async (key) => {
        const result = await getAll('settings', {
            where: [{ field: 'key', operator: '==', value: key }]
        });
        if (result.success && result.data.length > 0) {
            return apiResponse(true, 'Setting found', result.data[0]);
        }
        return apiResponse(false, 'Setting not found', null);
    },
    
    /**
     * Set setting value
     */
    set: async (key, value) => {
        const existing = await settings.getByKey(key);
        if (existing.success) {
            return await updateDocument('settings', existing.data.id, { value });
        }
        return await addDocument('settings', { key, value });
    },
    
    /**
     * Get multiple settings
     */
    getMultiple: async (keys) => {
        try {
            const result = {};
            for (const key of keys) {
                const setting = await settings.getByKey(key);
                if (setting.success) {
                    result[key] = setting.data.value;
                }
            }
            return apiResponse(true, 'Settings retrieved', result);
        } catch (error) {
            return apiResponse(false, 'Failed to get settings', null, error);
        }
    }
};

// ============================================================
//  AUTHENTICATION MODULE
// ============================================================

export const auth = {
    /**
     * Get current user
     */
    currentUser: () => {
        return auth.currentUser;
    },
    
    /**
     * Check if user is logged in
     */
    isLoggedIn: () => {
        return !!auth.currentUser;
    },
    
    /**
     * Logout user
     */
    logout: async () => {
        try {
            await auth.signOut();
            return apiResponse(true, 'Logged out successfully', null);
        } catch (error) {
            return apiResponse(false, 'Logout failed', null, error);
        }
    },
    
    /**
     * Get user profile from Firestore
     */
    getProfile: async () => {
        const user = auth.currentUser;
        if (!user) {
            return apiResponse(false, 'Not authenticated', null);
        }
        return await users.getById(user.uid);
    },
    
    /**
     * Update user profile
     */
    updateProfile: async (data) => {
        const user = auth.currentUser;
        if (!user) {
            return apiResponse(false, 'Not authenticated', null);
        }
        return await users.update(user.uid, data);
    },
    
    /**
     * Check if user has admin role
     */
    isAdmin: async () => {
        const user = auth.currentUser;
        if (!user) return false;
        const result = await users.getById(user.uid);
        if (!result.success) return false;
        const role = result.data.role || 'customer';
        return role === 'admin' || role === 'super_admin';
    },
    
    /**
     * Check if user has vendor role
     */
    isVendor: async () => {
        const user = auth.currentUser;
        if (!user) return false;
        const result = await users.getById(user.uid);
        if (!result.success) return false;
        const role = result.data.role || 'customer';
        return role === 'vendor' || role === 'admin' || role === 'super_admin';
    }
};

// ============================================================
//  STORAGE MODULE (Firebase Storage)
// ============================================================

export const storageService = {
    /**
     * Upload a file
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
                    (error) => {
                        reject(apiResponse(false, 'Upload failed', null, error));
                    },
                    async () => {
                        try {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(apiResponse(true, 'Upload successful', { url, path }));
                        } catch (error) {
                            reject(apiResponse(false, 'Failed to get download URL', null, error));
                        }
                    }
                );
            });
        } catch (error) {
            return apiResponse(false, 'Upload failed', null, error);
        }
    },
    
    /**
     * Upload product image
     */
    uploadProductImage: async (productId, file, onProgress = null) => {
        const path = `products/${productId}/image_${Date.now()}.jpg`;
        return await storageService.upload(path, file, { contentType: file.type }, onProgress);
    },
    
    /**
     * Upload customer avatar
     */
    uploadCustomerImage: async (customerId, file, onProgress = null) => {
        const path = `customers/${customerId}/avatar_${Date.now()}.jpg`;
        return await storageService.upload(path, file, { contentType: file.type }, onProgress);
    },
    
    /**
     * Delete a file
     */
    deleteFile: async (path) => {
        try {
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
            return apiResponse(true, 'File deleted successfully', { path });
        } catch (error) {
            return apiResponse(false, 'Failed to delete file', null, error);
        }
    },
    
    /**
     * Get download URL
     */
    getURL: async (path) => {
        try {
            const storageRef = ref(storage, path);
            const url = await getDownloadURL(storageRef);
            return apiResponse(true, 'URL retrieved', { url, path });
        } catch (error) {
            return apiResponse(false, 'Failed to get URL', null, error);
        }
    },
    
    /**
     * List files in directory
     */
    listFiles: async (prefix) => {
        try {
            const storageRef = ref(storage, prefix);
            const result = await listAll(storageRef);
            const items = result.items.map(item => ({
                name: item.name,
                path: item.fullPath
            }));
            return apiResponse(true, 'Files listed', { items, prefixes: result.prefixes });
        } catch (error) {
            return apiResponse(false, 'Failed to list files', null, error);
        }
    }
};

// ============================================================
//  SEARCH MODULE (Cross-collection)
// ============================================================

export const search = {
    /**
     * Global search across collections
     */
    global: async (term, collections = ['products', 'orders', 'customers']) => {
        try {
            const results = {};
            
            for (const collection of collections) {
                let result;
                switch (collection) {
                    case 'products':
                        result = await products.search(term);
                        break;
                    case 'orders':
                        result = await orders.getAll();
                        if (result.success) {
                            const searchTerm = term.toLowerCase();
                            result.data = result.data.filter(o => 
                                o.id?.toLowerCase().includes(searchTerm) ||
                                o.customerId?.toLowerCase().includes(searchTerm)
                            );
                            result.message = 'Search completed';
                        }
                        break;
                    case 'customers':
                        result = await customers.search(term);
                        break;
                    default:
                        continue;
                }
                results[collection] = result.success ? result.data : [];
            }
            
            return apiResponse(true, 'Global search completed', results);
        } catch (error) {
            return apiResponse(false, 'Global search failed', null, error);
        }
    }
};

// ============================================================
//  EXPORT ALL MODULES
// ============================================================

export default {
    products,
    categories,
    orders,
    customers,
    inventory,
    homepage,
    offers,
    crm,
    notifications,
    franchise,
    users,
    analytics,
    settings,
    auth,
    storageService,
    search,
    // Utility functions
    getAll,
    getById,
    addDocument,
    updateDocument,
    deleteDocument,
    countDocuments,
    listenToCollection,
    batchWrite,
    runTransaction,
    apiResponse
};
