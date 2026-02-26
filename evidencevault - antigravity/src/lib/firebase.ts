import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCiOhFFvwOkwyGOUdes1dk7uXQM5FKFD4g",
  authDomain: "evidence-vault-67dba.firebaseapp.com",
  projectId: "evidence-vault-67dba",
  storageBucket: "evidence-vault-67dba.firebasestorage.app",
  messagingSenderId: "690889771649",
  appId: "1:690889771649:web:e89fa657224838d1105b80",
  measurementId: "G-0XGLRQST6Y"
};

let app: any = null;
let auth: any = null;
let storage: any = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
  // db = getFirestore(app);
} catch (error: any) {
  console.warn('Firebase initialization error:', error.message);
  // Firebase will be unavailable, but app won't crash
}

export { app, auth, storage };
