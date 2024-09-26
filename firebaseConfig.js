import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCb1HOS7u-T8fLvzX1bQeLGTjxvDWsM9Cw",
  authDomain: "ready-set-fly-71506.firebaseapp.com",
  projectId: "ready-set-fly-71506",
  storageBucket: "ready-set-fly-71506.appspot.com",
  messagingSenderId: "64600529166",
  appId: "1:64600529166:android:98d989ad25482d03895f5f",
};

// Initialize Firebase only if it's not already initialized
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
