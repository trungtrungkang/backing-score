"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { account, ID } from "@/lib/appwrite";
import { Models, OAuthProvider } from "appwrite";

type User = Models.User<Models.Preferences>;

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithOAuth: (provider: "google") => void;
  sendVerification: () => Promise<void>;
  updateProfile: (name: string, prefs?: Record<string, any>) => Promise<void>;
  getJWT: () => Promise<string>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await account.createEmailPasswordSession({ email, password });
        await loadSession();
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : "Login failed";
        setError(msg);
        throw e;
      }
    },
    [loadSession]
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      setError(null);
      try {
        await account.create({
          userId: ID.unique(),
          email,
          password,
          name: name || undefined,
        });
        await account.createEmailPasswordSession({ email, password });
        try {
          const locale = window.location.pathname.split("/").filter(Boolean).find(p => ["en","vi","zh-CN","zh-TW","es","fr","de","ja","ko"].includes(p)) ?? "en";
          await account.createVerification(`${window.location.origin}/${locale}/verify`);
        } catch (vErr) {
          console.error("Failed to send verification email:", vErr);
        }
        await loadSession();
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : "Sign up failed";
        setError(msg);
        throw e;
      }
    },
    [loadSession]
  );

  const loginWithOAuth = useCallback((provider: "google" | "apple") => {
    // Extract current locale from pathname (e.g. /en, /vi, /zh-CN)
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const supportedLocales = ["en", "vi", "zh-CN", "zh-TW", "es", "fr", "de", "ja", "ko"];
    const locale = supportedLocales.includes(pathParts[0]) ? pathParts[0] : "en";
    const successUrl = `${window.location.origin}/${locale}/dashboard`;
    const failureUrl = `${window.location.origin}/${locale}/login?error=oauth_failed`;
    const oAuthProvider = provider === "google" ? OAuthProvider.Google : OAuthProvider.Apple;
    
    // Redirects browser completely
    account.createOAuth2Session(oAuthProvider, successUrl, failureUrl);
  }, []);

  const sendVerification = useCallback(async () => {
    setError(null);
    try {
      const locale = window.location.pathname.split("/").filter(Boolean).find(p => ["en","vi","zh-CN","zh-TW","es","fr","de","ja","ko"].includes(p)) ?? "en";
      await account.createVerification(`${window.location.origin}/${locale}/verify`);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to send verification email";
      setError(msg);
      throw e;
    }
  }, []);

  const getJWT = useCallback(async () => {
    try {
      const res = await account.createJWT();
      return res.jwt;
    } catch (e: any) {
      throw new Error(e?.message || "Failed to generate JWT");
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await account.deleteSession("current");
      setUser(null);
    } catch {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (name: string, prefs?: Record<string, any>) => {
    try {
      if (name) {
         await account.updateName(name);
      }
      if (prefs) {
         await account.updatePrefs(prefs);
      }
      await loadSession();
    } catch (e: any) {
      throw new Error(e?.message || "Failed to update profile");
    }
  }, [loadSession]);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    login,
    signup,
    loginWithOAuth,
    sendVerification,
    updateProfile,
    getJWT,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
