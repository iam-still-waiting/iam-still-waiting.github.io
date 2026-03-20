/**
 * FormVault — Firebase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use existing)
 * 3. Enable "Realtime Database" in Build menu
 * 4. Enable "Authentication" > "Email/Password" sign-in method
 * 5. Create an admin user in Authentication > Users
 * 6. Replace the config below with your project's config
 * 7. Set database rules (see below)
 * 
 * DATABASE RULES (paste in Firebase Console > Realtime Database > Rules):
 * {
 *   "rules": {
 *     "forms": {
 *       ".read": true,
 *       ".write": "auth != null"
 *     },
 *     "responses": {
 *       "$formId": {
 *         ".read": "auth != null",
 *         ".write": true
 *       }
 *     }
 *   }
 * }
 */

// ⚠️ Replace with YOUR Firebase config from Firebase Console > Project Settings > Web App
const firebaseConfig = {
    apiKey: "AIzaSyDNgtEC4PxTnS3kvYY6gpcNVa5o1xm8aus",
    authDomain: "form-38726.firebaseapp.com",
    databaseURL: "https://form-38726-default-rtdb.firebaseio.com",
    projectId: "form-38726",
    storageBucket: "form-38726.firebasestorage.app",
    messagingSenderId: "552886207901",
    appId: "1:552886207901:web:9bf0fab40bd7f0350b5b74"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to Firebase services
const db = firebase.database();
const auth = firebase.auth();

/**
 * Helper: Generate a unique ID
 */
function generateId() {
    return db.ref().push().key;
}

/**
 * Helper: Get current timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Toast notification system
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
        error: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
        info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <span class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">&times;</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

console.log('🔥 FormVault Firebase initialized');
