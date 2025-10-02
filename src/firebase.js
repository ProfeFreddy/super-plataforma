import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyC6uvGu9_9kNx1vInNy7X2ny2JPkE4M-YU",
  authDomain: "pragma-2c5d1.firebaseapp.com",
  projectId: "pragma-2c5d1",
  storageBucket: "pragma-2c5d1.firebasestorage.app",
  messagingSenderId: "203232076035",
  appId: "1:203232076035:web:1ed2a449ba619ac30b8936",
  measurementId: "G-348TG6WKLE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
