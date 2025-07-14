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
}

interface PlanCardProps {
  plan: Plan;
  onSelect?: (planKey: string) => void;
  currentPlan?: string;
}

const planOrder: Record<string, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };

const PlanCard: React.FC<PlanCardProps> = ({ plan, onSelect, currentPlan }) => {
  const price = plan.price;
  const priceLabel = price === 0 ? "Gratis" : `€${price.toFixed(2)}`;
  const isCurrent = currentPlan && plan.key === currentPlan;
  const isDisabled = currentPlan && planOrder[plan.key] <= planOrder[currentPlan];

  return (
    <div
      className={clsx(
        "relative bg-base-200 p-8 rounded-2xl border border-base-300 w-full max-w-xs flex flex-col",
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
      <h3 className="text-2xl font-bold text-content-100">{plan.name}</h3>
      <p className="mt-4 text-5xl font-extrabold text-brand-primary">
        {priceLabel}
      </p>
      {price !== 0 && (
        <p className="text-content-200 text-sm">
          Pagamento una tantum
        </p>
      )}

      <ul className="mt-6 space-y-2 text-left flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start">
            <Check className="w-4 h-4 text-green-400 mt-1 mr-2" />
            <span>{f}</span>
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
        disabled={isDisabled}
      >
        {isCurrent ? "Attivo" : plan.cta}
      </button>
    </div>
  );
};

export default PlanCard;
