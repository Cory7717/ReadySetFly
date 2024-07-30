import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCb1HOS7u-T8fLvzX1bQeLGTjxvDWsM9Cw",
  authDomain: "ready-set-fly-71506.firebaseapp.com",
  projectId: "ready-set-fly-71506",
  storageBucket: "ready-set-fly-71506.appspot.com",
  messageSenderId: "64600529166",
  appId: "1:64600529166:android:98d989ad25482d03895f5f",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
