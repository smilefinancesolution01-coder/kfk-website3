/**
 * KFK Marketplace - Admin Panel Controller
 * Production Ready - Enterprise Grade
 * 
 * @version 1.0.0
 * @author KFK Engineering Team
 * 
 * Complete admin controller for KFK Marketplace.
 * Built on top of kfk-core.js.
 * No HTML modifications required.
 */

(function() {
    'use strict';

    // ============================================================
    //  WAIT FOR CORE
    // ============================================================
    function waitForCore(retries = 0) {
        if (window.DB && window.DB.collections) {
            initializeAdmin();
            return;
        }
        if (retries > 30) {
            console.error('[KFK Admin] Core initialization timeout');
            return;
        }
        setTimeout(() => waitForCore(retries + 1), 200);
    }

    // ============================================================
    //  ADMIN CONTROLLER
    // ============================================================
    function initializeAdmin() {
        const { DB } = window;
        const { collections, dashboard, analytics, product, storage, notification, activity, auth, utils } = DB;

        // ============================================================
        //  ADMIN STATE
        // ============================================================
        const state = {
            currentPage: 'dashboard',
            loading: false,
            cache: {},
            listeners: [],
            user: null,
            isAdmin: false
        };

        // ============================================================
        //  DOM HELPERS
        // ============================================================
        const DOM = {
            /**
             * Get element by ID
             * @param {string} id - Element ID
             * @returns {Element} DOM element
             */
            get(id) {
                return document.getElementById(id);
            },

            /**
             * Get element by selector
             * @param {string} selector - CSS selector
             * @param {Element} context - Context element
             * @returns {Element} DOM element
             */
            qs(selector, context = document) {
                return context.querySelector(selector);
            },

            /**
             * Get all elements by selector
             * @param {string} selector - CSS selector
             * @param {Element} context - Context element
             * @returns {NodeList} DOM elements
             */
            qsa(selector, context = document) {
                return context.querySelectorAll(selector);
            },

            /**
             * Create element with attributes
             * @param {string} tag - HTML tag
             * @param {Object} attrs - Attributes
             * @param {string|Element} content - Inner content
             * @returns {Element} Created element
             */
            create(tag, attrs = {}, content = '') {
                const el = document.createElement(tag);
                Object.entries(attrs).forEach(([key, value]) => {
                    if (key === 'className') {
                        el.className = value;
                    } else if (key === 'style' && typeof value === 'object') {
                        Object.assign(el.style, value);
                    } else {
                        el.setAttribute(key, value);
                    }
                });
                if (content) {
                    el.innerHTML = content;
                }
                return el;
            },

            /**
             * Show element
             * @param {Element|string} el - Element or selector
             */
            show(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.style.display = '';
            },

            /**
             * Hide element
             * @param {Element|string} el - Element or selector
             */
            hide(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.style.display = 'none';
            },

            /**
             * Toggle element visibility
             * @param {Element|string} el - Element or selector
             */
            toggle(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) {
                    element.style.display = element.style.display === 'none' ? '' : 'none';
                }
            },

            /**
             * Add class to element
             * @param {Element|string} el - Element or selector
             * @param {string} className - Class name
             */
            addClass(el, className) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.classList.add(className);
            },

            /**
             * Remove class from element
             * @param {Element|string} el - Element or selector
             * @param {string} className - Class name
             */
            removeClass(el, className) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.classList.remove(className);
            },

            /**
             * Toggle class on element
             * @param {Element|string} el - Element or selector
             * @param {string} className - Class name
             */
            toggleClass(el, className) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.classList.toggle(className);
            },

            /**
             * Set HTML content
             * @param {Element|string} el - Element or selector
             * @param {string} html - HTML content
             */
            html(el, html) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.innerHTML = html;
            },

            /**
             * Get HTML content
             * @param {Element|string} el - Element or selector
             * @returns {string} HTML content
             */
            getHtml(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                return element ? element.innerHTML : '';
            },

            /**
             * Set text content
             * @param {Element|string} el - Element or selector
             * @param {string} text - Text content
             */
            text(el, text) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.textContent = text;
            },

            /**
             * Get text content
             * @param {Element|string} el - Element or selector
             * @returns {string} Text content
             */
            getText(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                return element ? element.textContent : '';
            },

            /**
             * Set input value
             * @param {Element|string} el - Element or selector
             * @param {string} value - Input value
             */
            val(el, value) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.value = value;
            },

            /**
             * Get input value
             * @param {Element|string} el - Element or selector
             * @returns {string} Input value
             */
            getVal(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                return element ? element.value : '';
            },

            /**
             * Append child to element
             * @param {Element|string} parent - Parent element or selector
             * @param {Element|string} child - Child element or HTML
             */
            append(parent, child) {
                const p = typeof parent === 'string' ? this.qs(parent) : parent;
                if (!p) return;
                if (typeof child === 'string') {
                    p.insertAdjacentHTML('beforeend', child);
                } else {
                    p.appendChild(child);
                }
            },

            /**
             * Clear element content
             * @param {Element|string} el - Element or selector
             */
            empty(el) {
                const element = typeof el === 'string' ? this.qs(el) : el;
                if (element) element.innerHTML = '';
            },

            /**
             * Check if element exists
             * @param {string} selector - CSS selector
             * @returns {boolean} True if exists
             */
            exists(selector) {
                return !!this.qs(selector);
            }
        };

        // ============================================================
        //  TOAST SYSTEM
        // ============================================================
        const Toast = {
            _container: null,

            /**
             * Initialize toast container
             */
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
                            width: '100%'
                        }
                    });
                    document.body.appendChild(this._container);
                }
            },

            /**
             * Show toast notification
             * @param {string} message - Toast message
             * @param {string} type - Toast type (success, error, warning, info)
             * @param {number} duration - Display duration in ms
             */
            show(message, type = 'info', duration = 4000) {
                this.init();

                const colors = {
                    success: '#22c55e',
                    error: '#ef4444',
                    warning: '#f59e0b',
                    info: '#3b82f6'
                };

                const icons = {
                    success: 'fa-check-circle',
                    error: 'fa-exclamation-circle',
                    warning: 'fa-exclamation-triangle',
                    info: 'fa-info-circle'
                };

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
                        animation: 'slideInRight 0.3s ease',
                        transformOrigin: 'right'
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

                // Close button
                const closeBtn = toast.querySelector('.toast-close');
                closeBtn.addEventListener('click', () => this._remove(toast));

                // Auto remove
                setTimeout(() => {
                    if (toast.parentNode) {
                        this._remove(toast);
                    }
                }, duration);

                return toast;
            },

            /**
             * Show success toast
             * @param {string} message - Toast message
             * @param {number} duration - Display duration
             */
            success(message, duration = 4000) {
                return this.show(message, 'success', duration);
            },

            /**
             * Show error toast
             * @param {string} message - Toast message
             * @param {number} duration - Display duration
             */
            error(message, duration = 5000) {
                return this.show(message, 'error', duration);
            },

            /**
             * Show warning toast
             * @param {string} message - Toast message
             * @param {number} duration - Display duration
             */
            warning(message, duration = 4000) {
                return this.show(message, 'warning', duration);
            },

            /**
             * Show info toast
             * @param {string} message - Toast message
             * @param {number} duration - Display duration
             */
            info(message, duration = 3000) {
                return this.show(message, 'info', duration);
            },

            /**
             * Remove toast with animation
             * @param {Element} toast - Toast element
             * @private
             */
            _remove(toast) {
                toast.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            },

            /**
             * Clear all toasts
             */
            clear() {
                if (this._container) {
                    this._container.innerHTML = '';
                }
            }
        };

        // ============================================================
        //  LOADING SYSTEM
        // ============================================================
        const Loading = {
            _overlay: null,

            /**
             * Initialize loading overlay
             */
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

            /**
             * Show loading overlay
             * @param {string} message - Loading message
             */
            show(message = 'Loading...') {
                this.init();
                const textEl = this._overlay.querySelector('div:last-child');
                if (textEl) textEl.textContent = message;
                this._overlay.style.display = 'flex';
            },

            /**
             * Hide loading overlay
             */
            hide() {
                if (this._overlay) {
                    this._overlay.style.display = 'none';
                }
            },

            /**
             * Show loading on element
             * @param {Element|string} el - Element or selector
             */
            showOn(el) {
                const element = typeof el === 'string' ? DOM.qs(el) : el;
                if (element) {
                    element.disabled = true;
                    element.classList.add('loading');
                    const originalText = element.innerHTML;
                    element.dataset.originalText = originalText;
                    element.innerHTML = '<span class="spinner"></span> Loading...';
                }
            },

            /**
             * Hide loading on element
             * @param {Element|string} el - Element or selector
             */
            hideOn(el) {
                const element = typeof el === 'string' ? DOM.qs(el) : el;
                if (element) {
                    element.disabled = false;
                    element.classList.remove('loading');
                    if (element.dataset.originalText) {
                        element.innerHTML = element.dataset.originalText;
                    }
                }
            }
        };

        // ============================================================
        //  CONFIRMATION DIALOG
        // ============================================================
        const Confirm = {
            _modal: null,

            /**
             * Initialize confirmation dialog
             */
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

                    // Event handlers
                    const cancelBtn = dialog.querySelector('#confirmCancel');
                    const okBtn = dialog.querySelector('#confirmOk');

                    cancelBtn.addEventListener('click', () => this._resolve(false));
                    okBtn.addEventListener('click', () => this._resolve(true));

                    // Close on overlay click
                    this._modal.addEventListener('click', (e) => {
                        if (e.target === this._modal) this._resolve(false);
                    });

                    // Keyboard support
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && this._modal.style.display === 'flex') {
                            this._resolve(false);
                        }
                        if (e.key === 'Enter' && this._modal.style.display === 'flex') {
                            this._resolve(true);
                        }
                    });
                }
            },

            /**
             * Show confirmation dialog
             * @param {string} message - Confirmation message
             * @param {string} confirmText - Confirm button text
             * @param {string} cancelText - Cancel button text
             * @returns {Promise<boolean>} True if confirmed
             */
            show(message, confirmText = 'Confirm', cancelText = 'Cancel') {
                this.init();

                const msgEl = this._modal.querySelector('#confirmMessage');
                const okBtn = this._modal.querySelector('#confirmOk');
                const cancelBtn = this._modal.querySelector('#confirmCancel');

                if (msgEl) msgEl.textContent = message;
                if (okBtn) okBtn.textContent = confirmText;
                if (cancelBtn) cancelBtn.textContent = cancelText;

                this._modal.style.display = 'flex';

                return new Promise((resolve) => {
                    this._resolve = resolve;
                });
            },

            /**
             * Resolve the promise
             * @param {boolean} result - Result
             * @private
             */
            _resolve(result) {
                this._modal.style.display = 'none';
                if (this._resolve) {
                    this._resolve(result);
                }
            }
        };

        // ============================================================
        //  DASHBOARD CONTROLLER
        // ============================================================
        const DashboardController = {
            _listeners: [],

            /**
             * Initialize dashboard
             */
            init() {
                this.loadSummary();
                this.loadCharts();
                this.loadRecentData();

                // Realtime updates
                const unsub = dashboard.listen((summary) => {
                    this._updateUI(summary);
                });
                this._listeners.push(unsub);

                // Realtime charts
                this._setupRealtimeCharts();
            },

            /**
             * Load dashboard summary
             */
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

            /**
             * Update UI with summary data
             * @param {Object} summary - Dashboard summary
             * @private
             */
            _updateUI(summary) {
                // Update stats
                const stats = {
                    'totalProducts': summary.totalProducts,
                    'totalCustomers': summary.totalCustomers,
                    'totalOrders': summary.totalOrders,
                    'totalCategories': summary.totalCategories,
                    'pendingOrders': summary.pendingOrders,
                    'deliveredOrders': summary.deliveredOrders,
                    'cancelledOrders': summary.cancelledOrders,
                    'inventoryCount': summary.inventoryCount,
                    'lowStock': summary.lowStock
                };

                Object.entries(stats).forEach(([key, value]) => {
                    const el = DOM.qs(`[data-stat="${key}"]`);
                    if (el) {
                        el.textContent = value;
                    }
                });

                // Update low stock items
                const lowStockContainer = DOM.qs('#lowStockItems');
                if (lowStockContainer && summary.lowStockItems) {
                    DOM.empty(lowStockContainer);
                    if (summary.lowStockItems.length === 0) {
                        lowStockContainer.innerHTML = '<p style="color: #94a3b8; padding: 12px;">No low stock items</p>';
                    } else {
                        summary.lowStockItems.forEach(item => {
                            const el = DOM.create('div', {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '8px 0',
                                    borderBottom: '1px solid #e8ecf0'
                                }
                            });
                            el.innerHTML = `
                                <span>${item.name || 'Unknown'}</span>
                                <span style="color: #ef4444; font-weight: 600;">${item.stock || 0} units</span>
                            `;
                            lowStockContainer.appendChild(el);
                        });
                    }
                }
            },

            /**
             * Load charts
             */
            async loadCharts() {
                try {
                    const [salesData, orderStatus, customerGrowth] = await Promise.all([
                        analytics.getSalesChart(30),
                        analytics.getOrderStatusChart(),
                        analytics.getCustomerGrowth(30)
                    ]);

                    this._renderSalesChart(salesData);
                    this._renderOrderStatusChart(orderStatus);
                    this._renderCustomerGrowthChart(customerGrowth);
                } catch (error) {
                    console.error('Failed to load charts:', error);
                }
            },

            /**
             * Render sales chart
             * @param {Array} data - Sales data
             * @private
             */
            _renderSalesChart(data) {
                const container = DOM.qs('#salesChart');
                if (!container) return;

                const max = Math.max(...data.map(d => d.revenue || 0), 1);
                const labels = data.map(d => d.date.slice(5));
                const values = data.map(d => d.revenue || 0);

                DOM.empty(container);
                container.style.cssText = 'display: flex; align-items: flex-end; height: 200px; gap: 4px; padding: 8px 0;';

                values.forEach((val, i) => {
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
                        title: `${labels[i]}: ₹${val}`
                    });

                    const tooltip = DOM.create('div', {
                        style: {
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.8)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            whiteSpace: 'nowrap',
                            opacity: '0',
                            transition: 'opacity 0.2s ease',
                            pointerEvents: 'none'
                        }
                    });
                    tooltip.textContent = `${labels[i]}: ₹${val}`;
                    bar.appendChild(tooltip);

                    bar.addEventListener('mouseenter', () => {
                        tooltip.style.opacity = '1';
                    });
                    bar.addEventListener('mouseleave', () => {
                        tooltip.style.opacity = '0';
                    });

                    container.appendChild(bar);
                });
            },

            /**
             * Render order status chart
             * @param {Object} data - Order status data
             * @private
             */
            _renderOrderStatusChart(data) {
                const container = DOM.qs('#orderStatusChart');
                if (!container) return;

                const total = Object.values(data).reduce((a, b) => a + b, 0);
                const colors = {
                    pending: '#f59e0b',
                    confirmed: '#3b82f6',
                    processing: '#8b5cf6',
                    shipped: '#06b6d4',
                    delivered: '#22c55e',
                    cancelled: '#ef4444'
                };

                DOM.empty(container);

                Object.entries(data).forEach(([status, count]) => {
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    const item = DOM.create('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 0'
                        }
                    });

                    item.innerHTML = `
                        <span style="width: 100px; font-size: 0.8rem; color: #5a6b7c;">${status}</span>
                        <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 10px; overflow: hidden;">
                            <div style="width: ${percent}%; height: 100%; background: ${colors[status] || '#94a3b8'}; border-radius: 10px; transition: width 0.5s ease;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; min-width: 40px; text-align: right;">${count}</span>
                    `;

                    container.appendChild(item);
                });
            },

            /**
             * Render customer growth chart
             * @param {Array} data - Customer growth data
             * @private
             */
            _renderCustomerGrowthChart(data) {
                const container = DOM.qs('#customerGrowthChart');
                if (!container) return;

                const max = Math.max(...data.map(d => d.total || 0), 1);
                const labels = data.map(d => d.date.slice(5));
                const values = data.map(d => d.total || 0);

                DOM.empty(container);
                container.style.cssText = 'display: flex; align-items: flex-end; height: 150px; gap: 4px; padding: 8px 0;';

                values.forEach((val, i) => {
                    const bar = DOM.create('div', {
                        style: {
                            flex: '1',
                            height: `${(val / max) * 100}%`,
                            minHeight: '4px',
                            background: '#22c55e',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease'
                        },
                        title: `${labels[i]}: ${val} customers`
                    });
                    container.appendChild(bar);
                });
            },

            /**
             * Load recent data
             */
            async loadRecentData() {
                try {
                    const [orders, customers] = await Promise.all([
                        dashboard.getRecentOrders(5),
                        dashboard.getRecentCustomers(5)
                    ]);

                    this._renderRecentOrders(orders);
                    this._renderRecentCustomers(customers);
                } catch (error) {
                    console.error('Failed to load recent data:', error);
                }
            },

            /**
             * Render recent orders
             * @param {Array} orders - Recent orders
             * @private
             */
            _renderRecentOrders(orders) {
                const container = DOM.qs('#recentOrders');
                if (!container) return;

                DOM.empty(container);
                if (orders.length === 0) {
                    container.innerHTML = '<p style="color: #94a3b8; padding: 12px;">No recent orders</p>';
                    return;
                }

                orders.forEach(order => {
                    const el = DOM.create('div', {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #e8ecf0',
                            fontSize: '0.85rem'
                        }
                    });

                    const statusColors = {
                        pending: '#f59e0b',
                        confirmed: '#3b82f6',
                        processing: '#8b5cf6',
                        shipped: '#06b6d4',
                        delivered: '#22c55e',
                        cancelled: '#ef4444'
                    };

                    el.innerHTML = `
                        <span><strong>${order.id || 'Unknown'}</strong></span>
                        <span style="color: #5a6b7c;">₹${order.grandTotal || 0}</span>
                        <span style="color: ${statusColors[order.status] || '#94a3b8'}; font-weight: 600;">${order.status || 'pending'}</span>
                    `;

                    container.appendChild(el);
                });
            },

            /**
             * Render recent customers
             * @param {Array} customers - Recent customers
             * @private
             */
            _renderRecentCustomers(customers) {
                const container = DOM.qs('#recentCustomers');
                if (!container) return;

                DOM.empty(container);
                if (customers.length === 0) {
                    container.innerHTML = '<p style="color: #94a3b8; padding: 12px;">No recent customers</p>';
                    return;
                }

                customers.forEach(customer => {
                    const el = DOM.create('div', {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #e8ecf0',
                            fontSize: '0.85rem'
                        }
                    });

                    el.innerHTML = `
                        <span><strong>${customer.name || 'Unknown'}</strong></span>
                        <span style="color: #5a6b7c;">${customer.email || ''}</span>
                        <span style="color: #5a6b7c;">${utils.formatDate(customer._createdAt)}</span>
                    `;

                    container.appendChild(el);
                });
            },

            /**
             * Setup realtime charts
             * @private
             */
            _setupRealtimeCharts() {
                // Refresh charts every 30 seconds
                setInterval(() => {
                    this.loadCharts();
                }, 30000);
            },

            /**
             * Cleanup listeners
             */
            destroy() {
                this._listeners.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                this._listeners = [];
            }
        };

        // ============================================================
        //  PRODUCT CONTROLLER
        // ============================================================
        const ProductController = {
            _listeners: [],
            _currentPage: 1,
            _pageSize: 20,
            _filters: {},

            /**
             * Initialize product management
             */
            init() {
                this.loadProducts();

                // Realtime updates
                const unsub = collections.products.listen((products) => {
                    this._renderProducts(products);
                });
                this._listeners.push(unsub);

                // Setup filters
                this._setupFilters();
                this._setupSearch();
                this._setupPagination();
            },

            /**
             * Load products with filters
             */
            async loadProducts() {
                try {
                    Loading.show('Loading products...');
                    const options = {
                        page: this._currentPage,
                        perPage: this._pageSize,
                        ...this._filters
                    };
                    const result = await product.search(options);
                    this._renderProducts(result);
                    this._renderPagination(result);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load products: ' + error.message);
                }
            },

            /**
             * Render products
             * @param {Array|Object} data - Products or search result
             * @private
             */
            _renderProducts(data) {
                const container = DOM.qs('#productList');
                if (!container) return;

                const products = data.items || data;
                DOM.empty(container);

                if (products.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-box" style="font-size: 2rem; display: block; margin-bottom: 12px;"></i>
                            <p>No products found</p>
                        </div>
                    `;
                    return;
                }

                products.forEach(product => {
                    const card = DOM.create('div', {
                        className: 'product-card',
                        style: {
                            background: 'white',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #e8ecf0',
                            marginBottom: '12px',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center'
                        }
                    });

                    card.innerHTML = `
                        <img src="${product.images?.[0] || 'https://via.placeholder.com/80'}" 
                             alt="${product.name}" 
                             style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; background: #f1f5f9;">
                        <div style="flex: 1;">
                            <h4 style="font-weight: 600; margin-bottom: 4px;">${product.name}</h4>
                            <div style="font-size: 0.85rem; color: #5a6b7c;">
                                <span>SKU: ${product.sku || 'N/A'}</span>
                                <span style="margin: 0 8px;">•</span>
                                <span>Category: ${product.category || 'Uncategorized'}</span>
                            </div>
                            <div style="display: flex; gap: 12px; margin-top: 4px; font-size: 0.85rem;">
                                <span style="font-weight: 600; color: #0a1e2e;">₹${product.offerPrice || product.price}</span>
                                ${product.offerPrice ? `<span style="text-decoration: line-through; color: #94a3b8;">₹${product.price}</span>` : ''}
                                <span style="color: ${(product.stock || 0) > 0 ? '#22c55e' : '#ef4444'};">
                                    ${(product.stock || 0) > 0 ? `Stock: ${product.stock}` : 'Out of Stock'}
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-edit-product" data-id="${product.id}" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer;">Edit</button>
                            <button class="btn-delete-product" data-id="${product.id}" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fee2e2; color: #ef4444; cursor: pointer;">Delete</button>
                        </div>
                    `;

                    container.appendChild(card);
                });

                // Event handlers
                DOM.qsa('.btn-edit-product', container).forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.editProduct(btn.dataset.id);
                    });
                });

                DOM.qsa('.btn-delete-product', container).forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteProduct(btn.dataset.id);
                    });
                });
            },

            /**
             * Setup filters
             * @private
             */
            _setupFilters() {
                // Category filter
                const categoryFilter = DOM.qs('#productCategoryFilter');
                if (categoryFilter) {
                    categoryFilter.addEventListener('change', () => {
                        this._filters.category = categoryFilter.value || undefined;
                        this._currentPage = 1;
                        this.loadProducts();
                    });
                }

                // Stock filter
                const stockFilter = DOM.qs('#productStockFilter');
                if (stockFilter) {
                    stockFilter.addEventListener('change', () => {
                        this._filters.inStock = stockFilter.value === 'in-stock';
                        this._filters.outOfStock = stockFilter.value === 'out-of-stock';
                        this._currentPage = 1;
                        this.loadProducts();
                    });
                }

                // Price range
                const priceMin = DOM.qs('#productPriceMin');
                const priceMax = DOM.qs('#productPriceMax');
                if (priceMin && priceMax) {
                    const applyPrice = () => {
                        this._filters.minPrice = parseFloat(priceMin.value) || undefined;
                        this._filters.maxPrice = parseFloat(priceMax.value) || undefined;
                        this._currentPage = 1;
                        this.loadProducts();
                    };
                    priceMin.addEventListener('change', applyPrice);
                    priceMax.addEventListener('change', applyPrice);
                }
            },

            /**
             * Setup search
             * @private
             */
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

            /**
             * Setup pagination
             * @private
             */
            _setupPagination() {
                const prevBtn = DOM.qs('#productPrevPage');
                const nextBtn = DOM.qs('#productNextPage');

                if (prevBtn) {
                    prevBtn.addEventListener('click', () => {
                        if (this._currentPage > 1) {
                            this._currentPage--;
                            this.loadProducts();
                        }
                    });
                }

                if (nextBtn) {
                    nextBtn.addEventListener('click', () => {
                        this._currentPage++;
                        this.loadProducts();
                    });
                }
            },

            /**
             * Render pagination
             * @param {Object} result - Search result
             * @private
             */
            _renderPagination(result) {
                const container = DOM.qs('#productPagination');
                if (!container) return;

                const totalPages = result.totalPages || Math.ceil((result.total || 0) / this._pageSize);
                const currentPage = result.page || this._currentPage;

                DOM.empty(container);

                // Prev button
                const prevBtn = DOM.create('button', {
                    style: 'padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer;'
                }, '‹');
                prevBtn.disabled = currentPage <= 1;
                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        this._currentPage = currentPage - 1;
                        this.loadProducts();
                    }
                });
                container.appendChild(prevBtn);

                // Page numbers
                for (let i = 1; i <= Math.min(totalPages, 7); i++) {
                    const btn = DOM.create('button', {
                        style: `padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: ${i === currentPage ? '#d45c2f' : 'white'}; color: ${i === currentPage ? 'white' : '#0a1e2e'}; cursor: pointer;`
                    }, i);
                    btn.addEventListener('click', () => {
                        this._currentPage = i;
                        this.loadProducts();
                    });
                    container.appendChild(btn);
                }

                // Next button
                const nextBtn = DOM.create('button', {
                    style: 'padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer;'
                }, '›');
                nextBtn.disabled = currentPage >= totalPages;
                nextBtn.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        this._currentPage = currentPage + 1;
                        this.loadProducts();
                    }
                });
                container.appendChild(nextBtn);
            },

            /**
             * Add new product
             * @param {Object} data - Product data
             */
            async addProduct(data) {
                try {
                    Loading.show('Adding product...');
                    const result = await collections.products.add(data);
                    Toast.success('Product added successfully');
                    Loading.hide();
                    return result;
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to add product: ' + error.message);
                    throw error;
                }
            },

            /**
             * Edit product
             * @param {string} id - Product ID
             */
            async editProduct(id) {
                try {
                    const product = await collections.products.get(id);
                    if (!product) {
                        Toast.error('Product not found');
                        return;
                    }
                    // Open edit modal - to be implemented by UI
                    Toast.info('Edit product: ' + product.name);
                } catch (error) {
                    Toast.error('Failed to load product: ' + error.message);
                }
            },

            /**
             * Delete product
             * @param {string} id - Product ID
             */
            async deleteProduct(id) {
                const confirmed = await Confirm.show('Are you sure you want to delete this product?', 'Delete', 'Cancel');
                if (!confirmed) return;

                try {
                    Loading.show('Deleting product...');
                    await collections.products.delete(id);
                    Toast.success('Product deleted successfully');
                    this.loadProducts();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to delete product: ' + error.message);
                }
            },

            /**
             * Upload product image
             * @param {string} productId - Product ID
             * @param {File} file - Image file
             */
            async uploadImage(productId, file) {
                try {
                    Loading.show('Uploading image...');
                    const url = await storage.uploadProductImage(productId, file);
                    const product = await collections.products.get(productId);
                    const images = product.images || [];
                    images.push(url);
                    await collections.products.update(productId, { images });
                    Toast.success('Image uploaded successfully');
                    Loading.hide();
                    return url;
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to upload image: ' + error.message);
                    throw error;
                }
            },

            /**
             * Cleanup listeners
             */
            destroy() {
                this._listeners.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                this._listeners = [];
            }
        };

        // ============================================================
        //  ORDER CONTROLLER
        // ============================================================
        const OrderController = {
            _listeners: [],

            /**
             * Initialize order management
             */
            init() {
                this.loadOrders();

                // Realtime updates
                const unsub = collections.orders.listen((orders) => {
                    this._renderOrders(orders);
                });
                this._listeners.push(unsub);

                // Setup filters
                this._setupFilters();
            },

            /**
             * Load orders
             */
            async loadOrders() {
                try {
                    Loading.show('Loading orders...');
                    const orders = await collections.orders.latest(50);
                    this._renderOrders(orders);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load orders: ' + error.message);
                }
            },

            /**
             * Render orders
             * @param {Array} orders - Orders
             * @private
             */
            _renderOrders(orders) {
                const container = DOM.qs('#orderList');
                if (!container) return;

                DOM.empty(container);

                if (orders.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-shopping-cart" style="font-size: 2rem; display: block; margin-bottom: 12px;"></i>
                            <p>No orders found</p>
                        </div>
                    `;
                    return;
                }

                const statusColors = {
                    pending: '#f59e0b',
                    confirmed: '#3b82f6',
                    processing: '#8b5cf6',
                    shipped: '#06b6d4',
                    delivered: '#22c55e',
                    cancelled: '#ef4444'
                };

                orders.forEach(order => {
                    const card = DOM.create('div', {
                        style: {
                            background: 'white',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #e8ecf0',
                            marginBottom: '12px'
                        }
                    });

                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <div>
                                <strong>${order.id || 'Unknown'}</strong>
                                <span style="margin-left: 12px; color: #5a6b7c; font-size: 0.85rem;">${utils.formatDate(order._createdAt)}</span>
                            </div>
                            <span style="color: ${statusColors[order.status] || '#94a3b8'}; font-weight: 600; padding: 4px 12px; border-radius: 20px; background: ${statusColors[order.status] || '#f1f5f9'}20;">${order.status || 'pending'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 8px; flex-wrap: wrap; gap: 8px;">
                            <div style="font-size: 0.85rem; color: #5a6b7c;">
                                <span>Items: ${(order.items || []).length}</span>
                                <span style="margin: 0 8px;">•</span>
                                <span>Payment: ${order.paymentMethod || 'N/A'}</span>
                            </div>
                            <div style="font-weight: 600; color: #0a1e2e;">
                                ₹${order.grandTotal || 0}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button class="btn-view-order" data-id="${order.id}" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 0.8rem;">View</button>
                            <button class="btn-update-order" data-id="${order.id}" data-status="confirmed" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #3b82f6; background: #dbeafe; color: #1e40af; cursor: pointer; font-size: 0.8rem;">Confirm</button>
                            <button class="btn-update-order" data-id="${order.id}" data-status="shipped" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #06b6d4; background: #cffafe; color: #0e7490; cursor: pointer; font-size: 0.8rem;">Ship</button>
                            <button class="btn-update-order" data-id="${order.id}" data-status="delivered" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #22c55e; background: #dcfce7; color: #166534; cursor: pointer; font-size: 0.8rem;">Deliver</button>
                            <button class="btn-cancel-order" data-id="${order.id}" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #ef4444; background: #fee2e2; color: #991b1b; cursor: pointer; font-size: 0.8rem;">Cancel</button>
                        </div>
                    `;

                    container.appendChild(card);
                });

                // Event handlers
                DOM.qsa('.btn-view-order', container).forEach(btn => {
                    btn.addEventListener('click', () => this.viewOrder(btn.dataset.id));
                });

                DOM.qsa('.btn-update-order', container).forEach(btn => {
                    btn.addEventListener('click', () => this.updateOrder(btn.dataset.id, btn.dataset.status));
                });

                DOM.qsa('.btn-cancel-order', container).forEach(btn => {
                    btn.addEventListener('click', () => this.cancelOrder(btn.dataset.id));
                });
            },

            /**
             * Setup filters
             * @private
             */
            _setupFilters() {
                const statusFilter = DOM.qs('#orderStatusFilter');
                if (statusFilter) {
                    statusFilter.addEventListener('change', () => {
                        const status = statusFilter.value;
                        if (status) {
                            collections.orders.where('status', '==', status).exec().then(orders => {
                                this._renderOrders(orders);
                            });
                        } else {
                            this.loadOrders();
                        }
                    });
                }
            },

            /**
             * View order details
             * @param {string} id - Order ID
             */
            async viewOrder(id) {
                try {
                    const order = await collections.orders.get(id);
                    if (!order) {
                        Toast.error('Order not found');
                        return;
                    }
                    Toast.info('Order details: ' + order.id);
                } catch (error) {
                    Toast.error('Failed to load order: ' + error.message);
                }
            },

            /**
             * Update order status
             * @param {string} id - Order ID
             * @param {string} status - New status
             */
            async updateOrder(id, status) {
                try {
                    Loading.show('Updating order...');
                    await collections.orders.update(id, { status });
                    Toast.success(`Order status updated to ${status}`);
                    this.loadOrders();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to update order: ' + error.message);
                }
            },

            /**
             * Cancel order
             * @param {string} id - Order ID
             */
            async cancelOrder(id) {
                const confirmed = await Confirm.show('Are you sure you want to cancel this order?', 'Cancel Order', 'Keep Order');
                if (!confirmed) return;

                try {
                    Loading.show('Cancelling order...');
                    await collections.orders.update(id, { status: 'cancelled' });
                    Toast.success('Order cancelled successfully');
                    this.loadOrders();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to cancel order: ' + error.message);
                }
            },

            /**
             * Cleanup listeners
             */
            destroy() {
                this._listeners.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                this._listeners = [];
            }
        };

        // ============================================================
        //  CUSTOMER CONTROLLER
        // ============================================================
        const CustomerController = {
            _listeners: [],

            /**
             * Initialize customer management
             */
            init() {
                this.loadCustomers();

                // Realtime updates
                const unsub = collections.customers.listen((customers) => {
                    this._renderCustomers(customers);
                });
                this._listeners.push(unsub);

                // Setup search
                this._setupSearch();
            },

            /**
             * Load customers
             */
            async loadCustomers() {
                try {
                    Loading.show('Loading customers...');
                    const customers = await collections.customers.latest(50);
                    this._renderCustomers(customers);
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to load customers: ' + error.message);
                }
            },

            /**
             * Render customers
             * @param {Array} customers - Customers
             * @private
             */
            _renderCustomers(customers) {
                const container = DOM.qs('#customerList');
                if (!container) return;

                DOM.empty(container);

                if (customers.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-users" style="font-size: 2rem; display: block; margin-bottom: 12px;"></i>
                            <p>No customers found</p>
                        </div>
                    `;
                    return;
                }

                customers.forEach(customer => {
                    const card = DOM.create('div', {
                        style: {
                            background: 'white',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            border: '1px solid #e8ecf0',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                        }
                    });

                    card.innerHTML = `
                        <div>
                            <strong>${customer.name || 'Unknown'}</strong>
                            <div style="font-size: 0.8rem; color: #5a6b7c;">${customer.email || ''} • ${customer.phone || ''}</div>
                        </div>
                        <div style="font-size: 0.85rem; color: #5a6b7c;">
                            Joined: ${utils.formatDate(customer._createdAt)}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-view-customer" data-id="${customer.id}" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 0.8rem;">View</button>
                            <button class="btn-delete-customer" data-id="${customer.id}" style="padding: 4px 12px; border-radius: 8px; border: 1px solid #ef4444; background: #fee2e2; color: #991b1b; cursor: pointer; font-size: 0.8rem;">Delete</button>
                        </div>
                    `;

                    container.appendChild(card);
                });

                // Event handlers
                DOM.qsa('.btn-view-customer', container).forEach(btn => {
                    btn.addEventListener('click', () => this.viewCustomer(btn.dataset.id));
                });

                DOM.qsa('.btn-delete-customer', container).forEach(btn => {
                    btn.addEventListener('click', () => this.deleteCustomer(btn.dataset.id));
                });
            },

            /**
             * Setup search
             * @private
             */
            _setupSearch() {
                const searchInput = DOM.qs('#customerSearch');
                if (searchInput) {
                    let timeout;
                    searchInput.addEventListener('input', () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => {
                            const term = searchInput.value.trim();
                            if (term) {
                                collections.customers.search('name', term).exec().then(results => {
                                    this._renderCustomers(results);
                                });
                            } else {
                                this.loadCustomers();
                            }
                        }, 500);
                    });
                }
            },

            /**
             * View customer
             * @param {string} id - Customer ID
             */
            async viewCustomer(id) {
                try {
                    const customer = await collections.customers.get(id);
                    if (!customer) {
                        Toast.error('Customer not found');
                        return;
                    }
                    const stats = await customer.getStats(id);
                    Toast.info('Customer: ' + customer.name + ' (Orders: ' + stats.totalOrders + ')');
                } catch (error) {
                    Toast.error('Failed to load customer: ' + error.message);
                }
            },

            /**
             * Delete customer
             * @param {string} id - Customer ID
             */
            async deleteCustomer(id) {
                const confirmed = await Confirm.show('Are you sure you want to delete this customer?', 'Delete', 'Cancel');
                if (!confirmed) return;

                try {
                    Loading.show('Deleting customer...');
                    await collections.customers.delete(id);
                    Toast.success('Customer deleted successfully');
                    this.loadCustomers();
                    Loading.hide();
                } catch (error) {
                    Loading.hide();
                    Toast.error('Failed to delete customer: ' + error.message);
                }
            },

            /**
             * Cleanup listeners
             */
            destroy() {
                this._listeners.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                this._listeners = [];
            }
        };

        // ============================================================
        //  NOTIFICATION CONTROLLER
        // ============================================================
        const NotificationController = {
            _listeners: [],

            /**
             * Initialize notification management
             */
            init() {
                this.loadNotifications();

                // Realtime updates
                const unsub = collections.notifications.listen((notifications) => {
                    this._renderNotifications(notifications);
                    this._updateBadge(notifications);
                });
                this._listeners.push(unsub);
            },

            /**
             * Load notifications
             */
            async loadNotifications() {
                try {
                    const notifications = await collections.notifications.latest(50);
                    this._renderNotifications(notifications);
                    this._updateBadge(notifications);
                } catch (error) {
                    Toast.error('Failed to load notifications: ' + error.message);
                }
            },

            /**
             * Render notifications
             * @param {Array} notifications - Notifications
             * @private
             */
            _renderNotifications(notifications) {
                const container = DOM.qs('#notificationList');
                if (!container) return;

                DOM.empty(container);

                if (notifications.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-bell-slash" style="font-size: 2rem; display: block; margin-bottom: 12px;"></i>
                            <p>No notifications</p>
                        </div>
                    `;
                    return;
                }

                notifications.forEach(notif => {
                    const card = DOM.create('div', {
                        style: {
                            padding: '12px 16px',
                            borderBottom: '1px solid #e8ecf0',
                            background: notif.read ? 'white' : '#f0f7ff',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease'
                        }
                    });

                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600;">${notif.title || 'Notification'}</div>
                                <div style="font-size: 0.85rem; color: #5a6b7c;">${notif.message || ''}</div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                ${!notif.read ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: #d45c2f;"></span>` : ''}
                                <button class="btn-delete-notification" data-id="${notif.id}" style="background: none; border: none; color: #94a3b8; cursor: pointer;">×</button>
                            </div>
                        </div>
                        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">${utils.formatDate(notif._createdAt)}</div>
                    `;

                    // Mark as read on click
                    card.addEventListener('click', () => {
                        if (!notif.read) {
                            this.markRead(notif.id);
                        }
                    });

                    container.appendChild(card);
                });

                // Event handlers
                DOM.qsa('.btn-delete-notification', container).forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteNotification(btn.dataset.id);
                    });
                });
            },

            /**
             * Update notification badge
             * @param {Array} notifications - Notifications
             * @private
             */
            _updateBadge(notifications) {
                const unread = notifications.filter(n => !n.read).length;
                const badge = DOM.qs('#notificationBadge');
                if (badge) {
                    badge.textContent = unread > 0 ? unread : '';
                    badge.style.display = unread > 0 ? 'inline' : 'none';
                }
            },

            /**
             * Mark notification as read
             * @param {string} id - Notification ID
             */
            async markRead(id) {
                try {
                    await collections.notifications.update(id, { read: true });
                } catch (error) {
                    console.error('Failed to mark read:', error);
                }
            },

            /**
             * Delete notification
             * @param {string} id - Notification ID
             */
            async deleteNotification(id) {
                try {
                    await collections.notifications.delete(id);
                } catch (error) {
                    Toast.error('Failed to delete notification: ' + error.message);
                }
            },

            /**
             * Cleanup listeners
             */
            destroy() {
                this._listeners.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                this._listeners = [];
            }
        };

        // ============================================================
        //  ADMIN INIT
        // ============================================================
        const Admin = {
            _controllers: [],

            /**
             * Initialize admin panel
             */
            init() {
                // Check admin access
                this._checkAccess();

                // Initialize controllers
                this._initControllers();

                // Setup navigation
                this._setupNavigation();

                // Setup logout
                this._setupLogout();

                // Add CSS animations
                this._addStyles();

                console.log('✅ KFK Admin Panel initialized');
                Toast.success('Admin panel loaded successfully', 2000);
            },

            /**
             * Check admin access
             * @private
             */
            async _checkAccess() {
                const isAdmin = await auth.isAdmin();
                if (!isAdmin) {
                    Toast.error('Access denied. Admin privileges required.');
                    setTimeout(() => {
                        window.location.href = 'admin_login.html';
                    }, 2000);
                    return;
                }
                state.isAdmin = true;
            },

            /**
             * Initialize controllers
             * @private
             */
            _initControllers() {
                // Determine which controllers to load based on current page
                const path = window.location.pathname;
                const page = path.split('/').pop().replace('.html', '') || 'dashboard';

                // Load only the controller for the current page
                switch (page) {
                    case 'dashboard':
                        this._controllers.push(DashboardController);
                        DashboardController.init();
                        break;
                    case 'products':
                        this._controllers.push(ProductController);
                        ProductController.init();
                        break;
                    case 'orders':
                        this._controllers.push(OrderController);
                        OrderController.init();
                        break;
                    case 'customers':
                        this._controllers.push(CustomerController);
                        CustomerController.init();
                        break;
                    case 'notifications':
                        this._controllers.push(NotificationController);
                        NotificationController.init();
                        break;
                    default:
                        // Default to dashboard
                        this._controllers.push(DashboardController);
                        DashboardController.init();
                }
            },

            /**
             * Setup navigation
             * @private
             */
            _setupNavigation() {
                const navLinks = DOM.qsa('.admin-nav-link');
                navLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        const href = link.getAttribute('href');
                        if (href && href !== '#') {
                            // Allow normal navigation
                            return;
                        }
                        e.preventDefault();
                        const page = link.dataset.page;
                        if (page) {
                            this._navigateTo(page);
                        }
                    });
                });
            },

            /**
             * Navigate to page
             * @param {string} page - Page name
             * @private
             */
            _navigateTo(page) {
                // Cleanup current controllers
                this._controllers.forEach(controller => {
                    if (controller.destroy) {
                        controller.destroy();
                    }
                });
                this._controllers = [];

                // Update active nav
                DOM.qsa('.admin-nav-link').forEach(link => {
                    link.classList.toggle('active', link.dataset.page === page);
                });

                // Load new controller
                switch (page) {
                    case 'dashboard':
                        this._controllers.push(DashboardController);
                        DashboardController.init();
                        break;
                    case 'products':
                        this._controllers.push(ProductController);
                        ProductController.init();
                        break;
                    case 'orders':
                        this._controllers.push(OrderController);
                        OrderController.init();
                        break;
                    case 'customers':
                        this._controllers.push(CustomerController);
                        CustomerController.init();
                        break;
                    case 'notifications':
                        this._controllers.push(NotificationController);
                        NotificationController.init();
                        break;
                    default:
                        this._controllers.push(DashboardController);
                        DashboardController.init();
                }

                // Update URL
                if (page !== 'dashboard') {
                    history.pushState({ page }, '', `admin_${page}.html`);
                } else {
                    history.pushState({ page }, '', 'admin_dashboard.html');
                }
            },

            /**
             * Setup logout
             * @private
             */
            _setupLogout() {
                const logoutBtn = DOM.qs('#logoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        const confirmed = await Confirm.show('Are you sure you want to logout?', 'Logout', 'Cancel');
                        if (confirmed) {
                            await auth.logout();
                            Toast.success('Logged out successfully');
                            setTimeout(() => {
                                window.location.href = 'admin_login.html';
                            }, 500);
                        }
                    });
                }
            },

            /**
             * Add CSS animations
             * @private
             */
            _addStyles() {
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
                    .toast-container {
                        pointer-events: none;
                    }
                    .toast {
                        pointer-events: auto;
                    }
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
                `;
                document.head.appendChild(style);
            }
        };

        // ============================================================
        //  START ADMIN
        // ============================================================
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                Admin.init();
            });
        } else {
            Admin.init();
        }

        // ============================================================
        //  GLOBAL EXPOSURE (for debugging)
        // ============================================================
        window.__KFK_ADMIN = {
            Admin,
            DashboardController,
            ProductController,
            OrderController,
            CustomerController,
            NotificationController,
            Toast,
            Loading,
            Confirm,
            DOM,
            state
        };

        console.log('✅ KFK Admin Controller loaded');
        console.log('📦 All modules initialized');

        return Admin;
    }

    // ============================================================
    //  START ENGINE
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCore);
    } else {
        waitForCore();
    }

})();
