import { Player, Role } from '../types';
import { useApi } from './useApi';

// Helper to map backend role to frontend Role enum
const mapRole = (ruolo: string): Role => {
  switch (ruolo) {
    case 'POR': return Role.GK;
    case 'DIF': return Role.DEF;
    case 'CEN': return Role.MID;
    case 'ATT': return Role.FWD;
    default: return Role.GK;
  }
};

export function usePlayerApi() {
  const { call } = useApi();

  /**
   * Recupera l'elenco completo dei giocatori dalla API Flask.
   * Mappa i dati al nuovo tipo Player.
   * @returns Una Promise che si risolve con un array di oggetti Player.
   */
  const fetchPlayers = async (): Promise<Player[]> => {
    const data = await call<any>('/api/giocatori');
    // Fix: get giocatori from data.data.giocatori
    const giocatori = data?.data?.giocatori;
    // console.log('[playerService] Raw API response:', data);
    if (!Array.isArray(giocatori)) return [];
    const mapped = giocatori.map((p: any): Player => ({
      id: p.id,
      name: p.nome
        ? p.nome.split(' ').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
        : '',
      team: p.squadra,
      role: mapRole(p.ruolo),
      baseCost: Number(p.quota_attuale),
      skills: Array.isArray(p.skills)
        ? p.skills
        : typeof p.skills === 'string'
          ? p.skills.split(',').map((s: string) => s.trim())
          : [],
      recommendation: Number(p.recommendation ?? 0),
      analystCeiling: p.fanta_media_2024_2025 ?? p.fantamedia_2024_2025 ?? 0,
      analystFloor: p.fantamedia_2023_2024 ?? 0,
      priceTier: p.priceTier,
      stats: {
        fm1y: parseFloat(p['fantamedia_2023_2024'] ?? p['fanta_media_2024_2025'] ?? 0),
        fm2y: parseFloat(p['fantamedia_2022_2023'] ?? 0),
        presenze1y: parseInt(p['presenze_2024_2025'] ?? p['presenze'] ?? 0),
        injury_score: parseFloat(p['resistenza_infortuni'] ?? 0),
        injuries: p.injuries,
        yellowCards: p.yellowCards,
        redCards: p.redCards,
        exp_assist: p['assist_previsti'] ?? '-',
        exp_goal: p['gol_previsti'] ?? '-',
        exp_presenze: p['presenze_previste'] ?? '-',
        good_bet: p['buon_investimento'] ?? '-',
      }
    }));
    console.log('[playerService] Mapped players:', mapped);
    return mapped;
  };

  return { fetchPlayers };
}