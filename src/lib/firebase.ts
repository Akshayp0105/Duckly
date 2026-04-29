import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/*
// Paste these rules in Firebase Console → Firestore → Rules:
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /shares/{code} {
//       allow read, write: if true;
//     }
//   }
// }
//
// Firebase Storage Rules:
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     match /shares/{allPaths=**} {
//       allow read, write: if true;
//     }
//   }
// }
*/

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
