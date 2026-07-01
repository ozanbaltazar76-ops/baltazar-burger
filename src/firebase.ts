import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase config loaded from environment variables (never hardcoded)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const FALLBACK_DATABASE_ID = 'ai-studio-086b32c0-cc2f-4e3d-8c80-67844f7cc369';
const envDbId = (import.meta.env.VITE_FIREBASE_DATABASE_ID as string || '').trim();

// Use the env var if it looks like a valid Firestore database ID, otherwise use fallback
const databaseId = (envDbId && 
                    envDbId !== '' && 
                    envDbId !== '(default)' && 
                    envDbId !== 'undefined' && 
                    envDbId !== 'null' &&
                    !envDbId.startsWith('http'))
  ? envDbId 
  : FALLBACK_DATABASE_ID;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

console.log('[Firebase] Connecting to database:', databaseId);

// Always connect to the named database
export const db = getFirestore(app, databaseId);

export const storage = getStorage(app);
