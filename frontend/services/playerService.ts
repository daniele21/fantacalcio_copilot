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

const BASE_URL = import.meta.env.VITE_API_URL;

export function usePlayerApi() {
  const { call } = useApi();

  /**
   * Recupera l'elenco completo dei giocatori dalla API Flask.
   * Mappa i dati al nuovo tipo Player.
   * @returns Una Promise che si risolve con un array di oggetti Player.
   */
  const fetchPlayers = async (): Promise<Player[]> => {
    const data = await call<any>(`${BASE_URL}/api/giocatori`);
    // Accept both {giocatori: [...]} and {data: {giocatori: [...]}}
    const giocatori = data?.giocatori || data?.data?.giocatori;
    // console.log('[playerService] Raw API response:', data);
    if (!Array.isArray(giocatori)) return [];
    const mapped = giocatori.map((p: any): Player => ({
      id: p.id,
      player_name: p.player_name || p.nome || '',
      current_team: p.current_team || p.squadra || p.team || '',
      stats_team: p.stats_team || '',
      current_team_id: p.current_team_id || null,
      stats_team_id: p.stats_team_id || null,
      position: mapRole(p.ruolo || p.position),
      position_id: p.position_id || null,
      season: p.season || null,
      season_id: p.season_id || null,
      birthday: p.birthday || '',
      stars: p.stars ?? null,
      skills: Array.isArray(p.skills)
        ? p.skills
        : typeof p.skills === 'string'
          ? p.skills.split(',').map((s: string) => s.trim())
          : [],
      baseCost: Number(p.price_expected ?? p.baseCost ?? 0),
      suggestedBidMin: Number(p.range_low ?? p.suggestedBidMin ?? 0),
      suggestedBidMax: Number(p.range_high ?? p.suggestedBidMax ?? 0),
      fvm: p.fvm ?? null,
      score: p.punteggio ?? null,
      recommendation: Number(p.fvm_recommendation ?? p.recommendation ?? 0),
      // Player card features for all roles
      goals_per_90: p.goals_per_90 ?? null,
      assists_per_90: p.assists_per_90 ?? null,
      big_chances_created_per_90: p.big_chances_created_per_90 ?? null,
      starting_rate: p.starting_rate ?? null,
      conversion_rate: p.conversion_rate ?? null,
      dribble_success_rate: p.dribble_success_rate ?? null,
      rating_average: p.rating_average ?? null,
      injury_risk: p.injury_risk ?? null,
      injury_risk_band: p.injury_risk_band ?? null,
      key_passes_per_90: p.key_passes_per_90 ?? null,
      def_actions_per_90: p.def_actions_per_90 ?? null,
      tackle_success_rate: p.tackle_success_rate ?? null,
      aerial_duels_win_rate: p.aerial_duels_win_rate ?? null,
      crosses_per_90: p.crosses_per_90 ?? null,
      clean_sheet_rate: p.clean_sheet_rate ?? null,
      save_success_rate: p.save_success_rate ?? null,
      saves_per_90: p.saves_per_90 ?? null,
      goals_conceded_per_90: p.goals_conceded_per_90 ?? null,
      pen_save_rate: p.pen_save_rate ?? null,
      // Add all new fantasy KPIs for PlayerCard
      gol_bonus: p.gol_bonus ?? null,
      assist_bonus: p.assist_bonus ?? null,
      titolarita: p.titolarita ?? null,
      malus_risk_raw: p.malus_risk_raw ?? null,
      xfp_per_game: p.xfp_per_game ?? null,
      clean_sheet_bonus: p.clean_sheet_bonus ?? null,
      pen_save_bonus: p.pen_save_bonus ?? null,
      penalties_saved: p.penalties_saved ?? null,
      big_chances_created_total: p.big_chances_created_total ?? null,
      stats: {
        fm1y: parseFloat(
          p['fantamedia_2024_2025'] && p['fantamedia_2024_2025'] !== '' ? p['fantamedia_2024_2025']
          : p['fantamedia_2023_2024'] && p['fantamedia_2023_2024'] !== '' ? p['fantamedia_2023_2024']
          : '0'
        ),
        fm2y: parseFloat(p['fantamedia_2022_2023'] ?? 0),
        fm3y: parseFloat(p['fantamedia_2021_2022'] ?? 0), // Add fm3y for PlayerStats type
        presenze1y: parseInt(p['presenze_2024_2025'] ?? p['presenze'] ?? 0),
        injury_score: parseFloat(p['resistenza_infortuni'] ?? 0) / 20,
        exp_assist: p['assist_previsti'] ?? '-',
        exp_goal: p['gol_previsti'] ?? '-',
        exp_presenze: p['presenze_previste'] ?? '-',
        good_bet: (p['buon_investimento'] ?? 0) / 20,
      }
    }));
    // console.log('[playerService] Mapped players:', mapped);
    return mapped;
  };

  return { fetchPlayers };
}