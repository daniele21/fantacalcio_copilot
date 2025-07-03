import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

interface UserProfile {
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  sub: string; // Add google_sub to profile
}

interface AuthContextType {
  idToken: string | null;
  profile: UserProfile | null;
  isLoggedIn: boolean;
  isGoogleAuthReady: boolean;
  handleSignOut: () => void;
  GOOGLE_CLIENT_ID: string;
  hasFeature: (featureKey: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_CLIENT_ID_CONST = '294925298549-35bq5mf2inki7nsuqiljrkv7g6ajfsbq.apps.googleusercontent.com';
const BASE_URL = import.meta.env.VITE_API_URL;

const featureMap: Record<UserProfile['plan'], string[]> = {
  free: [],
  basic: ['liveAuction'],
  pro: ['liveAuction', 'strategyPrep'],
  enterprise: ['liveAuction', 'strategyPrep', 'leagueAnalytics'],
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGoogleAuthReady, setIsGoogleAuthReady] = useState<boolean>(false);

  // Move handleSignOut above loadProfile to fix closure order
  const handleSignOut = useCallback(() => {
    setIdToken(null);
    setProfile(null);
    localStorage.removeItem('idToken');
  }, []);

  // Fetch user profile (including plan) from backend
  const loadProfile = useCallback(async (token: string) => {
    try {
      const resp = await fetch(`${BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        let errorData;
        try {
          errorData = await resp.json();
        } catch {
          errorData = {};
        }
        if (errorData && errorData.error === "Invalid Google ID token") {
          alert("La sessione è scaduta o il login non è più valido. Effettua nuovamente l'accesso con Google.");
          handleSignOut();
          return;
        }
        throw new Error('Failed to fetch profile');
      }
      const data = await resp.json();
      const user = data.data || {};
      setProfile({
        email: user.email,
        name: user.name || user.email,
        picture: user.picture,
        plan: user.plan,
        sub: user.sub
      });
    } catch (err) {
      throw err;
    }
  }, [handleSignOut]);

  // Expose refreshProfile for components to trigger a profile reload
  const refreshProfile = useCallback(async () => {
    if (!idToken) return;
    await loadProfile(idToken);
  }, [idToken, loadProfile]);

  // Feature check based on plan
  const hasFeature = useCallback((feature: string) => {
    return profile != null && featureMap[profile.plan]?.includes(feature);
  }, [profile]);

  const handleCredentialResponse = useCallback((response: any) => {
    // console.log('[AuthContext] Google credential response:', response);
    const token = response.credential;
    if (!token) {
      console.error('[AuthContext] No credential received from Google');
      return;
    }
    localStorage.setItem('idToken', token);
    setIdToken(token);
    let decoded: any;
    try {
      decoded = jwtDecode(token);
      // console.log('[AuthContext] Decoded Google ID token:', decoded);
    } catch {
      // console.error('[AuthContext] Invalid ID token');
      return;
    }
    loadProfile(token).catch(err => {
      console.error('[AuthContext] Could not load user profile:', err);
      setProfile({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        given_name: decoded.given_name,
        family_name: decoded.family_name,
        plan: 'free',
        sub: decoded.sub // fallback to sub from token
      });
    });
  }, [loadProfile]);

  useEffect(() => {
    const storedToken = localStorage.getItem('idToken');
    if (!storedToken) {
      setIdToken(null);
      setProfile(null);
    } else {
      setIdToken(storedToken);
      loadProfile(storedToken).catch(() => setProfile(null));
    }

    const initializeGoogleSignIn = () => {
      if (typeof window.google !== 'undefined' && window.google.accounts?.id) {
        // Use only the hardcoded GOOGLE_CLIENT_ID_CONST for now to avoid TS/JS env issues
        const clientId = GOOGLE_CLIENT_ID_CONST;
        if (!clientId) {
          console.error('[AuthContext] Google client_id is missing. Set REACT_APP_GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID in your .env file.');
          setIsGoogleAuthReady(false);
          return false;
        }
        console.log('[AuthContext] Initializing Google Sign-In with Client ID:', clientId);
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });
          setIsGoogleAuthReady(true); // GSI initialized successfully
          console.log('[AuthContext] Google Sign-In initialized successfully.');
        } catch (initError) {
          console.error('[AuthContext] Error during google.accounts.id.initialize:', initError);
          setIsGoogleAuthReady(false); // GSI initialization failed
        }
      } else {
        console.warn('[AuthContext] Google Identity Services script not ready yet or google.accounts.id not available. Will retry.');
        return false; // Indicate not ready
      }
      return true; // Indicate ready
    };

    if (!isGoogleAuthReady) {
      if (initializeGoogleSignIn()) {
        // Already initialized
      } else {
        // Poll for the GSI script if not immediately available
        let attempts = 0;
        const intervalId = setInterval(() => {
          attempts++;
          console.log(`[AuthContext] Polling for Google GSI script (attempt ${attempts})...`);
          if (initializeGoogleSignIn()) {
            clearInterval(intervalId);
          } else if (attempts >= 10) { // Stop after 10 attempts (e.g., 5 seconds)
            clearInterval(intervalId);
            console.error("[AuthContext] Failed to initialize Google Sign-In after multiple attempts. GSI script might be blocked or not loaded.");
            setIsGoogleAuthReady(false); // Explicitly set to false on failure
          }
        }, 500); // Check every 500ms

        return () => clearInterval(intervalId); // Cleanup interval on unmount
      }
    }

    // Listen for profile:refresh event to reload profile after payment
    const refreshHandler = () => {
      if (idToken) {
        loadProfile(idToken).catch(() => setProfile(null));
      }
    };
    window.addEventListener('profile:refresh', refreshHandler);
    // ─── SILENT REFRESH ───────────────────────────────────────────────
    // Decode exp, schedule a silent re-prompt 5 minutes before it
    let refreshTimer: number | undefined;
    if (idToken && window.google?.accounts?.id) {
      try {
        const { exp } = jwtDecode(idToken) as { exp: number };
        // ms until 5 minutes before expiry
        const msUntilRefresh = exp * 1000 - Date.now() - 5 * 60 * 1000;
        if (msUntilRefresh > 0) {
          refreshTimer = window.setTimeout(() => {
            // silent prompt for a new ID token
            window.google.accounts.id.prompt();
          }, msUntilRefresh);
        }
      } catch (e) {
        console.warn('[AuthContext] Could not schedule token refresh:', e);
      }
    }
    return () => {
      window.removeEventListener('profile:refresh', refreshHandler);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [idToken, isGoogleAuthReady, loadProfile]); // Removed handleCredentialResponse from dependencies

  return (
    <AuthContext.Provider
      value={{
        idToken,
        profile,
        isLoggedIn: !!idToken && !!profile,
        isGoogleAuthReady,
        handleSignOut,
        GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID_CONST,
        hasFeature,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
