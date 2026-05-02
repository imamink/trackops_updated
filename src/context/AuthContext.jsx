import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigError, firebaseConfigReady } from "../firebase";

const AuthContext = createContext(null);

function normalizeSiteName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function resolveLoginEmail(identifier) {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    throw new Error("Enter your site username or email.");
  }

  if (trimmedIdentifier.includes("@")) {
    return trimmedIdentifier.toLowerCase();
  }

  const normalizedIdentifier = normalizeSiteName(trimmedIdentifier);
  const siteLoginRef = doc(db, "siteLogins", normalizedIdentifier);
  const siteLoginSnap = await getDoc(siteLoginRef);

  if (siteLoginSnap.exists()) {
    const matchedProfile = siteLoginSnap.data();
    if (matchedProfile.email) {
      return matchedProfile.email;
    }
  }

  throw new Error("We could not find a site account for that username.");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseConfigReady || !auth || !db) {
      setLoading(false);
      setError(firebaseConfigError);
      return () => {};
    }

    let unsubscribe = () => {};

    async function initializeAuth() {
      await setPersistence(auth, browserLocalPersistence);

      async function hydrateUser(firebaseUser, { refreshAuth = false, withLoading = true } = {}) {
        if (withLoading) {
          setLoading(true);
        }
        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          setIsVerified(false);
          if (withLoading) {
            setLoading(false);
          }
          return;
        }

        try {
          if (refreshAuth) {
            await reload(firebaseUser);
          }

          const currentUser = auth.currentUser || firebaseUser;
          const profileRef = doc(db, "users", firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);

          if (!profileSnap.exists()) {
            setUser(currentUser);
            setProfile(null);
            setIsVerified(Boolean(currentUser.emailVerified));
            setError("Your account profile could not be found. Contact an administrator.");
            return;
          }

          const nextProfile = { uid: firebaseUser.uid, ...profileSnap.data() };

          if (!nextProfile.active) {
            setUser(currentUser);
            setProfile(null);
            setIsVerified(Boolean(currentUser.emailVerified));
            setError("Your TrackOps account is inactive. Contact an administrator.");
            return;
          }

          setUser(currentUser);
          setProfile(nextProfile);
          setIsVerified(Boolean(currentUser.emailVerified));
        } catch (err) {
          setUser(firebaseUser);
          setProfile(null);
          setIsVerified(Boolean(firebaseUser.emailVerified));
          setError(err.message || "Unable to load your account profile.");
        } finally {
          if (withLoading) {
            setLoading(false);
          }
        }
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setError("");
        await hydrateUser(firebaseUser, { refreshAuth: true, withLoading: true });
      });

      const refreshFromBrowser = async () => {
        if (!auth.currentUser) return;
        await hydrateUser(auth.currentUser, { refreshAuth: true, withLoading: false });
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          refreshFromBrowser().catch(() => {});
        }
      };

      window.addEventListener("focus", handleVisibilityChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      const previousUnsubscribe = unsubscribe;
      unsubscribe = () => {
        window.removeEventListener("focus", handleVisibilityChange);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        previousUnsubscribe();
      };
    }

    initializeAuth().catch((err) => {
      setError(err.message || "Unable to initialize authentication.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      isVerified,
      async login(identifier, password) {
        if (!auth || !db) throw new Error(firebaseConfigError);
        setError("");
        const email = await resolveLoginEmail(identifier);
        return signInWithEmailAndPassword(auth, email, password);
      },
      async signUp({ siteName, email, password }) {
        if (!auth || !db) throw new Error(firebaseConfigError);
        setError("");
        const trimmedSiteName = siteName.trim();
        const trimmedEmail = email.trim().toLowerCase();
        const normalizedSiteName = normalizeSiteName(trimmedSiteName);

        if (!trimmedSiteName) {
          throw new Error("Enter a site username.");
        }

        const existingSiteLoginRef = doc(db, "siteLogins", normalizedSiteName);
        const existingSiteLoginSnap = await getDoc(existingSiteLoginRef);

        if (existingSiteLoginSnap.exists()) {
          throw new Error("That site username is already in use.");
        }

        const credentials = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await setDoc(doc(db, "users", credentials.user.uid), {
          name: trimmedSiteName,
          nameNormalized: normalizedSiteName,
          siteName: trimmedSiteName,
          siteNameNormalized: normalizedSiteName,
          email: trimmedEmail,
          accountType: "site",
          role: "site_leader",
          siteIds: [trimmedSiteName],
          active: true,
          createdAt: serverTimestamp(),
        });
        await setDoc(existingSiteLoginRef, {
          email: trimmedEmail,
          siteName: trimmedSiteName,
          siteNameNormalized: normalizedSiteName,
          uid: credentials.user.uid,
          createdAt: serverTimestamp(),
        });
        await sendEmailVerification(credentials.user);
        return credentials;
      },
      async logout() {
        if (!auth) return;
        return signOut(auth);
      },
      async resetPassword(email) {
        if (!auth) throw new Error(firebaseConfigError);
        return sendPasswordResetEmail(auth, email);
      },
      async sendVerification() {
        if (!auth) throw new Error(firebaseConfigError);
        if (!auth.currentUser) return;
        return sendEmailVerification(auth.currentUser);
      },
      async refreshVerification() {
        if (!auth) throw new Error(firebaseConfigError);
        if (!auth.currentUser) return false;
        await reload(auth.currentUser);
        const nextVerified = Boolean(auth.currentUser.emailVerified);
        setUser(auth.currentUser);
        setIsVerified(nextVerified);
        return nextVerified;
      },
    }),
    [user, profile, loading, error, isVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
