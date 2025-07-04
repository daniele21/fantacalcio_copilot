import React, { createContext, useContext, useEffect, useState } from "react";

type Consent = "accepted" | "rejected" | "unset";
interface CookieCtx {
  consent: Consent;
  setConsent: (c: Consent) => void;
}

const CookieContext = createContext<CookieCtx>({ consent: "unset", setConsent: () => {} });
export const useCookie = () => useContext(CookieContext);

export const CookieProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<Consent>(() => {
    return (localStorage.getItem("fc-cookie-consent") as Consent) || "unset";
  });

  useEffect(() => {
    localStorage.setItem("fc-cookie-consent", consent);
    if (consent === "accepted") {
      // Carica analytics solo DOPO il consenso
      import("../services/loadAnalytics");
    }
  }, [consent]);

  return (
    <CookieContext.Provider value={{ consent, setConsent }}>
      {children}
    </CookieContext.Provider>
  );
};
