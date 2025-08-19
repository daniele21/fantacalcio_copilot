import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="w-full z-50 bg-base-100 border-t border-base-200 text-content-200 text-xs xs:text-sm py-2 px-2 xs:px-4 flex flex-col xs:flex-row items-center justify-center gap-1 xs:gap-2 md:gap-4 shadow-none">
      <span>
        © {new Date().getFullYear()} FantaCopilot · Tutti i diritti riservati
      </span>
      <span className="hidden xs:inline">|</span>
      <Link to="/privacy" className="hover:underline">Privacy & Cookie Policy</Link>
      <span className="hidden xs:inline">|</span>
      <Link to="/terms" className="hover:underline">Termini e Condizioni</Link>
    </footer>
  );
};

export default Footer;
