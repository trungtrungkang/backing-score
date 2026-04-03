"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { betterAuthClient } from "@/lib/auth/better-auth-client";

interface User {
  $id: string; // Maintain $id for backward compatibility
  id: string;
  email: string;
  name: string;
  prefs: Record<string, any>;
  [key: string]: any;
}

export type ServiceTier = "free" | "pro" | "studio";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  serviceTier: ServiceTier;
  subscriptionStatus: string | null;
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
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceTier, setServiceTier] = useState<ServiceTier>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  const checkSubscription = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/subscription?userId=${userId}`);
      if (res.ok) {
        const data = ((await res.json()) as any) as any;
        const apiTier = data.tier || (data.isPremium ? "pro" : "free");
        
        if (["pro", "studio"].includes(apiTier)) {
           setServiceTier(apiTier as ServiceTier);
        } else {
           setServiceTier("free");
        }
        
        setSubscriptionStatus(data.status || null);
      } else {
        setServiceTier("free");
        setSubscriptionStatus(null);
      }
    } catch {
      setServiceTier("free");
      setSubscriptionStatus(null);
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const { data: baSession } = await betterAuthClient.getSession();
      
      if (baSession?.user) {
         let labelsArray: string[] = [];
         try {
           const rawLabels = (baSession.user as any).labels;
           if (typeof rawLabels === 'string') {
             labelsArray = JSON.parse(rawLabels);
           } else if (Array.isArray(rawLabels)) {
             labelsArray = rawLabels;
           }
         } catch (err) {
           labelsArray = [];
         }

         const customUser: User = {
           $id: baSession.user.id,
           id: baSession.user.id,
           email: baSession.user.email,
           name: baSession.user.name,
           labels: labelsArray,
           prefs: {
             avatarUrl: (baSession.user as any).image || null,
             displayName: baSession.user.name,
           },
         };
         setUser(customUser);
         await checkSubscription(customUser.$id);
      } else {
         setUser(null);
         setServiceTier("free");
         setSubscriptionStatus(null);
      }
    } catch (e) {
      setUser(null);
      setServiceTier("free");
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, [checkSubscription]);

  const refreshSubscription = useCallback(async () => {
    if (user) await checkSubscription(user.$id);
  }, [user, checkSubscription]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const { error: baError } = await betterAuthClient.signIn.email({ email, password });
        if (baError) throw new Error(baError.message);
        await loadSession();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Login failed";
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
        const { error: baError } = await betterAuthClient.signUp.email({ email, password, name });
        if (baError) throw new Error(baError.message);
        
        try {
          // Gửi email xác thực nếu cấu hình
          // await betterAuthClient.sendVerificationEmail({ email });
        } catch (vErr) {
          console.error("Failed to send verification email:", vErr);
        }
        await loadSession();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Sign up failed";
        setError(msg);
        throw e;
      }
    },
    [loadSession]
  );

  const loginWithOAuth = useCallback(async (provider: "google") => {
    try {
        await betterAuthClient.signIn.social({ 
            provider: "google",
            callbackURL: window.location.origin + "/dashboard" 
        });
    } catch (e: any) {
        setError(e?.message || "OAuth login failed");
    }
  }, []);

  const sendVerification = useCallback(async () => {
    // Implement based on Better Auth plugin if verification is needed
    // await betterAuthClient.sendVerificationEmail({ email: user?.email! });
  }, []);

  const getJWT = useCallback(async () => {
    // Chặn luồng JWT của Appwrite.
    // Đối với BetterAuth hiện tại, Token Session lưu trong Cookie Server.
    return "";
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await betterAuthClient.signOut();
      setUser(null);
      setServiceTier("free");
      setSubscriptionStatus(null);
    } catch {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (name: string, prefs?: Record<string, any>) => {
    try {
      const { error: baError } = await betterAuthClient.updateUser({ 
        name,
        ...(prefs?.avatarUrl ? { image: prefs.avatarUrl } : {})
      });
      if (baError) throw new Error(baError.message);
      
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
    serviceTier,
    subscriptionStatus,
    login,
    signup,
    loginWithOAuth,
    sendVerification,
    updateProfile,
    getJWT,
    logout,
    clearError,
    refreshSubscription,
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
