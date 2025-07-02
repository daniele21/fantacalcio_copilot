import React, { useState, useEffect } from 'react';
import { LeagueSettings, AppMode, Role } from '../types';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { Users, Coins, ShieldCheck, Play, Zap, Edit3, Plus, Minus, ChevronDown, ListTree, ClipboardEdit } from 'lucide-react';
import { useAuth } from '../services/AuthContext';

interface SetupWizardProps {
  onConfirm: (settings: Pick<LeagueSettings, 'participants' | 'budget' | 'participantNames' | 'roster' | 'useCleanSheetBonus' | 'useDefensiveModifier'>, mode: AppMode) => void;
  initialSettings: Pick<LeagueSettings, 'participants' | 'budget' | 'participantNames' | 'roster' | 'useCleanSheetBonus' | 'useDefensiveModifier'>;
}

const BASE_URL = "http://127.0.0.1:5000";

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  summary?: string;
}> = ({ title, icon, isExpanded, onToggle, children, summary }) => (
  <div className="border border-base-300 rounded-lg">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 text-left hover:bg-base-300/30 transition-colors"
    >
      <div className="flex items-center text-lg font-semibold text-content-100">
        {icon}
        <span className="ml-3">{title}</span>
      </div>
      <div className="flex items-center">
        {!isExpanded && summary && <span className="text-sm text-content-200 mr-3">{summary}</span>}
        <ChevronDown className={`w-5 h-5 text-content-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </div>
    </button>
    {isExpanded && (
      <div className="p-4 border-t border-base-300">
        {children}
      </div>
    )}
  </div>
);


export const SetupWizard: React.FC<SetupWizardProps> = ({ onConfirm, initialSettings }) => {
  const { idToken } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [participants, setParticipants] = useState<number>(initialSettings.participants);
  const [budget, setBudget] = useState<number | ''>(initialSettings.budget);
  const [roster, setRoster] = useState<typeof initialSettings.roster>(initialSettings.roster);
  const [participantNames, setParticipantNames] = useState<string[]>(() => {
    const num = initialSettings.participants;
    const names = initialSettings.participantNames;
    const initial = Array.from({ length: num }, (_, i) => names[i] || (i === 0 ? 'Io' : `Partecipante ${i + 1}`));
    if (initial[0] !== 'Io') initial[0] = 'Io';
    return initial;
  });
  const [useCleanSheetBonus, setUseCleanSheetBonus] = useState<boolean>(initialSettings.useCleanSheetBonus);
  const [useDefensiveModifier, setUseDefensiveModifier] = useState<boolean>(initialSettings.useDefensiveModifier);
  const [namesAreValid, setNamesAreValid] = useState(true);

  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  useEffect(() => {
    // This effect runs when the user changes the number of participants
    setParticipantNames(currentNames => {
        const newNames = Array.from({ length: participants }, (_, i) => {
            if (i === 0) return 'Io';
            return currentNames[i] || `Partecipante ${i + 1}`;
        });
        return newNames;
    });
  }, [participants]);

  const handleParticipantsChange = (delta: number) => {
    setParticipants(prev => {
        const newValue = prev + delta;
        if (newValue >= 2 && newValue <= 20) {
            return newValue;
        }
        return prev;
    });
  };
  
  const handleNameChange = (index: number, newName: string) => {
      const updatedNames = [...participantNames];
      updatedNames[index] = newName;
      setParticipantNames(updatedNames);
  };
  
  const handleRosterChange = (role: Role, delta: number) => {
    setRoster(prev => {
        const newValue = (prev[role] || 0) + delta;
        if (newValue >= 0 && newValue <= 15) { // Sensible limits
            return { ...prev, [role]: newValue };
        }
        return prev;
    });
  };

  const totalRosterSize = Object.values(roster).reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    const lowerCaseNames = participantNames.map(name => name.toLowerCase().trim());
    const uniqueNames = new Set(lowerCaseNames);
    const hasEmptyName = participantNames.some(name => name.trim() === '');
    
    setNamesAreValid(!hasEmptyName && uniqueNames.size === participantNames.length);
  }, [participantNames]);

  const isFormValid = participants >= 2 && typeof budget === 'number' && budget > 0 && namesAreValid && totalRosterSize > 0;

  const handleSubmit = async (mode: AppMode) => {
    if (!isFormValid) return;
    const settings = {
      participants,
      budget: budget as number,
      participantNames: participantNames.map(n => n.trim()),
      roster,
      useCleanSheetBonus,
      useDefensiveModifier,
    };
    try {
      await fetch(`${BASE_URL}/api/save-league-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(settings),
      });
    } catch (e) {
      // Optionally show error to user
    }
    onConfirm(settings, mode);
  };

  const ToggleSwitch: React.FC<{
      label: string;
      enabled: boolean;
      onChange: (enabled: boolean) => void;
      description: string;
  }> = ({ label, enabled, onChange, description }) => (
      <div className="flex items-center justify-between bg-base-100 p-3 rounded-lg">
          <div>
            <label className="font-semibold text-content-100">{label}</label>
            <p className="text-sm text-content-200">{description}</p>
          </div>
          <button
              type="button"
              onClick={() => onChange(!enabled)}
              className={`${enabled ? 'bg-brand-primary' : 'bg-base-300'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-base-200`}
              aria-pressed={enabled}
          >
              <span
                  className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
          </button>
      </div>
  );

  useEffect(() => {
    // Load saved league settings if any
    async function fetchSettings() {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/league-settings`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        const data = await res.json();
        if (data.settings) {
          setParticipants(data.settings.participants);
          setBudget(data.settings.budget);
          setRoster(data.settings.roster);
          setParticipantNames(data.settings.participantNames);
          setUseCleanSheetBonus(data.settings.useCleanSheetBonus);
          setUseDefensiveModifier(data.settings.useDefensiveModifier);
        }
      } catch (e) {
        // ignore, fallback to initialSettings
      } finally {
        setLoading(false);
      }
    }
    if (idToken) fetchSettings();
    else setLoading(false);
  }, [idToken]);

  if (loading) return <div className="flex items-center justify-center h-96 text-lg">Caricamento impostazioni...</div>;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-base-200 w-full max-w-2xl rounded-2xl shadow-2xl border border-base-300/50 p-6 md:p-8 transform transition-all animate-fade-in-up max-h-[90vh] flex flex-col">
        <div className="flex flex-col items-center text-center">
          <ShieldCheck className="w-16 h-16 text-brand-primary mb-4" />
          <h2 className="text-3xl font-bold text-content-100">Benvenuto in Fantacalcio Copilot</h2>
          <p className="text-content-200 mt-2 max-w-md">Imposta i parametri base della tua lega per iniziare.</p>
        </div>
        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => e.preventDefault()} className="mt-8 space-y-4 flex-grow overflow-y-auto pr-2">
          <div>
            <label htmlFor="budget" className="flex items-center text-sm font-medium text-content-200 mb-2">
              <Coins className="w-4 h-4 mr-2" />Crediti per Squadra
            </label>
            <input
              type="number"
              id="budget"
              value={budget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                if (val === '') {
                  setBudget('');
                } else {
                  const num = parseInt(val, 10);
                  if (!isNaN(num)) {
                    setBudget(Math.max(0, num));
                  }
                }
              }}
              className="w-full bg-base-100 border border-base-300 rounded-lg px-4 py-2 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
              required
            />
          </div>
          <CollapsibleSection
            title="Partecipanti"
            icon={<Users className="w-5 h-5 text-brand-primary" />}
            isExpanded={isParticipantsExpanded}
            onToggle={() => setIsParticipantsExpanded((p: boolean) => !p)}
            summary={`${participants} Partecipanti`}
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-content-200 mb-2 block">
                  Numero Partecipanti
                </label>
                <div className="flex items-center justify-between gap-2 bg-base-100 border border-base-300 rounded-lg p-1 max-w-xs">
                  <button
                    type="button"
                    onClick={() => handleParticipantsChange(-1)}
                    disabled={participants <= 2}
                    className="p-2 rounded-md text-content-200 hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Diminuisci numero di partecipanti"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-xl font-bold text-brand-primary w-12 text-center select-none">{participants}</span>
                  <button
                    type="button"
                    onClick={() => handleParticipantsChange(1)}
                    disabled={participants >= 20}
                    className="p-2 rounded-md text-content-200 hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Aumenta numero di partecipanti"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t border-base-300">
                <label className="text-sm font-medium text-content-200 mb-2 flex items-center">
                  <Edit3 className="w-4 h-4 mr-2" />Nomi dei Partecipanti
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                  {participantNames.map((name: string, index: number) => (
                    <div key={index}>
                      <label htmlFor={`p_name_${index}`} className="text-sm font-medium text-content-200 mb-1 block">
                        {index === 0 ? 'Tu' : `Partecipante ${index + 1}`}
                      </label>
                      <input
                        type="text"
                        id={`p_name_${index}`}
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(index, e.target.value)}
                        className="w-full bg-base-100 border border-base-300 rounded-lg px-3 py-2 text-content-100 focus:ring-2 focus:ring-brand-primary"
                        disabled={index === 0}
                      />
                    </div>
                  ))}
                </div>
                {!namesAreValid && <p className="text-red-400 text-sm mt-3">Assicurati che tutti i nomi siano inseriti e che non ci siano duplicati.</p>}
              </div>
            </div>
          </CollapsibleSection>
          <CollapsibleSection
            title="Composizione Rosa"
            icon={<ListTree className="w-5 h-5 text-brand-primary" />}
            isExpanded={isRosterExpanded}
            onToggle={() => setIsRosterExpanded((p: boolean) => !p)}
            summary={`${totalRosterSize} Giocatori (${roster.P}-${roster.D}-${roster.C}-${roster.A})`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROLES_ORDER.map(role => (
                <div key={role}>
                  <label className="text-sm font-medium text-content-200 mb-2 block">{ROLE_NAMES[role]}</label>
                  <div className="flex items-center justify-between gap-2 bg-base-100 border border-base-300 rounded-lg p-1">
                    <button type="button" onClick={() => handleRosterChange(role, -1)} disabled={roster[role] <= 0} className="p-2 rounded-md text-content-200 hover:bg-base-300 disabled:opacity-50 transition-colors">
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-xl font-bold text-brand-primary w-12 text-center select-none">{roster[role]}</span>
                    <button type="button" onClick={() => handleRosterChange(role, 1)} disabled={roster[role] >= 15} className="p-2 rounded-md text-content-200 hover:bg-base-300 disabled:opacity-50 transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-base-300/50 flex justify-between items-center">
              <span className="font-semibold text-content-200">Giocatori totali per squadra:</span>
              <span className="text-xl font-bold text-brand-primary">{totalRosterSize}</span>
            </div>
          </CollapsibleSection>
          <CollapsibleSection
            title="Regole Avanzate"
            icon={<ClipboardEdit className="w-5 h-5 text-brand-primary" />}
            isExpanded={isRulesExpanded}
            onToggle={() => setIsRulesExpanded((p: boolean) => !p)}
            summary={
              `${useCleanSheetBonus ? 'Porta Imbattuta' : ''}${useCleanSheetBonus && useDefensiveModifier ? ' • ' : ''}${useDefensiveModifier ? 'Mod. Difesa' : ''}`.trim() || 'Default'
            }
          >
            <div className="space-y-3">
              <ToggleSwitch
                label="Bonus Porta Imbattuta"
                description="Attiva il bonus per il portiere quando non subisce gol."
                enabled={useCleanSheetBonus}
                onChange={setUseCleanSheetBonus}
              />
              <ToggleSwitch
                label="Modificatore Difesa"
                description="Attiva il modificatore basato sui voti della difesa."
                enabled={useDefensiveModifier}
                onChange={setUseDefensiveModifier}
              />
            </div>
          </CollapsibleSection>
        </form>
        {/* Scelta Modalità */}
        <div className="mt-auto pt-6 border-t border-base-300">
          <h3 className="text-center font-semibold text-content-100 mb-4">Scegli la modalità e inizia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSubmit('preparation')}
              disabled={!isFormValid}
              className="group flex flex-col items-center text-center p-6 bg-base-300 rounded-lg border-2 border-transparent hover:border-brand-primary hover:bg-brand-primary/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-10 h-10 text-brand-primary mb-3 transition-transform group-hover:scale-110" />
              <h4 className="font-bold text-lg text-content-100">Preparazione Asta</h4>
              <p className="text-sm text-content-200">Analizza giocatori e crea la tua strategia prima dell'asta.</p>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('live_auction')}
              disabled={!isFormValid}
              className="group flex flex-col items-center text-center p-6 bg-base-300 rounded-lg border-2 border-transparent hover:border-brand-primary hover:bg-brand-primary/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-10 h-10 text-brand-primary mb-3 transition-transform group-hover:scale-110" />
              <h4 className="font-bold text-lg text-content-100">Assistente Live</h4>
              <p className="text-sm text-content-200">Ricevi suggerimenti in tempo reale durante l'asta.</p>
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.4s ease-out forwards;
          }
        `}</style>
      </div>
    </div>
  );
};