/**
 * KFK Marketplace - Admin Panel Controller
 * Production Ready - Enterprise Grade
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete admin panel controller for KFK Marketplace.
 * Uses window.KFK core engine for all data operations.
 * No Firebase direct calls - everything through KFK.
 */

(function() {
    'use strict';

    // ============================================================
    //  WAIT FOR KFK CORE
    // ============================================================
    function waitForKFK(retries = 0) {
        if (window.KFK && window.KFK.utils) {
            initializeAdmin();
            return;
        }
        if (retries > 30) {
            console.error('[Admin] KFK Core not available');
            return;
        }
        setTimeout(() => waitForKFK(retries + 1), 200);
    }

    // ============================================================
    //  ADMIN CONTROLLER
    // ============================================================
    function initializeAdmin() {
        const { KFK } = window;
        const { utils, collections, products, orders, customers, categories, inventory, users, offers, blogs, notifications, activityLogs, analytics, dashboard, storage, auth, settings, homepage, cart, wishlist, crm, franchise, cloudKitchen } = KFK;

        // ============================================================
        //  DOM HELPERS
        // ============================================================
        const DOM = {
            get: (id) => document.getElementById(id),
            qs: (selector, context = document) => context.querySelector(selector),
            qsa: (selector, context = document) => context.querySelectorAll(selector),
            create: (tag, attrs = {}, content = '') => {
                const el = document.createElement(tag);
                Object.entries(attrs).forEach(([key, value]) => {
                    if (key === 'className') el.className = value;
                    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
                    else el.setAttribute(key, value);
                });
                if (content) el.innerHTML = content;
                return el;
            },
            empty: (el) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.innerHTML = ''; },
            append: (parent, child) => {
                const p = typeof parent === 'string' ? DOM.qs(parent) : parent;
                if (!p) return;
                if (typeof child === 'string') p.insertAdjacentHTML('beforeend', child);
                else p.appendChild(child);
            },
            show: (el) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.style.display = ''; },
            hide: (el) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.style.display = 'none'; },
            val: (el, value) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e && value !== undefined) e.value = value; return e ? e.value : ''; },
            text: (el, text) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e && text !== undefined) e.textContent = text; return e ? e.textContent : ''; },
            html: (el, html) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e && html !== undefined) e.innerHTML = html; return e ? e.innerHTML : ''; },
            addClass: (el, cls) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.classList.add(cls); },
            removeClass: (el, cls) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.classList.remove(cls); },
            toggleClass: (el, cls) => { const e = typeof el === 'string' ? DOM.qs(el) : el; if (e) e.classList.toggle(cls); },
            exists: (selector) => !!DOM.qs(selector)
        };

        // ============================================================
        //  TOAST SYSTEM
        // ============================================================
        const Toast = {
            _container: null,

            init() {
                if (!this._container) {
                    this._container = DOM.create('div', {
                        className: 'toast-container',
                        style: {
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            zIndex: '9999',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            maxWidth: '400px',
                            width: '100%',
                            pointerEvents: 'none'
                        }
                    });
                    document.body.appendChild(this._container);
                }
            },

            show(message, type = 'info', duration = 4000) {
                this.init();
                const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
                const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

                const toast = DOM.create('div', {
                    className: `toast toast-${type}`,
                    style: {
                        background: 'white',
                        borderRadius: '8px',
                        padding: '14px 18px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        borderLeft: `4px solid ${colors[type]}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        pointerEvents: 'auto',
                        animation: 'slideInRight 0.3s ease'
                    }
                });

                toast.innerHTML = `
                    <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.2rem;"></i>
                    <span style="flex: 1; font-size: 0.9rem; color: #1a1a2e;">${message}</span>
                    <button class="toast-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1rem;">
                        <i class="fas fa-times"></i>
                    </button>
                `;

                this._container.appendChild(toast);

                const closeBtn = toast.querySelector('.toast-close');
                closeBtn.addEventListener('click', () => this._remove(toast));

                setTimeout(() => {
                    if (toast.parentNode) this._remove(toast);
                }, duration);

                return toast;
            },

            success: (msg, d) => this.show(msg, 'success', d),
            error: (msg, d) => this.show(msg, 'error', d),
            warning: (msg, d) => this.show(msg, 'warning', d),
            info: (msg, d) => this.show(msg, 'info', d),

            _remove(toast) {
                toast.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
            },

            clear() { if (this._container) this._container.innerHTML = ''; }
        };

        // ============================================================
        //  LOADING SYSTEM
        // ============================================================
        const Loading = {
            _overlay: null,

            init() {
                if (!this._overlay) {
                    this._overlay = DOM.create('div', {
                        className: 'loading-overlay',
                        style: {
                            position: 'fixed',
                            inset: '0',
                            background: 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(4px)',
                            zIndex: '9998',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: '16px'
                        }
                    });
                    this._overlay.innerHTML = `
                        <div style="width: 44px; height: 44px; border: 3px solid #e2e8f0; border-top-color: #d45c2f; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
                        <div style="font-size: 0.9rem; color: #5a6b7c; font-weight: 500;">Loading...</div>
                    `;
                    document.body.appendChild(this._overlay);
                }
            },

            show: (msg = 'Loading...') => {
                this.init();
                const textEl = this._overlay.querySelector('div:last-child');
                if (textEl) textEl.textContent = msg;
                this._overlay.style.display = 'flex';
            },

            hide: () => { if (this._overlay) this._overlay.style.display = 'none'; },

            showOn: (el) => {
                const e = typeof el === 'string' ? DOM.qs(el) : el;
                if (e) {
                    e.disabled = true;
                    e.classList.add('loading');
                    e.dataset.originalText = e.innerHTML;
                    e.innerHTML = '<span class="spinner"></span> Loading...';
                }
            },

            hideOn: (el) => {
                const e = typeof el === 'string' ? DOM.qs(el) : el;
                if (e) {
                    e.disabled = false;
                    e.classList.remove('loading');
                    if (e.dataset.originalText) e.innerHTML = e.dataset.originalText;
                }
            }
        };

        // ============================================================
        //  CONFIRMATION DIALOG
        // ============================================================
        const Confirm = {
            _modal: null,
            _resolve: null,

            init() {
                if (!this._modal) {
                    this._modal = DOM.create('div', {
                        className: 'confirm-modal',
                        style: {
                            position: 'fixed',
                            inset: '0',
                            background: 'rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(4px)',
                            zIndex: '10000',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    });

                    const dialog = DOM.create('div', {
                        style: {
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '420px',
                            width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                            textAlign: 'center'
                        }
                    });

                    dialog.innerHTML = `
                        <div style="font-size: 2.5rem; color: #f59e0b; margin-bottom: 16px;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 8px; color: #0a1e2e;">Confirm Action</h3>
                        <p style="color: #5a6b7c; margin-bottom: 24px; font-size: 0.95rem;" id="confirmMessage">Are you sure?</p>
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button id="confirmCancel" style="padding: 10px 28px; border-radius: 9999px; border: 1px solid #e2e8f0; background: transparent; font-weight: 600; cursor: pointer; color: #5a6b7c;">Cancel</button>
                            <button id="confirmOk" style="padding: 10px 28px; border-radius: 9999px; border: none; background: #d45c2f; color: white; font-weight: 600; cursor: pointer;">Confirm</button>
                        </div>
                    `;

                    this._modal.appendChild(dialog);
                    document.body.appendChild(this._modal);

                    const cancelBtn = dialog.querySelector('#confirmCancel');
                    const okBtn = dialog.querySelector('#confirmOk');

                    cancelBtn.addEventListener('click', () => this._resolve(false));
                    okBtn.addEventListener('click', () => this._resolve(true));
                    this._modal.addEventListener('click', (e) => {
                        if (e.target === this._modal) this._resolve(false);
                    });
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && this._modal.style.display === 'flex') this._resolve(false);
                        if (e.key === 'Enter' && this._modal.style.display === 'flex') this._resolve(true);
                    });
                }
            },

            show: (message, confirmText = 'Confirm', cancelText = 'Cancel') => {
                this.init();
                const msgEl = this._modal.querySelector('#confirmMessage');
                const okBtn = this._modal.querySelector('#confirmOk');
                const cancelBtn = this._modal.querySelector('#confirmCancel');
                if (msgEl) msgEl.textContent = message;
                if (okBtn) okBtn.textContent = confirmText;
                if (cancelBtn) cancelBtn.textContent = cancelText;
                this._modal.style.display = 'flex';
                return new Promise((resolve) => { this._resolve = resolve; });
            },

            _resolve: function(result) {
                this._modal.style.display = 'none';
                if (this._resolve) { this._resolve(result); }
            }
        };

        // ============================================================
        //  PAGE DETECTION
        // ============================================================
        function getCurrentPage() {
            const path = window.location.pathname;
            const filename = path.split('/').pop().replace('.html', '');
            const pageMap = {
                'admin': 'dashboard',
                'admin-dashboard': 'dashboard',
                'admin-products': 'products',
                'admin-categories': 'categories',
                'admin-orders': 'orders',
                'admin-customers': 'customers',
                'admin-inventory': 'inventory',
                'admin-homepage': 'homepage',
                'admin-offers': 'offers',
                'admin-blogs': 'blogs',
                'admin-crm': 'crm',
                'admin-franchise': 'franchise',
                'admin-cloud-kitchen': 'cloudKitchen',
                'admin-users': 'users',
                'admin-notifications': 'notifications',
                'admin-settings': 'settings',
                'admin-reports': 'reports',
                'admin-support': 'support'
            };
            return pageMap[filename] || 'dashboard';
        }

        const currentPage = getCurrentPage();

        // ============================================================
        //  STYLES INJECTION
        // ============================================================
        function injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideOutRight {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(40px); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .toast { pointer-events: auto; }
                .loading-overlay .spinner {
                    width: 44px;
                    height: 44px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #d45c2f;
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite;
                }
                .admin-nav-link.active {
                    background: #eef2ff;
                    color: #0f2b45;
                    border-left: 3px solid #d45c2f;
                }
                .table-row-enter {
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .status-badge {
                    display: inline-block;
                    padding: 2px 10px;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }
                .status-badge.active { background: #dcfce7; color: #166534; }
                .status-badge.pending { background: #fef3c7; color: #92400e; }
                .status-badge.inactive { background: #fee2e2; color: #991b1b; }
                .status-badge.delivered { background: #dcfce7; color: #166534; }
                .status-badge.cancelled { background: #fee2e2; color: #991b1b; }
                .status-badge.processing { background: #dbeafe; color: #1e40af; }
                .status-badge.shipped { background: #c7d2fe; color: #3730a3; }
            `;
            document.head.appendChild(style);
        }

        // ============================================================
        //  DASHBOARD CONTROLLER
        // ============================================================
        const DashboardController = {
            _listeners: [],

            async init() {
                await this.loadSummary();
                await this.loadCharts();
                await this.loadRecentData();

                // Realtime dashboard updates
                const unsub = dashboard.listen((summary) => {
                    this._updateUI(summary);
                });
                this._listeners.push(unsub);

                // Realtime notification badge
                this._setupNotificationBadge();

                // Auto-refresh every 30 seconds
                setInterval(() => {
                    this.loadSummary();
                    this.loadCharts();
                }, 30000);

                console.log('Dashboard initialized');
            },

            async loadSummary() {
                try {
                    Loading.show('Loading dashboard...');
                    const summary = await dashboard.getSummary();
                    this._updateUI(summary);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load dashboard: ' + error.message);
                }
            },

            _updateUI(summary) {
                const stats = {
                    'totalProducts': summary.totalProducts,
                    'totalCustomers': summary.totalCustomers,
                    'totalOrders': summary.totalOrders,
                    'pendingOrders': summary.pendingOrders,
                    'deliveredOrders': summary.deliveredOrders,
                    'cancelledOrders': summary.cancelledOrders,
                    'inventoryCount': summary.inventoryCount,
                    'lowStock': summary.lowStock
                };
                Object.entries(stats).forEach(([key, value]) => {
                    const el = DOM.qs(`[data-stat="${key}"]`);
                    if (el) el.textContent = value;
                });

                // Low stock items
                const container = DOM.qs('#lowStockItems');
                if (container) {
                    DOM.empty(container);
                    const items = summary.lowStockItems || [];
                    if (items.length === 0) {
                        container.innerHTML = '<p style="color: #94a3b8; padding: 8px;">No low stock items</p>';
                    } else {
                        items.slice(0, 10).forEach(item => {
                            const el = DOM.create('div', {
                                style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ecf0;font-size:0.85rem;'
                            });
                            el.innerHTML = `<span>${item.name || 'Unknown'}</span><span style="color:#ef4444;font-weight:600;">${item.stock || 0}</span>`;
                            container.appendChild(el);
                        });
                    }
                }
            },

            async loadCharts() {
                try {
                    const [salesData, orderStatus, customerGrowth] = await Promise.all([
                        analytics.getSalesChart(30),
                        analytics.getOrderStatus(),
                        analytics.getCustomerGrowth(30)
                    ]);

                    this._renderSalesChart(salesData);
                    this._renderOrderStatusChart(orderStatus);
                    this._renderCustomerGrowthChart(customerGrowth);
                } catch (error) {
                    console.error('Chart loading error:', error);
                }
            },

            _renderSalesChart(data) {
                const container = DOM.qs('#salesChart');
                if (!container) return;
                const max = Math.max(...data.map(d => d.revenue || 0), 1);
                DOM.empty(container);
                container.style.cssText = 'display:flex;align-items:flex-end;height:200px;gap:4px;padding:8px 0;';
                data.slice(-30).forEach((d, i) => {
                    const val = d.revenue || 0;
                    const bar = DOM.create('div', {
                        style: {
                            flex: '1',
                            height: `${(val / max) * 100}%`,
                            minHeight: '4px',
                            background: i % 2 === 0 ? '#d45c2f' : '#0f2b45',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                            position: 'relative'
                        },
                        title: `${d.date}: ₹${val}`
                    });
                    container.appendChild(bar);
                });
            },

            _renderOrderStatusChart(data) {
                const container = DOM.qs('#orderStatusChart');
                if (!container) return;
                const total = Object.values(data).reduce((a, b) => a + b, 0);
                const colors = { pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6', shipped: '#06b6d4', delivered: '#22c55e', cancelled: '#ef4444' };
                DOM.empty(container);
                Object.entries(data).forEach(([status, count]) => {
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    const item = DOM.create('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;' });
                    item.innerHTML = `
                        <span style="width:100px;font-size:0.8rem;color:#5a6b7c;">${status}</span>
                        <div style="flex:1;height:8px;background:#e2e8f0;border-radius:10px;overflow:hidden;">
                            <div style="width:${percent}%;height:100%;background:${colors[status] || '#94a3b8'};border-radius:10px;transition:width 0.5s ease;"></div>
                        </div>
                        <span style="font-size:0.8rem;font-weight:600;min-width:40px;text-align:right;">${count}</span>
                    `;
                    container.appendChild(item);
                });
            },

            _renderCustomerGrowthChart(data) {
                const container = DOM.qs('#customerGrowthChart');
                if (!container) return;
                const max = Math.max(...data.map(d => d.total || 0), 1);
                DOM.empty(container);
                container.style.cssText = 'display:flex;align-items:flex-end;height:150px;gap:4px;padding:8px 0;';
                data.slice(-30).forEach((d) => {
                    const val = d.total || 0;
                    const bar = DOM.create('div', {
                        style: {
                            flex: '1',
                            height: `${(val / max) * 100}%`,
                            minHeight: '4px',
                            background: '#22c55e',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease'
                        },
                        title: `${d.date}: ${val} customers`
                    });
                    container.appendChild(bar);
                });
            },

            async loadRecentData() {
                try {
                    const [orders, customers] = await Promise.all([
                        dashboard.getRecentOrders(5),
                        dashboard.getRecentCustomers(5)
                    ]);
                    this._renderRecentOrders(orders);
                    this._renderRecentCustomers(customers);
                } catch (error) {
                    console.error('Recent data loading error:', error);
                }
            },

            _renderRecentOrders(orders) {
                const container = DOM.qs('#recentOrders');
                if (!container) return;
                DOM.empty(container);
                if (orders.length === 0) {
                    container.innerHTML = '<p style="color:#94a3b8;padding:12px;">No recent orders</p>';
                    return;
                }
                const statusColors = { pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6', shipped: '#06b6d4', delivered: '#22c55e', cancelled: '#ef4444' };
                orders.forEach(order => {
                    const el = DOM.create('div', { style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ecf0;font-size:0.85rem;' });
                    el.innerHTML = `
                        <span><strong>${order.id || 'Unknown'}</strong></span>
                        <span style="color:#5a6b7c;">₹${order.grandTotal || 0}</span>
                        <span style="color:${statusColors[order.status] || '#94a3b8'};font-weight:600;">${order.status || 'pending'}</span>
                    `;
                    container.appendChild(el);
                });
            },

            _renderRecentCustomers(customers) {
                const container = DOM.qs('#recentCustomers');
                if (!container) return;
                DOM.empty(container);
                if (customers.length === 0) {
                    container.innerHTML = '<p style="color:#94a3b8;padding:12px;">No recent customers</p>';
                    return;
                }
                customers.forEach(customer => {
                    const el = DOM.create('div', { style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ecf0;font-size:0.85rem;' });
                    el.innerHTML = `
                        <span><strong>${customer.name || 'Unknown'}</strong></span>
                        <span style="color:#5a6b7c;">${customer.email || ''}</span>
                        <span style="color:#5a6b7c;font-size:0.75rem;">${utils.formatDate(customer._createdAt)}</span>
                    `;
                    container.appendChild(el);
                });
            },

            async _setupNotificationBadge() {
                try {
                    const user = auth.currentUser;
                    if (user) {
                        const count = await notifications.getUnreadCount(user.uid);
                        const badge = DOM.qs('#notificationBadge');
                        if (badge) {
                            badge.textContent = count > 0 ? count : '';
                            badge.style.display = count > 0 ? 'inline' : 'none';
                        }
                        // Listen for new notifications
                        notifications.listen((notifs) => {
                            const unread = notifs.filter(n => !n.read).length;
                            if (badge) {
                                badge.textContent = unread > 0 ? unread : '';
                                badge.style.display = unread > 0 ? 'inline' : 'none';
                            }
                        }, { where: [{ field: 'userId', operator: '==', value: user.uid }] });
                    }
                } catch (error) {
                    console.error('Notification badge setup error:', error);
                }
            },

            destroy() {
                this._listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
                this._listeners = [];
            }
        };

        // ============================================================
        //  PRODUCTS CONTROLLER
        // ============================================================
        const ProductsController = {
            _listeners: [],
            _currentPage: 1,
            _pageSize: 20,
            _filters: {},

            async init() {
                await this.loadProducts();

                const unsub = products.listen((data) => {
                    this._renderProducts(data);
                });
                this._listeners.push(unsub);

                this._setupFilters();
                this._setupSearch();
                this._setupPagination();
                this._setupBulkActions();

                console.log('Products controller initialized');
            },

            async loadProducts() {
                try {
                    Loading.show('Loading products...');
                    const options = { page: this._currentPage, perPage: this._pageSize, ...this._filters };
                    const result = await products.search('', options);
                    this._renderProducts(result.items || result);
                    this._renderPagination(result);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load products: ' + error.message);
                }
            },

            _renderProducts(data) {
                const container = DOM.qs('#productList');
                if (!container) return;
                const items = data.items || data || [];
                DOM.empty(container);
                if (items.length === 0) {
                    container.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-box" style="font-size:2rem;display:block;margin-bottom:12px;"></i><p>No products found</p></div>`;
                    return;
                }
                items.forEach((product, index) => {
                    const row = DOM.create('div', {
                        className: 'table-row-enter',
                        style: 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e8ecf0;background:white;'
                    });
                    row.innerHTML = `
                        <div style="display:flex;align-items:center;gap:12px;flex:1;">
                            <input type="checkbox" class="product-checkbox" data-id="${product.id}" style="accent-color:#d45c2f;">
                            <img src="${product.images?.[0] || 'https://placecats.com/80/80?random=1'}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;background:#f1f5f9;">
                            <div>
                                <div style="font-weight:600;">${product.name || 'Unknown'}</div>
                                <div style="font-size:0.8rem;color:#5a6b7c;">SKU: ${product.sku || 'N/A'} • ${product.category || 'Uncategorized'}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:16px;">
                            <div style="text-align:right;">
                                <div style="font-weight:600;color:#0a1e2e;">₹${product.offerPrice || product.price || 0}</div>
                                <div style="font-size:0.75rem;color:${(product.stock || 0) > 0 ? '#22c55e' : '#ef4444'};">${(product.stock || 0) > 0 ? `Stock: ${product.stock}` : 'Out of Stock'}</div>
                            </div>
                            <div style="display:flex;gap:6px;">
                                <button class="btn-edit-product" data-id="${product.id}" style="padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:0.8rem;">Edit</button>
                                <button class="btn-delete-product" data-id="${product.id}" style="padding:4px 12px;border-radius:6px;border:1px solid #ef4444;background:#fee2e2;color:#ef4444;cursor:pointer;font-size:0.8rem;">Delete</button>
                            </div>
                        </div>
                    `;
                    container.appendChild(row);
                });

                DOM.qsa('.btn-edit-product', container).forEach(btn => {
                    btn.addEventListener('click', (e) => { e.stopPropagation(); this.editProduct(btn.dataset.id); });
                });
                DOM.qsa('.btn-delete-product', container).forEach(btn => {
                    btn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteProduct(btn.dataset.id); });
                });
            },

            _setupFilters() {
                const filters = [
                    { id: 'productCategoryFilter', field: 'category' },
                    { id: 'productStockFilter', field: 'inStock' }
                ];
                filters.forEach(({ id, field }) => {
                    const el = DOM.qs('#' + id);
                    if (el) {
                        el.addEventListener('change', () => {
                            this._filters[field] = el.value || undefined;
                            this._currentPage = 1;
                            this.loadProducts();
                        });
                    }
                });

                const priceMin = DOM.qs('#productPriceMin');
                const priceMax = DOM.qs('#productPriceMax');
                if (priceMin && priceMax) {
                    const apply = () => {
                        this._filters.minPrice = parseFloat(priceMin.value) || undefined;
                        this._filters.maxPrice = parseFloat(priceMax.value) || undefined;
                        this._currentPage = 1;
                        this.loadProducts();
                    };
                    priceMin.addEventListener('change', apply);
                    priceMax.addEventListener('change', apply);
                }
            },

            _setupSearch() {
                const searchInput = DOM.qs('#productSearch');
                if (searchInput) {
                    let timeout;
                    searchInput.addEventListener('input', () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => {
                            this._filters.term = searchInput.value || undefined;
                            this._currentPage = 1;
                            this.loadProducts();
                        }, 500);
                    });
                }
            },

            _setupPagination() {
                const prevBtn = DOM.qs('#productPrevPage');
                const nextBtn = DOM.qs('#productNextPage');
                if (prevBtn) prevBtn.addEventListener('click', () => { if (this._currentPage > 1) { this._currentPage--; this.loadProducts(); } });
                if (nextBtn) nextBtn.addEventListener('click', () => { this._currentPage++; this.loadProducts(); });
            },

            _renderPagination(result) {
                const container = DOM.qs('#productPagination');
                if (!container) return;
                const totalPages = result.totalPages || Math.ceil((result.total || 0) / this._pageSize);
                const currentPage = result.page || this._currentPage;
                DOM.empty(container);
                const prev = DOM.create('button', { style: 'padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;' }, '‹');
                prev.disabled = currentPage <= 1;
                prev.addEventListener('click', () => { if (currentPage > 1) { this._currentPage = currentPage - 1; this.loadProducts(); } });
                container.appendChild(prev);

                for (let i = 1; i <= Math.min(totalPages, 7); i++) {
                    const btn = DOM.create('button', {
                        style: `padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:${i === currentPage ? '#d45c2f' : 'white'};color:${i === currentPage ? 'white' : '#0a1e2e'};cursor:pointer;`
                    }, i);
                    btn.addEventListener('click', () => { this._currentPage = i; this.loadProducts(); });
                    container.appendChild(btn);
                }

                const next = DOM.create('button', { style: 'padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;' }, '›');
                next.disabled = currentPage >= totalPages;
                next.addEventListener('click', () => { if (currentPage < totalPages) { this._currentPage = currentPage + 1; this.loadProducts(); } });
                container.appendChild(next);
            },

            _setupBulkActions() {
                const selectAll = DOM.qs('#selectAllProducts');
                if (selectAll) {
                    selectAll.addEventListener('change', () => {
                        DOM.qsa('.product-checkbox').forEach(cb => cb.checked = selectAll.checked);
                    });
                }
                const deleteBtn = DOM.qs('#bulkDeleteProducts');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        const checked = DOM.qsa('.product-checkbox:checked');
                        if (checked.length === 0) { Toast.warning('Select products to delete'); return; }
                        const confirmed = await Confirm.show(`Delete ${checked.length} products?`, 'Delete', 'Cancel');
                        if (!confirmed) return;
                        const ids = Array.from(checked).map(cb => cb.dataset.id);
                        try {
                            Loading.show('Deleting products...');
                            await products.batch(ids.map(id => ({ id, type: 'delete' })));
                            Toast.success(`${ids.length} products deleted`);
                            this.loadProducts();
                            Loading.hide();
                        } catch (error) {
                            Loading.hide();
                            Toast.error('Failed to delete products: ' + error.message);
                        }
                    });
                }
            },

            async editProduct(id) {
                try {
                    const product = await products.get(id);
                    if (!product) { Toast.error('Product not found'); return; }
                    Toast.info('Edit product: ' + product.name);
                } catch (error) {
                    Toast.error('Failed to load product: ' + error.message);
                }
            },

            async deleteProduct(id) {
                const confirmed = await Confirm.show('Delete this product?', 'Delete', 'Cancel');
                if (!confirmed) return;
                try {
                    Loading.show('Deleting...');
                    await products.delete(id);
                    Toast.success('Product deleted');
                    this.loadProducts();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to delete: ' + error.message);
                }
            },

            destroy() {
                this._listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
                this._listeners = [];
            }
        };

        // ============================================================
        //  ORDERS CONTROLLER
        // ============================================================
        const OrdersController = {
            _listeners: [],

            async init() {
                await this.loadOrders();

                const unsub = orders.listen((data) => {
                    this._renderOrders(data);
                });
                this._listeners.push(unsub);

                const statusFilter = DOM.qs('#orderStatusFilter');
                if (statusFilter) {
                    statusFilter.addEventListener('change', () => {
                        const status = statusFilter.value;
                        if (status) {
                            orders.getByStatus(status).then(data => this._renderOrders(data));
                        } else {
                            this.loadOrders();
                        }
                    });
                }

                console.log('Orders controller initialized');
            },

            async loadOrders() {
                try {
                    Loading.show('Loading orders...');
                    const data = await orders.latest(50);
                    this._renderOrders(data);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load orders: ' + error.message);
                }
            },

            _renderOrders(data) {
                const container = DOM.qs('#orderList');
                if (!container) return;
                DOM.empty(container);
                if (data.length === 0) {
                    container.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-shopping-cart" style="font-size:2rem;display:block;margin-bottom:12px;"></i><p>No orders found</p></div>`;
                    return;
                }
                const statusColors = { pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6', shipped: '#06b6d4', delivered: '#22c55e', cancelled: '#ef4444' };
                data.forEach(order => {
                    const card = DOM.create('div', { style: 'background:white;border-radius:12px;padding:16px;border:1px solid #e8ecf0;margin-bottom:12px;' });
                    card.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                            <div><strong>${order.id || 'Unknown'}</strong> <span style="margin-left:12px;color:#5a6b7c;font-size:0.85rem;">${utils.formatDate(order._createdAt)}</span></div>
                            <span style="color:${statusColors[order.status] || '#94a3b8'};font-weight:600;padding:4px 12px;border-radius:20px;background:${statusColors[order.status] || '#f1f5f9'}20;">${order.status || 'pending'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px;">
                            <div style="font-size:0.85rem;color:#5a6b7c;">Items: ${(order.items || []).length} • Payment: ${order.paymentMethod || 'N/A'}</div>
                            <div style="font-weight:600;color:#0a1e2e;">₹${order.grandTotal || 0}</div>
                        </div>
                        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                            <button class="btn-update-order" data-id="${order.id}" data-status="confirmed" style="padding:4px 12px;border-radius:6px;border:1px solid #3b82f6;background:#dbeafe;color:#1e40af;cursor:pointer;font-size:0.8rem;">Confirm</button>
                            <button class="btn-update-order" data-id="${order.id}" data-status="shipped" style="padding:4px 12px;border-radius:6px;border:1px solid #06b6d4;background:#cffafe;color:#0e7490;cursor:pointer;font-size:0.8rem;">Ship</button>
                            <button class="btn-update-order" data-id="${order.id}" data-status="delivered" style="padding:4px 12px;border-radius:6px;border:1px solid #22c55e;background:#dcfce7;color:#166534;cursor:pointer;font-size:0.8rem;">Deliver</button>
                            <button class="btn-cancel-order" data-id="${order.id}" style="padding:4px 12px;border-radius:6px;border:1px solid #ef4444;background:#fee2e2;color:#991b1b;cursor:pointer;font-size:0.8rem;">Cancel</button>
                        </div>
                    `;
                    container.appendChild(card);
                });

                DOM.qsa('.btn-update-order', container).forEach(btn => {
                    btn.addEventListener('click', () => this.updateOrder(btn.dataset.id, btn.dataset.status));
                });
                DOM.qsa('.btn-cancel-order', container).forEach(btn => {
                    btn.addEventListener('click', () => this.cancelOrder(btn.dataset.id));
                });
            },

            async updateOrder(id, status) {
                try {
                    Loading.show('Updating...');
                    await orders.updateStatus(id, status);
                    Toast.success(`Order ${status}`);
                    this.loadOrders();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to update: ' + error.message);
                }
            },

            async cancelOrder(id) {
                const confirmed = await Confirm.show('Cancel this order?', 'Cancel', 'Keep');
                if (!confirmed) return;
                try {
                    Loading.show('Cancelling...');
                    await orders.updateStatus(id, 'cancelled');
                    Toast.success('Order cancelled');
                    this.loadOrders();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to cancel: ' + error.message);
                }
            },

            destroy() {
                this._listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
                this._listeners = [];
            }
        };

        // ============================================================
        //  CUSTOMERS CONTROLLER
        // ============================================================
        const CustomersController = {
            _listeners: [],

            async init() {
                await this.loadCustomers();

                const unsub = customers.listen((data) => {
                    this._renderCustomers(data);
                });
                this._listeners.push(unsub);

                const searchInput = DOM.qs('#customerSearch');
                if (searchInput) {
                    let timeout;
                    searchInput.addEventListener('input', () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => {
                            const term = searchInput.value.trim();
                            if (term) {
                                customers.search(term).then(data => this._renderCustomers(data));
                            } else {
                                this.loadCustomers();
                            }
                        }, 500);
                    });
                }

                console.log('Customers controller initialized');
            },

            async loadCustomers() {
                try {
                    Loading.show('Loading customers...');
                    const data = await customers.latest(50);
                    this._renderCustomers(data);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load customers: ' + error.message);
                }
            },

            _renderCustomers(data) {
                const container = DOM.qs('#customerList');
                if (!container) return;
                DOM.empty(container);
                if (data.length === 0) {
                    container.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-users" style="font-size:2rem;display:block;margin-bottom:12px;"></i><p>No customers found</p></div>`;
                    return;
                }
                data.forEach(customer => {
                    const row = DOM.create('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #e8ecf0;background:white;' });
                    row.innerHTML = `
                        <div><strong>${customer.name || 'Unknown'}</strong><div style="font-size:0.8rem;color:#5a6b7c;">${customer.email || ''} • ${customer.phone || ''}</div></div>
                        <div style="font-size:0.85rem;color:#5a6b7c;">${utils.formatDate(customer._createdAt)}</div>
                        <div style="display:flex;gap:6px;">
                            <button class="btn-view-customer" data-id="${customer.id}" style="padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:0.8rem;">View</button>
                            <button class="btn-delete-customer" data-id="${customer.id}" style="padding:4px 12px;border-radius:6px;border:1px solid #ef4444;background:#fee2e2;color:#ef4444;cursor:pointer;font-size:0.8rem;">Delete</button>
                        </div>
                    `;
                    container.appendChild(row);
                });

                DOM.qsa('.btn-view-customer', container).forEach(btn => {
                    btn.addEventListener('click', () => this.viewCustomer(btn.dataset.id));
                });
                DOM.qsa('.btn-delete-customer', container).forEach(btn => {
                    btn.addEventListener('click', () => this.deleteCustomer(btn.dataset.id));
                });
            },

            async viewCustomer(id) {
                try {
                    const customer = await customers.get(id);
                    if (!customer) { Toast.error('Customer not found'); return; }
                    const stats = await customers.getStats(id);
                    Toast.info(`${customer.name}: ${stats.totalOrders} orders, ₹${stats.totalSpent} spent`);
                } catch (error) {
                    Toast.error('Failed to load customer: ' + error.message);
                }
            },

            async deleteCustomer(id) {
                const confirmed = await Confirm.show('Delete this customer?', 'Delete', 'Cancel');
                if (!confirmed) return;
                try {
                    Loading.show('Deleting...');
                    await customers.delete(id);
                    Toast.success('Customer deleted');
                    this.loadCustomers();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to delete: ' + error.message);
                }
            },

            destroy() {
                this._listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
                this._listeners = [];
            }
        };

        // ============================================================
        //  CONTROLLER FACTORY
        // ============================================================
        function getController(page) {
            const controllers = {
                'dashboard': DashboardController,
                'products': ProductsController,
                'orders': OrdersController,
                'customers': CustomersController
            };
            return controllers[page] || DashboardController;
        }

        // ============================================================
        //  MAIN ADMIN INIT
        // ============================================================
        const Admin = {
            _controller: null,

            async init() {
                // Check auth
                if (!auth.isLoggedIn) {
                    Toast.warning('Please login to access admin panel');
                    setTimeout(() => { window.location.href = 'admin-login.html'; }, 1500);
                    return;
                }

                // Check admin role
                const isAdmin = await auth.isAdmin();
                if (!isAdmin) {
                    Toast.error('Access denied. Admin privileges required.');
                    setTimeout(() => { window.location.href = 'admin-login.html'; }, 1500);
                    return;
                }

                // Inject styles
                injectStyles();

                // Initialize controller
                const Controller = getController(currentPage);
                this._controller = new Controller();
                await this._controller.init();

                // Setup logout
                const logoutBtn = DOM.qs('#logoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        const confirmed = await Confirm.show('Logout?', 'Logout', 'Cancel');
                        if (confirmed) {
                            await auth.logout();
                            Toast.success('Logged out');
                            setTimeout(() => { window.location.href = 'admin-login.html'; }, 500);
                        }
                    });
                }

                // Setup navigation
                DOM.qsa('.admin-nav-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        const page = link.dataset.page;
                        if (page && page !== currentPage) {
                            window.location.href = `admin-${page}.html`;
                        }
                    });
                });

                // Setup notification click
                const notifBadge = DOM.qs('#notificationBadge');
                if (notifBadge) {
                    notifBadge.addEventListener('click', () => {
                        window.location.href = 'admin-notifications.html';
                    });
                }

                console.log('✅ Admin Panel initialized');
                Toast.success('Admin panel loaded', 2000);
            },

            destroy() {
                if (this._controller && this._controller.destroy) {
                    this._controller.destroy();
                }
            }
        };

        // ============================================================
        //  START ADMIN
        // ============================================================
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { Admin.init(); });
        } else {
            Admin.init();
        }

        // Expose for debugging
        window.__KFK_ADMIN = { Admin, Toast, Loading, Confirm, DOM };

        console.log('✅ Admin controller loaded');
        console.log(`📄 Current page: ${currentPage}`);

        return Admin;
    }

    // ============================================================
    //  START
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForKFK);
    } else {
        waitForKFK();
    }

})();
