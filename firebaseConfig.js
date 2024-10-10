// firebaseConfig.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCb1HOS7u-T8fLvzX1bQeLGTjxvDWsM9Cw", // Remember to secure your API keys
  authDomain: "ready-set-fly-71506.firebaseapp.com",
  projectId: "ready-set-fly-71506",
  storageBucket: "ready-set-fly-71506.appspot.com",
  messagingSenderId: "64600529166",
  appId: "1:64600529166:android:98d989ad25482d03895f5f",
};

// Initialize Firebase only if it's not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with AsyncStorage Persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

export { app, db, storage, auth };
