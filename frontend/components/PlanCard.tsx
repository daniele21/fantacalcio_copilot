import React from "react";
import { Check } from "lucide-react";
import clsx from "clsx";

export interface Plan {
  key: string;
  name: string;
  price: number;
  features: string[];
  recommended?: boolean;
  cta: string;
  originalPrice?: number; // Add optional originalPrice for discount
}

interface PlanCardProps {
  plan: Plan;
  onSelect?: (planKey: string) => void;
  currentPlan?: string;
}

const planOrder: Record<string, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };

const PlanCard: React.FC<PlanCardProps> = ({ plan, onSelect, currentPlan }) => {
  const price = plan.price;
  const hasDiscount = typeof plan.originalPrice === 'number' && plan.originalPrice > price;
  const priceLabel = price === 0 ? "Gratis" : `€${price.toFixed(2)}`;
  const originalPriceLabel = hasDiscount ? `€${plan.originalPrice!.toFixed(2)}` : null;
  const isCurrent = currentPlan && plan.key === currentPlan;
  const isDisabled = currentPlan && planOrder[plan.key] <= planOrder[currentPlan];

  return (
    <div
      className={clsx(
        "relative bg-base-200 p-4 xs:p-5 sm:p-8 rounded-2xl border w-full flex flex-col transition-shadow duration-200 hover:shadow-lg",
        plan.recommended && "ring-2 ring-brand-primary scale-105",
        isCurrent && "opacity-80"
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-xs font-semibold tracking-wide text-white px-3 py-1 rounded-full">
          Più scelto
        </span>
      )}
      {isCurrent && (
        <span className="absolute top-3 right-3 bg-base-300 text-xs font-semibold tracking-wide text-brand-primary px-2 py-1 rounded-full border border-brand-primary">
          Il tuo piano attuale
        </span>
      )}
  <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-content-100 text-center break-words leading-tight">{plan.name}</h3>
  <div className="relative mt-2 xs:mt-3 sm:mt-4 flex flex-col items-center justify-center min-h-[3.5rem]">
        {hasDiscount && originalPriceLabel && (
          <span className="relative inline-flex items-center px-3 py-1 mb-1 rounded-full bg-red-100 border border-red-300 text-red-600 text-2xl font-bold shadow-sm animate-fade-in old-price-slash">
            {originalPriceLabel}
            <span className="slash-diagonal" aria-hidden="true"></span>
          </span>
        )}
        <div className="flex items-end justify-center gap-2 flex-wrap">
          <span className="text-3xl xs:text-4xl sm:text-5xl font-extrabold text-brand-primary">{priceLabel}</span>
          {hasDiscount && (
            <span className="ml-2 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-300 animate-pop-in whitespace-nowrap">
              -{Math.round(100 - (price / plan.originalPrice!) * 100)}%
            </span>
          )}
        </div>
      </div>
      {hasDiscount && (
        <div className="flex items-center justify-center mt-2">
          <span className="inline-block px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-sm animate-fade-in">
            In offerta limitata fino al <strong>10 Agosto!</strong>
          </span>
        </div>
      )}
      {price !== 0 && (
        <p className="text-content-200 text-sm">
          Pagamento una tantum
        </p>
      )}

      <ul className="mt-4 xs:mt-5 sm:mt-6 space-y-2 text-left flex-1 min-w-0">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start text-xs xs:text-sm sm:text-sm gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 mr-1 flex-shrink-0" />
            <span className="break-words min-w-0">{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect && onSelect(plan.key)}
        className={clsx(
          "mt-8 w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 rounded-lg transition-colors",
          isDisabled && "opacity-50 cursor-not-allowed hover:bg-brand-primary"
        )}
        aria-label={`Abbonati al piano ${plan.name}`}
        disabled={!!isDisabled}
      >
        {isCurrent ? "Attivo" : plan.cta}
      </button>
      <style>{`
        .old-price-slash {
          position: relative;
          overflow: visible;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .old-price-slash .slash-diagonal {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 110%;
          height: 0;
          border-top: 3px solid #ef4444;
          transform: translate(-50%, -50%) rotate(-20deg);
          pointer-events: none;
          content: '';
        }
      `}</style>
    </div>
  );
};

export default PlanCard;
