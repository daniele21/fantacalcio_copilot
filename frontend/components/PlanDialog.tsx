import React from "react";
import { ShieldCheck } from "lucide-react";

interface PlanDialogProps {
  plan: {
    name: string;
    price: number;
    features: string[];
    recommended?: boolean;
    cta: string;
  };
  onClose: () => void;
  onConfirm: () => void;
}

const PlanDialog: React.FC<PlanDialogProps> = ({ plan, onClose, onConfirm }) => {
  const price = plan.price;
  const aiCredits = plan.features.find(f => f.toLowerCase().includes("crediti ai")) || "-";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full p-8 relative border-2 border-brand-primary/30 animate-fade-in">
        <button
          className="absolute top-3 right-3 text-content-200 hover:text-brand-primary text-2xl font-bold transition-colors"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ×
        </button>
        <div className="flex flex-col items-center mb-6">
          <ShieldCheck className="w-12 h-12 text-brand-primary mb-2" />
          <h2 className="text-2xl font-extrabold mb-1 text-center text-brand-primary">Conferma il tuo acquisto</h2>
          <p className="text-content-200 text-center text-sm">Rivedi i dettagli prima di procedere al pagamento.</p>
        </div>
        <div className="bg-base-200 rounded-xl p-4 mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Piano</span>
            <span className="font-bold text-brand-primary text-lg">{plan.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Prezzo</span>
            <span className="font-bold text-lg">{price === 0 ? "Gratis" : `€${price.toFixed(2)} IVA inclusa`}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Crediti AI</span>
            <span className="font-bold text-green-600">{aiCredits}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Durata</span>
            <span className="font-bold">Fino a dicembre 2025</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Rinnovo</span>
            <span className="font-bold text-orange-500">Nessun rinnovo automatico</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-content-100">Pagamento</span>
            <span className="font-bold">Una tantum</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 mb-4 text-sm text-content-200 text-center">
          <a href="/terms" target="_blank" className="underline hover:text-brand-primary transition-colors">Termini &amp; Condizioni</a>
          <a href="/privacy" target="_blank" className="underline hover:text-brand-primary transition-colors">Privacy Policy</a>
        </div>
        <button
          className="btn btn-primary w-full mt-2 py-3 text-lg font-bold shadow-lg hover:scale-105 transition-transform"
          onClick={onConfirm}
        >
          Conferma e paga
        </button>
      </div>
    </div>
  );
};

export default PlanDialog;
