import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 bg-base-100 border-t border-base-200 text-content-200 text-xs py-2 px-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 shadow-none">
      <span>
        © {new Date().getFullYear()} FantaCopilot · Tutti i diritti riservati
      </span>
      <span className="hidden md:inline">|</span>
      <Link to="/privacy" className="hover:underline">Privacy & Cookie Policy</Link>
      <span className="hidden md:inline">|</span>
      <Link to="/terms" className="hover:underline">Termini e Condizioni</Link>
    </footer>
  );
};

export default Footer;
