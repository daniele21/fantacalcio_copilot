import React from "react";

export const VerifiedGoogleSignInBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-blue-400 px-2.5 py-0.5 text-xs font-semibold text-white shadow-md border border-white/20 ${className}`}
    style={{ fontWeight: 600, fontSize: 13 }}
    title="Verified Google Sign-In: login rapido e sicuro, senza password salvate."
  >
    {/* Google checkmark icon */}
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 mr-1" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#fff" fillOpacity="0.18" stroke="#fff" strokeWidth="1.2"/>
      <path d="M7.5 10.5l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="10" r="9" stroke="#34A853" strokeWidth="1.2" fill="none"/>
    </svg>
    Verified Google Sign-In
  </span>
);
