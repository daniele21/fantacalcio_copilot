import React from "react";

export const PoweredByGeminiBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
    <span
        className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7F5AF0] to-[#00C7FF] px-5 py-2 text-base font-semibold text-white shadow-lg shadow-fuchsia-800/40 transition-transform hover:scale-105 hover:animate-pulse tracking-wide ${className}`}
        style={{ fontWeight: 600, fontSize: 18 }}
        title="Powered by Gemini AI"
    >
        {/* Gemini spark icon */}
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M12 2.5a9.5 9.5 0 1 1-9.5 9.5A9.5 9.5 0 0 1 12 2.5zM8 12l4 4 4-4-4-4z" />
        </svg>
        <span className="ml-2">Powered&nbsp;by&nbsp;Gemini&nbsp;AI</span>
    </span>
);
