import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserLocal: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("stogram_token"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem("stogram_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/users/me");
      setUser(me);
    } catch {
      localStorage.removeItem("stogram_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setError(null);
    try {
      const res = await api.post<{ token: string; user: User }>("/auth/login", {
        usernameOrEmail,
        password,
      });
      localStorage.setItem("stogram_token", res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Помилка входу");
      throw e;
    }
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string, displayName: string) => {
      setError(null);
      try {
        const res = await api.post<{ token: string; user: User }>("/auth/register", {
          username,
          email,
          password,
          displayName,
        });
        localStorage.setItem("stogram_token", res.token);
        setToken(res.token);
        setUser(res.user);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Помилка реєстрації");
        throw e;
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("stogram_token");
    setToken(null);
    setUser(null);
  }, []);

  const updateUserLocal = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout, refreshUser, updateUserLocal }),
    [user, token, loading, error, login, register, logout, refreshUser, updateUserLocal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
