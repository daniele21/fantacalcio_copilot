import React from "react";

export const AIGenerativeBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md border border-white/20 ${className}`}
    title="Questa funzione utilizza AI generativa"
  >
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="inline-block align-middle" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#fff" fillOpacity="0.15" stroke="#fff" strokeWidth="1.5"/>
      <path d="M10 5.5c1.5 0 2.5 1.2 2.5 2.5 0 1.2-1 2.5-2.5 2.5S7.5 9.2 7.5 8c0-1.3 1-2.5 2.5-2.5zm0 6c2.5 0 4.5 1.2 4.5 2.5V15H5v-1c0-1.3 2-2.5 5-2.5z" fill="#fff"/>
      <circle cx="15.5" cy="4.5" r="2.5" fill="#a78bfa" fillOpacity="0.8"/>
    </svg>
    AI generativa
  </span>
);
