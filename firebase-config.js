// Firebase Configuration
// Replace these values with your Firebase project configuration
// Get these from: Firebase Console > Project Settings > General > Your apps

const firebaseConfig = {
    apiKey: "AIzaSyDYGg6TgvpPYAuaVXnCN8cf0D8yxiiFF3c",
    authDomain: "partner-calculator-5f8c4.firebaseapp.com",
    projectId: "partner-calculator-5f8c4",
    storageBucket: "partner-calculator-5f8c4.firebasestorage.app",
    messagingSenderId: "343387383285",
    appId: "1:343387383285:web:94fb440341a9d704fcacbc"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
} else {
    console.error('Firebase SDK not loaded. Make sure firebase scripts are included in HTML.');
}
