import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { User as FirebaseAuthUser } from "firebase/auth";
import { DataError, loginUser, logoutUser, subscribeUser, touchLastSeen, watchAuth } from "../data/firestore-api";
import { User } from "../types";
import { enforceFreeTier } from "../utils/prefs";

interface AuthContextValue {
  user: User | null;
  uid: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof DataError) return e.message;
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Невірний email або пароль";
    case "auth/email-already-in-use":
      return "Ця пошта вже зареєстрована";
    case "auth/weak-password":
      return "Пароль — мінімум 6 символів";
    case "auth/invalid-email":
      return "Некоректний email";
    default:
      return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchAuth((fbUser: FirebaseAuthUser | null) => {
      setUid(fbUser ? fbUser.uid : null);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // "Last seen": ping while the app is open and visible
  useEffect(() => {
    if (!uid) return;
    const ping = () => {
      if (document.visibilityState === "visible") touchLastSeen(uid);
    };
    ping();
    const timer = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeUser(uid, (u) => {
      if (u && !u.isPremium) enforceFreeTier();
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await loginUser(email, password);
    } catch (e) {
      setError(errMsg(e, "Помилка входу"));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  const value = useMemo(
    () => ({ user, uid, loading, error, login, logout }),
    [user, uid, loading, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
