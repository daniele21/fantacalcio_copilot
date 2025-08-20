import React from 'react';

interface NumberStepperProps {
  value: number | '';
  onChange: (newValue: number | '') => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  leftLabel?: React.ReactNode;
  rightLabel?: React.ReactNode;
  ariaLabelDecrement?: string;
  ariaLabelIncrement?: string;
  disabled?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  inputClassName = '',
  leftLabel,
  rightLabel,
  ariaLabelDecrement = 'Diminuisci',
  ariaLabelIncrement = 'Aumenta',
  disabled = false,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange('');
    } else if (/^-?\d+$/.test(val)) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        onChange(Math.max(min, Math.min(max, num)));
      }
    }
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      onChange(min);
    }
  };
  return (
    <div className={`flex items-center bg-base-300 rounded-md ${className}`}>
      {leftLabel}
      <button
        type="button"
        aria-label={ariaLabelDecrement}
        className="px-1 text-content-200 hover:text-brand-primary focus:outline-none"
        onClick={() => onChange(Math.max(min, value - step))}
        tabIndex={-1}
        disabled={disabled || value <= min}
      >
        <span className="text-lg select-none">−</span>
      </button>
      <input
        type="text"
        value={value === '' ? '' : String(value)}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className={`w-12 sm:w-16 bg-transparent text-center font-bold text-content-100 p-1 focus:outline-none text-xs sm:text-base ${inputClassName}`}
        min={min}
        max={max}
        disabled={disabled}
        style={{ minWidth: '48px' }}
        inputMode="numeric"
        pattern="[0-9]*"
        step={step}
        autoComplete="off"
      />
      <style jsx>{`
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type='number'] {
          -moz-appearance: textfield;
        }
      `}</style>
      <button
        type="button"
        aria-label={ariaLabelIncrement}
        className="px-1 text-content-200 hover:text-brand-primary focus:outline-none"
        onClick={() => onChange(Math.min(max, value + step))}
        tabIndex={-1}
        disabled={disabled || value >= max}
      >
        <span className="text-lg select-none">+</span>
      </button>
      {rightLabel}
    </div>
  );
};
