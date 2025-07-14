import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="py-10 text-center text-content-200 text-sm bg-base-100 border-t border-base-200 mt-10">
      <div className="flex flex-col md:flex-row items-center justify-center gap-4">
        <span>
          © {new Date().getFullYear()} FantaCopilot · Tutti i diritti riservati
        </span>
        <span className="hidden md:inline">|</span>
        <div className="flex gap-3">
          <Link to="/privacy" className="hover:underline">Privacy & Cookie Policy</Link>
          <span className="hidden md:inline">|</span>
          <Link to="/terms" className="hover:underline">Termini e Condizioni</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
