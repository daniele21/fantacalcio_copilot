import { Player } from '../types';

const BASE_URL = 'http://localhost:5000';

/**
 * Recupera l'elenco completo dei giocatori dalla API Flask.
 * Mappa i dati al nuovo tipo Player.
 * @returns Una Promise che si risolve con un array di oggetti Player.
 */
export const fetchPlayers = async (): Promise<Player[]> => {
  const res = await fetch(`${BASE_URL}/api/giocatori`);
  const data = await res.json();
  if (!Array.isArray(data.giocatori)) return [];
  console.log('Loaded players from API:', data.giocatori);
  return data.giocatori.map((p: any): Player => ({
    id: p.id,
    name: p.nome
      ? p.nome.split(' ').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
      : '',
    team: p.squadra,
    role: p.ruolo,
    price: Number(p.quota_attuale),
    skills: Array.isArray(p.skills)
      ? p.skills
      : typeof p.skills === 'string'
        ? p.skills.split(',').map((s: string) => s.trim())
        : [],
    score: Number(p.punteggio),
    recommendation: Number(p.recommendation),
    stats: {
      fm1y: parseFloat(p['fantamedia_2024_2025']),
      fm2y: parseFloat(p['fantamedia_2023_2024']),
      fm3y: parseFloat(p['fantamedia_2022_2023']),
      presenze1y: parseInt(p['presenze 2024_2025']),
      injury_score: parseInt(p['eesistenza_infortuni']),
      exp_assist: p['assist_previsti'],
      exp_goal: p['gol_previsti'],
      exp_presenze: p['presenze_previste'],
      good_bet: parseInt(p['buon_investimento'])
    }
  }));
};
