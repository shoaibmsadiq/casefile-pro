// Scripts for firebase and firebase messaging (compat versions for service worker)
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// IMPORTANT: Replace with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyC93J87oWxUx6RMsOfs0Xs6CNwbwfMmmBQ",
    authDomain: "casefile-pro.firebaseapp.com",
    projectId: "casefile-pro",
    storageBucket: "casefile-pro.firebasestorage.app",
    messagingSenderId: "387776954987",
    appId: "1:387776954987:web:c1bc983a56efdc3539a72e",
    measurementId: "G-TXG9HN3S89"
  };

// Initialize the Firebase app in the service worker
// FIX: Use 'firebase.initializeApp()' which is the correct way for compat scripts
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg' // You can change this to your app's icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});