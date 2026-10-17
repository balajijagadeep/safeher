/**
 * SafeHer Authentication (Login & Register)
 */

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to app.html
    if (API.getToken() && API.getUser()) {
        window.location.href = '/app.html';
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await API.request('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });

                API.setToken(res.token);
                API.setUser(res.user);

                if (res.user.role === 'police' || res.user.role === 'hospital') {
                    window.location.href = '/responder.html';
                } else {
                    window.location.href = '/app.html';
                }
            } catch (err) {
                // Handled in api.js toast
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const phone = document.getElementById('reg-phone').value;
            const password = document.getElementById('reg-password').value;
            const home_city = document.getElementById('reg-city').value;
            const blood_group = document.getElementById('reg-blood').value;
            const allergies = document.getElementById('reg-allergies').value;

            try {
                const res = await API.request('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password,
                        home_city,
                        blood_group,
                        allergies
                    })
                });

                API.setToken(res.token);
                API.setUser(res.user);
                window.location.href = '/app.html';
            } catch (err) {}
        });
    }
});

function toggleAuthMode(mode) {
    if (mode === 'register') {
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('register-box').style.display = 'block';
    } else {
        document.getElementById('register-box').style.display = 'none';
        document.getElementById('login-box').style.display = 'block';
    }
}

function quickFillDemo(role) {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    passwordInput.value = 'SafeHer@123';

    if (role === 'user') {
        emailInput.value = 'user@safeher.org';
    } else if (role === 'contact') {
        emailInput.value = 'contact@safeher.org';
    } else if (role === 'police') {
        emailInput.value = 'police@safeher.org';
    } else if (role === 'hospital') {
        emailInput.value = 'hospital@safeher.org';
    }

    API.toast(`Loaded demo credentials for [${role.toUpperCase()}]. Click 'Login' to proceed.`, 'info');
}
