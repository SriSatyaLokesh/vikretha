/**
 * firebase-init.js
 * Initializes Firebase and enables Firestore offline persistence.
 * Import { auth, db } from this module — never call initializeApp elsewhere.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { FIREBASE_CONFIG } from '../shop.config.js';

const app = initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence — queues writes in IndexedDB when offline
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only available in one tab at a time
    console.warn('[Vikretha] Firestore offline persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB (very rare)
    console.warn('[Vikretha] Firestore offline persistence not supported in this browser');
  }
});

export { app };
