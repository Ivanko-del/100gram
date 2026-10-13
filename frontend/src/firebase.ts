import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

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

/** Firestore with a persistent IndexedDB cache (works across tabs): chats
 * open offline from cache and messages sent offline are queued and flushed
 * on reconnect. Where IndexedDB is unavailable (some private modes, old
 * browsers) - or Firestore was already initialised (HMR) - fall back to the
 * default instance so the app still starts. */
function createDb(): Firestore {
  try {
    if (typeof indexedDB === "undefined") return getFirestore(app);
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = createDb();
