import React from 'react';

interface FilterChipProps {
  label: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, isActive, onClick }) => {
  const baseClasses = 'px-4 py-2 text-sm font-medium rounded-full cursor-pointer transition-all duration-200';
  const activeClasses = 'bg-brand-primary text-white shadow-md';
  const inactiveClasses = 'bg-base-100 text-content-200 hover:bg-base-300 hover:text-content-100';

  return (
    <button onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
      {label}
    </button>
  );
};
