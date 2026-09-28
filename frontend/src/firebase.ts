import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config is safe to expose publicly - it identifies the
// project, it does not authorize anything by itself. Access control is
// enforced by Firestore Security Rules (see firestore.rules), not by
// hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyAgSonWzuz1ZwejQlhLEdw4VSES1yc59NI",
  authDomain: "gram-8739e.firebaseapp.com",
  projectId: "gram-8739e",
  storageBucket: "gram-8739e.firebasestorage.app",
  messagingSenderId: "886856871186",
  appId: "1:886856871186:web:a8fd8e1764ff2e288e17cb",
};

export const firebaseConfigured = firebaseConfig.apiKey !== "REPLACE_ME";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
