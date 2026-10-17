/**
 * SafeHer API Client Wrapper
 */

const API = {
    getToken() {
        return localStorage.getItem('safeher_jwt');
    },

    setToken(token) {
        localStorage.setItem('safeher_jwt', token);
    },

    getUser() {
        const u = localStorage.getItem('safeher_user');
        return u ? JSON.parse(u) : null;
    },

    setUser(user) {
        localStorage.setItem('safeher_user', JSON.stringify(user));
    },

    logout() {
        localStorage.removeItem('safeher_jwt');
        localStorage.removeItem('safeher_user');
        window.location.href = '/auth.html';
    },

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(endpoint, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
                    this.logout();
                }
                throw new Error(data.message || data.error || 'Server request failed.');
            }

            return data;
        } catch (err) {
            this.toast(err.message, 'danger');
            throw err;
        }
    },

    toast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'danger' ? '🚨' : type === 'success' ? '✅' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};
