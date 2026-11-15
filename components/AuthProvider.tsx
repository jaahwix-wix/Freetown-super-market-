'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  testFirestoreConnection,
} from '@/lib/firebase';
import { OperationType, handleFirestoreError } from '@/lib/firestore-errors';
import type { UserProfile } from '@/lib/types';

const USERNAME_MAP_KEY = 'freetown_username_directory_v1';

export type AuthModalMode = 'signin' | 'register';
export type AuthModalContext = 'customer' | 'admin';

interface AuthContextValue {
  user: User | null;
  emailVerified: boolean;
  profile: UserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  authError: string | null;
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  authModalContext: AuthModalContext;
  openAuthModal: (context?: AuthModalContext, mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
  signInWithUsernamePassword: (identifier: string, password: string) => Promise<boolean>;
  registerWithUsernamePassword: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; needsVerification: boolean }>;
  sendPasswordReset: (identifier: string) => Promise<string | null>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshVerification: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  updateSavedDelivery: (data: {
    phone: string;
    defaultAddress: string;
    defaultZone: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUsernameMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USERNAME_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveUsernameMapping(username: string, email: string) {
  if (typeof window === 'undefined') return;
  const key = username.trim().toLowerCase();
  if (!key || !email.includes('@')) return;
  try {
    const map = loadUsernameMap();
    map[key] = email.trim();
    window.localStorage.setItem(USERNAME_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function resolveIdentifierToEmail(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === 'admin' || lower === 'administrator') {
    return BOOTSTRAPPED_ADMIN_EMAIL;
  }

  const saved = loadUsernameMap();
  if (saved[lower]) return saved[lower];
  return null;
}

function formatFirebaseAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Email/Password sign-in is not enabled yet in Firebase Console. Open Firebase Console -> Authentication -> Sign-in method -> Email/Password and enable it.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid username/email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In and enter your password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing.';
    default:
      return error instanceof Error
        ? error.message
        : 'Authentication failed. Please try again.';
  }
}

async function ensureUserProfileDoc(firebaseUser: User): Promise<void> {
  if (!firebaseUser.emailVerified) return;
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newProfile = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Freetown Shopper',
        email: firebaseUser.email || '',
        role: 'customer' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
    }
  } catch (err) {
    console.error('Profile sync notice:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authTick, setAuthTick] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('signin');
  const [authModalContext, setAuthModalContext] = useState<AuthModalContext>('customer');

  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);
      if (!firebaseUser) {
        setProfile(null);
        setIsAdminDoc(false);
        setAuthReady(true);
        return;
      }

      if (firebaseUser.displayName && firebaseUser.email) {
        saveUsernameMapping(firebaseUser.displayName, firebaseUser.email);
      }

      await ensureUserProfileDoc(firebaseUser);

      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        setIsAdminDoc(adminSnap.exists());
      } catch {
        setIsAdminDoc(false);
      }

      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    const path = `users/${user.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return () => unsubscribe();
  }, [authReady, user, authTick]);

  const openAuthModal = useCallback(
    (context: AuthModalContext = 'customer', mode: AuthModalMode = 'signin') => {
      setAuthError(null);
      setAuthModalContext(context);
      setAuthModalMode(mode);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signInWithUsernamePassword = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      setAuthError(null);
      const resolvedEmail = resolveIdentifierToEmail(identifier);
      if (!resolvedEmail) {
        setAuthError(
          'Username not saved on this browser yet. Enter your registered email address and password once to sign in.'
        );
        return false;
      }
      if (!password) {
        setAuthError('Please enter your password.');
        return false;
      }

      try {
        const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password);
        if (!identifier.includes('@')) {
          saveUsernameMapping(identifier, resolvedEmail);
        } else if (cred.user.displayName) {
          saveUsernameMapping(cred.user.displayName, resolvedEmail);
        }
        setAuthModalOpen(false);
        return true;
      } catch (error) {
        setAuthError(formatFirebaseAuthError(error));
        return false;
      }
    },
    []
  );

  const registerWithUsernamePassword = useCallback(
    async (
      username: string,
      email: string,
      password: string
    ): Promise<{ ok: boolean; needsVerification: boolean }> => {
      setAuthError(null);
      const cleanUsername = username.trim().slice(0, 100);
      const cleanEmail = email.trim();

      if (cleanUsername.length < 2) {
        setAuthError('Username must be at least 2 characters.');
        return { ok: false, needsVerification: false };
      }
      if (!cleanEmail.includes('@')) {
        setAuthError('Please enter a valid email address.');
        return { ok: false, needsVerification: false };
      }
      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        return { ok: false, needsVerification: false };
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: cleanUsername });
        saveUsernameMapping(cleanUsername, cleanEmail);

        try {
          await sendEmailVerification(cred.user);
        } catch (verifyErr) {
          console.error('Verification email dispatch notice:', verifyErr);
        }

        setAuthTick((t) => t + 1);
        return { ok: true, needsVerification: !cred.user.emailVerified };
      } catch (error) {
        setAuthError(formatFirebaseAuthError(error));
        return { ok: false, needsVerification: false };
      }
    },
    []
  );

  const sendPasswordReset = useCallback(
    async (identifier: string): Promise<string | null> => {
      setAuthError(null);
      const resolvedEmail = resolveIdentifierToEmail(identifier);
      if (!resolvedEmail) {
        setAuthError('Enter your registered email address (or admin) to send a password reset link.');
        return null;
      }
      try {
        await sendPasswordResetEmail(auth, resolvedEmail);
        return resolvedEmail;
      } catch (error) {
        setAuthError(formatFirebaseAuthError(error));
        return null;
      }
    },
    []
  );

  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    if (!auth.currentUser) return false;
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    }
  }, []);

  const refreshVerification = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    if (!auth.currentUser) return false;
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const verified = Boolean(auth.currentUser.emailVerified);
      if (verified) {
        await ensureUserProfileDoc(auth.currentUser);
        try {
          const adminSnap = await getDoc(doc(db, 'admins', auth.currentUser.uid));
          setIsAdminDoc(adminSnap.exists());
        } catch {
          setIsAdminDoc(false);
        }
      }
      setUser(auth.currentUser);
      setAuthTick((t) => t + 1);
      return verified;
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
      return true;
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await firebaseSignOut(auth);
  }, []);

  const updateSavedDelivery = useCallback(
    async (data: { phone: string; defaultAddress: string; defaultZone: string }) => {
      if (!user) return;
      const path = `users/${user.uid}`;
      try {
        const ref = doc(db, 'users', user.uid);
        await setDoc(
          ref,
          {
            displayName: user.displayName || profile?.displayName || 'Freetown Shopper',
            phone: data.phone.slice(0, 30),
            defaultAddress: data.defaultAddress.slice(0, 240),
            defaultZone: data.defaultZone.slice(0, 80),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, profile]
  );

  // Include authTick read so React consumers re-evaluate after reload()
  const emailVerified = authTick >= 0 ? Boolean(user?.emailVerified) : false;
  const isBootstrappedAdmin = Boolean(
    emailVerified && user?.email === BOOTSTRAPPED_ADMIN_EMAIL
  );
  const isAdmin = isBootstrappedAdmin || (emailVerified && isAdminDoc);

  return (
    <AuthContext.Provider
      value={{
        user,
        emailVerified,
        profile,
        authReady,
        isAdmin,
        isBootstrappedAdmin,
        authError,
        authModalOpen,
        authModalMode,
        authModalContext,
        openAuthModal,
        closeAuthModal,
        clearAuthError,
        signInWithUsernamePassword,
        registerWithUsernamePassword,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerification,
        signInWithGoogle,
        signOut,
        updateSavedDelivery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
