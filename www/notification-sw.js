importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyAgHagYm8NLE29aTBru2xGIqJfSYEXYV0w",
    authDomain: "mku-report.firebaseapp.com",
    projectId: "mku-report",
    storageBucket: "mku-report.firebasestorage.app",
    messagingSenderId: "926201748884",
    appId: "1:926201748884:web:5167ec52cbc8f587a10381"
});

const messaging = firebase.messaging();
