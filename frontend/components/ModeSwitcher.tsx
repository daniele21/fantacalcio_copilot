

import React from 'react';
import { AppMode } from '../types';
import { BookOpen, Zap } from 'lucide-react';

interface ModeSwitcherProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ currentMode, onModeChange }) => {
  const baseClasses = 'flex items-center justify-center w-full px-4 py-3 font-semibold text-base rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary';
  
  const getButtonClasses = (mode: AppMode) => {
    return currentMode === mode
      ? 'bg-brand-primary text-white shadow-lg'
      : 'bg-base-200 text-content-200 hover:bg-base-300/80';
  };

  return (
    <div className="p-2 bg-base-200 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-2">
      <button
        onClick={() => onModeChange('preparation')}
        className={`${baseClasses} ${getButtonClasses('preparation')}`}
      >
        <BookOpen className="w-5 h-5 mr-2" />
        Preparazione
      </button>
      <button
        onClick={() => onModeChange('live_auction')}
        className={`${baseClasses} ${getButtonClasses('live_auction')}`}
      >
        <Zap className="w-5 h-5 mr-2" />
        Asta Live
      </button>
    </div>
  );
};