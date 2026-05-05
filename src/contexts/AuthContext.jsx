import { createContext, useContext, useEffect, useState } from 'react';
import { auth, onIdTokenChanged } from '../lib/firebase';
import { setAuthToken } from '../firestore-rest';
import { doc, getDoc } from '../firestore-rest';
import { db } from '../firestore-rest';

// Retry getDoc up to 6 times with 300ms delay — guards against race condition
// where onIdTokenChanged reads the profile before EmailAuthScreen's setDoc completes.
async function loadProfile(uid) {
  for (let i = 0; i < 6; i++) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    if (i < 5) await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // firebaseUser: Firebase Auth user object (or null)
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = still loading
  // profile: Firestore users/{uid} document data (or null)
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // onIdTokenChanged fires on: sign-in, sign-out, and token refresh (every ~1h).
    // This ensures _authToken in firestore-rest.js is always fresh.
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setAuthToken(token);
        // Load Firestore profile (with retry to handle registration race condition)
        try {
          const profile = await loadProfile(fbUser.uid);
          setProfile(profile);
        } catch (e) {
          console.error('[AuthContext] failed to load profile:', e);
          setProfile(null);
        }
        setFirebaseUser(fbUser);
      } else {
        setAuthToken(null);
        setFirebaseUser(null);
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const loading = firebaseUser === undefined;

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
