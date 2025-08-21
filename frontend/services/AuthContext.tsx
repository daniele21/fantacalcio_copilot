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
  ai_credits: number; // <-- Add ai_credits
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
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_CLIENT_ID_CONST = '294925298549-35bq5mf2inki7nsuqiljrkv7g6ajfsbq.apps.googleusercontent.com';
const BASE_URL = import.meta.env.VITE_API_URL;

const featureMap: Record<UserProfile['plan'], string[]> = {
  free: ['liveAuction', 'strategyPrep', 'leagueAnalytics'],
  basic: ['liveAuction'],
  pro: ['liveAuction', 'strategyPrep'],
  enterprise: ['liveAuction', 'strategyPrep', 'leagueAnalytics'],
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGoogleAuthReady, setIsGoogleAuthReady] = useState<boolean>(false);
  // TOS acceptance flow
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  // Add a state to control when to show the TOS dialog
  const [showTosDialog, setShowTosDialog] = useState<boolean>(false);

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
        sub: user.sub,
        ai_credits: typeof user.ai_credits === 'number' ? user.ai_credits : 0 // <-- Add ai_credits
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

  // Modified handleCredentialResponse for TOS flow
  const handleCredentialResponse = useCallback((response: any) => {
    const token = response.credential;
    if (!token) {
      console.error('[AuthContext] No credential received from Google');
      return;
    }
    setPendingToken(token); // Wait for TOS acceptance
  }, []);

  // TOS Dialog component
  const TosDialog: React.FC<{ token: string; onAccept: () => void }> = ({ token, onAccept }) => {
    const [acceptTos, setAcceptTos] = useState(false);
    const [acceptVex, setAcceptVex] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const confirm = async () => {
      if (!(acceptTos && acceptVex)) return;
      setLoading(true);
      setError(null);
      try {
        await fetch(`${BASE_URL}/api/accept-tos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ version: "1.0" })
        });
        onAccept();
      } catch (e) {
        setError("Errore di rete. Riprova.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-base-100 p-8 rounded-xl w-full max-w-lg">
          <h2 className="text-xl font-bold mb-4">Benvenuto!</h2>
          <label className="flex items-start gap-2 mb-3">
            <input type="checkbox" checked={acceptTos} onChange={e => setAcceptTos(e.target.checked)} />
            <span>
              Ho letto e accetto <a href="/terms" target="_blank" className="underline">Termini &amp; Condizioni</a> e
              <a href="/privacy" target="_blank" className="underline"> Privacy Policy</a>.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acceptVex} onChange={e => setAcceptVex(e.target.checked)} />
            <span>
              Ai sensi degli artt. 1341‑1342 c.c. approvo espressamente le clausole 3, 4, 5, 6, 9, 10.
            </span>
          </label>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          <button
            className={`btn w-full mt-4 font-semibold transition-all duration-150 ${!(acceptTos && acceptVex) || loading ? 'btn-disabled bg-base-300 text-content-200 cursor-not-allowed' : 'btn-primary hover:scale-105'}`}
            disabled={!(acceptTos && acceptVex) || loading}
            onClick={confirm}
            aria-disabled={!(acceptTos && acceptVex) || loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                Attendi...
              </span>
            ) : (
              <span className={!(acceptTos && acceptVex) ? 'opacity-60' : ''}>Continua</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  // After TOS accepted, complete login
  useEffect(() => {
    if (pendingToken && !tosAccepted) {
      (async () => {
        try {
          const resp = await fetch(`${BASE_URL}/api/me`, {
            headers: { Authorization: `Bearer ${pendingToken}` }
          });
          if (!resp.ok) {
            setPendingToken(null);
            setShowTosDialog(false);
            alert('Login non riuscito. Il token Google non è valido o la sessione è scaduta.');
            return;
          }
          const data = await resp.json();
          const user = data.data || {};
          if (user.tos_accepted) {
            setTosAccepted(true);
            localStorage.setItem('idToken', pendingToken);
            setIdToken(pendingToken);
            await loadProfile(pendingToken);
            setPendingToken(null);
            setShowTosDialog(false);
          } else if (user.email) {
            setShowTosDialog(true);
          } else {
            setPendingToken(null);
            setShowTosDialog(false);
            alert('Login non riuscito. L’utente non esiste o non è stato creato.');
          }
        } catch (e) {
          console.error('[Auth] /api/me failed', e);
          setPendingToken(null);
          setShowTosDialog(false);
          alert('Problema di rete/CORS durante il login. Riprova.');
        }
      })();
    }
    if (tosAccepted && pendingToken) {
      localStorage.setItem('idToken', pendingToken);
      setIdToken(pendingToken);
      loadProfile(pendingToken);
      setPendingToken(null);
      setShowTosDialog(false);
    }
  }, [pendingToken, tosAccepted, loadProfile]);

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
            ux_mode: 'popup',
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
        setProfile, // <-- Expose setProfile
      }}
    >
      {showTosDialog && pendingToken && !tosAccepted && (
        <TosDialog token={pendingToken} onAccept={() => setTosAccepted(true)} />
      )}
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
