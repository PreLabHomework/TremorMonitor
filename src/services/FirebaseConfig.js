import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCO1338b0DzBHXxQK1qgOkUQ4-fnRuswEQ",
  authDomain: "tremormonitor.firebaseapp.com",
  projectId: "tremormonitor",
  storageBucket: "tremormonitor.firebasestorage.app",
  messagingSenderId: "819079378698",
  appId: "1:819079378698:web:04734ac515188924a46cf3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { app, db };