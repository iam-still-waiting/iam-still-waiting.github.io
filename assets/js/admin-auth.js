/**
 * FormVault — Admin Authentication
 * Handles login, session management, and route protection
 */

(function() {
    'use strict';

    // Determine which page we're on
    const isLoginPage = window.location.pathname.includes('admin/index.html') || 
                        (window.location.pathname.endsWith('/admin/') || window.location.pathname.endsWith('/admin'));
    const isDashboard = window.location.pathname.includes('dashboard.html');

    /**
     * Handle Login Page
     */
    if (isLoginPage) {
        initLoginPage();
    }

    /**
     * Handle Dashboard Authentication Guard
     */
    if (isDashboard) {
        initAuthGuard();
    }

    function initLoginPage() {
        // Check if already authenticated
        auth.onAuthStateChanged(user => {
            if (user) {
                // Already logged in, redirect to dashboard
                window.location.href = 'dashboard.html';
            }
        });

        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const togglePassword = document.getElementById('togglePassword');

        // Toggle password visibility
        if (togglePassword) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.type === 'password' ? 'text' : 'password';
                passwordInput.type = type;
                togglePassword.querySelector('svg').style.opacity = type === 'text' ? '1' : '0.5';
            });
        }

        // Handle login form submission
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = emailInput.value.trim();
                const password = passwordInput.value;

                // Validate
                let hasError = false;
                const emailError = document.getElementById('emailError');
                const passwordError = document.getElementById('passwordError');

                emailError.textContent = '';
                passwordError.textContent = '';
                emailInput.classList.remove('error');
                passwordInput.classList.remove('error');

                if (!email) {
                    emailError.textContent = 'Email is required';
                    emailInput.classList.add('error');
                    hasError = true;
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    emailError.textContent = 'Please enter a valid email';
                    emailInput.classList.add('error');
                    hasError = true;
                }

                if (!password) {
                    passwordError.textContent = 'Password is required';
                    passwordInput.classList.add('error');
                    hasError = true;
                } else if (password.length < 6) {
                    passwordError.textContent = 'Password must be at least 6 characters';
                    passwordInput.classList.add('error');
                    hasError = true;
                }

                if (hasError) return;

                // Show loading state
                setButtonLoading(loginBtn, true);

                try {
                    await auth.signInWithEmailAndPassword(email, password);
                    showToast('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 800);
                } catch (error) {
                    console.error('Login error:', error);
                    setButtonLoading(loginBtn, false);

                    let errorMsg = 'Login failed. Please try again.';
                    switch (error.code) {
                        case 'auth/user-not-found':
                            errorMsg = 'No account found with this email.';
                            emailInput.classList.add('error');
                            break;
                        case 'auth/wrong-password':
                            errorMsg = 'Incorrect password.';
                            passwordInput.classList.add('error');
                            break;
                        case 'auth/invalid-email':
                            errorMsg = 'Invalid email address.';
                            emailInput.classList.add('error');
                            break;
                        case 'auth/too-many-requests':
                            errorMsg = 'Too many failed attempts. Please try again later.';
                            break;
                        case 'auth/invalid-credential':
                            errorMsg = 'Invalid email or password.';
                            break;
                    }
                    showToast(errorMsg, 'error');
                }
            });
        }
    }

    function initAuthGuard() {
        const authGuard = document.getElementById('authGuard');
        const adminLayout = document.getElementById('adminLayout');

        auth.onAuthStateChanged(user => {
            if (user) {
                // User is authenticated
                if (authGuard) authGuard.classList.remove('active');
                if (adminLayout) adminLayout.style.display = 'flex';

                // Set admin info in sidebar
                const adminName = document.getElementById('adminName');
                const adminAvatar = document.getElementById('adminAvatar');
                if (adminName) adminName.textContent = user.email.split('@')[0];
                if (adminAvatar) adminAvatar.textContent = user.email.charAt(0).toUpperCase();

                // Initialize dashboard if form-builder.js has the init function
                if (typeof initDashboard === 'function') {
                    initDashboard(user);
                }
            } else {
                // Not authenticated, redirect to login
                window.location.href = 'index.html';
            }
        });

        // Logout handlers
        const logoutBtn = document.getElementById('logoutBtn');
        const logoutBtnMobile = document.getElementById('logoutBtnMobile');

        const handleLogout = async () => {
            try {
                await auth.signOut();
                showToast('Logged out successfully', 'info');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } catch (error) {
                showToast('Error logging out', 'error');
            }
        };

        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', handleLogout);

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');

        if (menuToggle && sidebar) {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);

            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    /**
     * Helper: Set button loading state
     */
    function setButtonLoading(btn, loading) {
        if (!btn) return;
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        
        if (loading) {
            btn.disabled = true;
            if (btnText) btnText.classList.add('hidden');
            if (btnLoader) btnLoader.classList.remove('hidden');
        } else {
            btn.disabled = false;
            if (btnText) btnText.classList.remove('hidden');
            if (btnLoader) btnLoader.classList.add('hidden');
        }
    }

    // Export helper
    window.setButtonLoading = setButtonLoading;

})();

console.log('🔐 FormVault Auth module loaded');
