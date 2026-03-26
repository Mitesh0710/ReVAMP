// src/context/AuthProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_CONFIG, AuthService } from "../lib/auth";

export interface AuthUser {
  email?: string;
  email_verified?: boolean;
  created_at?: string;
  last_login?: string;
  display_name?: string;
  github_login?: string;
}

interface AuthContextType {
  // ── New interface ──────────────────────────────────
  user: AuthUser | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  refreshUser: () => Promise<void>;

  // ── Legacy interface (hooks/useAuth compat) ────────
  // Kept so every component using isAuthenticated / session / emailHint
  // continues to work without any changes.
  isAuthenticated: boolean;
  session: string | null;
  emailHint: string;
  startGitHubAuth: () => void;
  verifyCode: (code: string) => Promise<any>;
  checkAuthStatus: (sessionToken: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Simple client-side email masking */
function maskEmail(email: string | undefined | null) {
  if (!email) return "****@****";
  try {
    const [name, domain] = email.split("@");
    const shortName =
      name.length <= 1 ? "*" : name[0] + "*".repeat(Math.min(3, name.length - 1));
    const domainParts = domain.split(".");
    const tld = domainParts.pop();
    const domainHead = domainParts.join(".");
    const shortDomainHead =
      domainHead.length <= 1
        ? "*"
        : domainHead[0] + "*".repeat(Math.min(3, domainHead.length - 1));
    return `${shortName}@${shortDomainHead}.${tld ?? "com"}`;
  } catch {
    return "****@****";
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Legacy state — backward compat with components using isAuthenticated/session/emailHint
  const [session, setSession] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState("");

  const refreshIntervalRef = useRef<number | null>(null);
  const isLoggingOut = useRef<boolean>(false);
  const hasRedirected = useRef<boolean>(false);
  // Guard: ensures the init effect truly runs only once,
  // even under React StrictMode double-invocation or Vite HMR.
  const initializationDone = useRef<boolean>(false);

  // useNavigate instead of window.location.href — prevents full page reloads
  const navigate = useNavigate();

  // ─────────────────────────────────────────
  // Token helpers
  // ─────────────────────────────────────────
  const getAccessToken = useCallback((): string | null => {
    const localToken = localStorage.getItem("access_token");
    if (localToken) return localToken;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "access_token") {
        localStorage.setItem("access_token", value);
        return value;
      }
    }
    return null;
  }, []);

  const getRefreshToken = useCallback((): string | null => {
    const localToken = localStorage.getItem("refresh_token");
    if (localToken) return localToken;

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "refresh_token") {
        localStorage.setItem("refresh_token", value);
        return value;
      }
    }
    return null;
  }, []);

  // ─────────────────────────────────────────
  // Load user from /auth/me
  // ─────────────────────────────────────────
  const loadUser = useCallback(async (accessToken: string | null, isRefresh = false, awaitEnrichment = false) => {
    if (!accessToken) {
      if (!isRefresh) setUser(null);
      return false;
    }
    try {
      const resp = await fetch(`${AUTH_CONFIG.API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Failed to fetch user");

      const data = await resp.json();
      setUser(data);
      setEmailHint(maskEmail(data.email));
      localStorage.setItem("auth_user", JSON.stringify(data));
      console.log("✅ User loaded successfully:", data.email);

      // Non-blocking GitHub enrichment
      const enrichPromise = fetch(`${AUTH_CONFIG.API_URL}/auth/user`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((ghData) => {
          if (ghData) {
            const enriched = {
              ...data,
              display_name: ghData.display_name,
              github_login: ghData.login,
            };
            setUser(enriched);
            localStorage.setItem("auth_user", JSON.stringify(enriched));
          }
        })
        .catch(() => {});
      if (awaitEnrichment) await enrichPromise;
      return true;
    } catch (err) {
      console.warn("⚠️ AuthProvider: loadUser failed", err);
      if (!isRefresh) setUser(null);
      localStorage.removeItem("auth_user");
      return false;
    }
  }, []);

  // ─────────────────────────────────────────
  // refreshUser — callable from any component
  // Re-fetches /auth/me + /api/github/user and updates context
  // ─────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const accessToken = getAccessToken();
    await loadUser(accessToken, true);
    try {
     const r = await fetch(`${AUTH_CONFIG.API_URL}/auth/user`, { credentials: "include" });
      if (r.ok) {
        const ghData = await r.json();
        setUser((prev: AuthUser | null) => {
          if (!prev) return prev;
            const enriched = { ...prev, display_name: ghData.display_name, github_login: ghData.login };
          localStorage.setItem("auth_user", JSON.stringify(enriched));
          return enriched;
        });
      }
    } catch {}
  }, [getAccessToken, loadUser]);

  // ─────────────────────────────────────────
  // Refresh loop
  // ─────────────────────────────────────────
  const stopRefreshLoop = useCallback(() => {
    if (refreshIntervalRef.current) {
      window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const performRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      console.log("🔄 Attempting to refresh token...");
      const data = await AuthService.refreshAccessToken(refreshToken);
      if (data && data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token)
          localStorage.setItem("refresh_token", data.refresh_token);
        await loadUser(data.access_token);
        console.log("✅ Token refreshed successfully");
        return true;
      }
      return false;
    } catch (err) {
      console.warn("⚠️ AuthProvider: token refresh failed", err);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      return false;
    }
  }, [getRefreshToken, loadUser]);

  const startRefreshLoop = useCallback(() => {
    stopRefreshLoop();
    const id = window.setInterval(() => {
      performRefresh().catch(() => {});
    }, 10 * 60 * 1000);
    refreshIntervalRef.current = id;
  }, [performRefresh, stopRefreshLoop]);

  // ─────────────────────────────────────────
  // OAuth URL token extraction
  // ─────────────────────────────────────────
  const checkUrlForTokens = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("access_token");
    const refreshToken = urlParams.get("refresh_token");

    if (accessToken && refreshToken) {
      console.log("🔐 Found OAuth tokens in URL");
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return { accessToken, refreshToken };
    }
    return null;
  }, []);

  // ─────────────────────────────────────────
  // Init effect — runs exactly once
  // ─────────────────────────────────────────
  useEffect(() => {
    if (initializationDone.current) return;
    initializationDone.current = true;

    (async () => {
      const justLoggedOut = sessionStorage.getItem("just_logged_out");
      sessionStorage.removeItem("just_logged_out"); // always clear flag first

     

    // Only skip auth if no URL tokens AND just logged out
      if (justLoggedOut === "true") {
        console.log("🚫 Just logged out - skipping all auth checks");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        setLoading(false);
        return;
      }

      if (isLoggingOut.current) {
        console.log("⏸️ Skipping auth check - logout in progress");
        setLoading(false);
        return;
      }

      try {
        console.log("🚀 AuthProvider initializing...");
        const currentPath = window.location.pathname;
        console.log("📍 Current path:", currentPath);

        // OAuth callback tokens in URL
        const urlTokens = checkUrlForTokens();
        if (urlTokens) {
          console.log("📝 Processing OAuth tokens from URL");
          const success = await loadUser(urlTokens.accessToken);
          if (success) {
            startRefreshLoop();
            if (!hasRedirected.current) {
              hasRedirected.current = true;
              console.log("↪️ Navigating to dashboard after OAuth");
              navigate("/dashboard", { replace: true });
            }
            return;
          }
        }

        const accessToken = getAccessToken();
        const refreshToken = getRefreshToken();

        console.log(
          "🔍 Token check - Access:",
          !!accessToken,
          "Refresh:",
          !!refreshToken
        );

        // Session endpoint (HttpOnly cookie path)
        try {
          console.log("🔍 Checking session endpoint...");
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch(`${AUTH_CONFIG.API_URL}/auth/session`, {
            credentials: "include",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          console.log("📡 Session response status:", resp.status);

          if (resp.ok) {
            const data = await resp.json();
            if (data.authenticated === true && data.user && data.user.email) {
              setUser(data.user);
              setEmailHint(maskEmail(data.user.email));
              localStorage.setItem("auth_user", JSON.stringify(data.user));

              if (data.tokens?.access_token)
                localStorage.setItem("access_token", data.tokens.access_token);
              if (data.tokens?.refresh_token)
                localStorage.setItem("refresh_token", data.tokens.refresh_token);

              if (
                (currentPath === "/" || currentPath === "/verify") &&
                !hasRedirected.current
              ) {
                hasRedirected.current = true;
                setTimeout(() => navigate("/dashboard", { replace: true }), 100);
                return;
              }

              if (refreshToken) startRefreshLoop();
              return;
            }
          }
        } catch (err) {
          console.log("ℹ️ Session check failed:", err);
        }

        // Access token path
        if (accessToken) {
          console.log("🔑 Found access token, loading user");
          const success = await loadUser(accessToken);
          if (success) {
            if (
              (currentPath === "/" || currentPath === "/verify") &&
              !hasRedirected.current
            ) {
              hasRedirected.current = true;
              navigate("/dashboard", { replace: true });
              return;
            }
            if (getRefreshToken()) startRefreshLoop();
          }
        } else if (refreshToken) {
          console.log("🔄 Found refresh token, attempting refresh");
          const refreshed = await performRefresh();
          if (refreshed && currentPath === "/" && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate("/dashboard", { replace: true });
            return;
          }
        }

        if (getRefreshToken()) startRefreshLoop();
      } finally {
        setLoading(false);
        console.log("✅ AuthProvider initialization complete");
      }
    })();

    return () => {
      stopRefreshLoop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────
  // checkAuthStatus — legacy compat
  // ─────────────────────────────────────────
  const checkAuthStatus = useCallback(
    async (sessionToken: string) => {
      try {
        const accessToken = getAccessToken();
        if (accessToken) {
          const success = await loadUser(accessToken);
          if (success) {
            setSession(sessionToken);
            localStorage.setItem("auth_session", sessionToken);
            return;
          }
        }
        const status = await AuthService.getAuthStatus(sessionToken);
        if (status.exists && status.verified) {
          setSession(sessionToken);
          setEmailHint(status.email_hint || "");
          localStorage.setItem("auth_session", sessionToken);
        } else {
          setSession(null);
          setEmailHint("");
          localStorage.removeItem("auth_session");
        }
      } catch (err) {
        console.error("checkAuthStatus failed:", err);
      }
    },
    [getAccessToken, loadUser]
  );

  // ─────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────
  const login = async (accessToken: string, refreshToken: string) => {
    try {
      console.log("🔐 Login initiated");
      isLoggingOut.current = false;
      hasRedirected.current = false;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      await loadUser(accessToken);
      startRefreshLoop();
      console.log("✅ Login successful");
    } catch (err) {
      console.error("❌ AuthProvider: login failed", err);
      throw err;
    }
  };

  // ─────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────
  const logout = async () => {
    console.log("🚪 Logout initiated");
    isLoggingOut.current = true;
    stopRefreshLoop();
    setUser(null);
    setSession(null);
    setEmailHint("");

    try {
      const accessToken =
        localStorage.getItem("access_token") || getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      await fetch(`${AUTH_CONFIG.API_URL}/auth/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      console.log("✅ Backend logout successful");
    } catch (err) {
      console.warn("⚠️ Backend logout failed:", err);
    }

    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("just_logged_out", "true");

    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name] = cookie.trim().split("=");
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    console.log("🔄 Navigating to home page");
    navigate("/", { replace: true });
  };

  // ─────────────────────────────────────────
  // Legacy compat helpers
  // ─────────────────────────────────────────
  const startGitHubAuth = useCallback(() => {
    AuthService.startGitHubAuth();
  }, []);

  const verifyCode = useCallback(
    async (code: string) => {
      if (!session) throw new Error("No active session");
      const result = await AuthService.verifyCode(session, code);
      if (result?.access_token) {
        localStorage.setItem("access_token", result.access_token);
        if (result.refresh_token)
          localStorage.setItem("refresh_token", result.refresh_token);
        await loadUser(result.access_token);
      }
      return result;
    },
    [session, loadUser]
  );

  // ─────────────────────────────────────────
  // Context value — exposes BOTH interfaces
  // ─────────────────────────────────────────
  return (
    <AuthContext.Provider
      value={{
        // New interface
        user,
        loading,
        login,
        logout,
        getAccessToken,
        refreshUser,
        // Legacy interface
        isAuthenticated: !!user,
        session,
        emailHint,
        startGitHubAuth,
        verifyCode,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default AuthProvider;