import { Player, Role, Skill } from './types';

export const ROLES_ORDER: Role[] = [Role.GK, Role.DEF, Role.MID, Role.FWD];
export const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'POR', [Role.DEF]: 'DIF', [Role.MID]: 'CEN', [Role.FWD]: 'ATT' };


export const MOCK_PLAYERS: Player[] = [
  // Example GK
  {
    id: 1,
    name: 'Sommer',
    team: 'Inter',
    role: Role.GK,
    price: 25,
    recommendation: 5,
    skills: [Skill.Titolare, Skill.BuonaMedia],
    score: 90,
    stats: {
      fm1y: 6.2,
      fm2y: 6.1,
      fm3y: 6.0,
      presenze1y: 38,
      injury_score: 1,
      exp_assist: '0',
      exp_goal: '0',
      exp_presenze: '38',
      good_bet: 1
    }
  },
  // Example DEF
  {
    id: 2,
    name: 'Bastoni',
    team: 'Inter',
    role: Role.DEF,
    price: 20,
    recommendation: 5,
    skills: [Skill.Titolare, Skill.Goleador],
    score: 85,
    stats: {
      fm1y: 6.3,
      fm2y: 6.2,
      fm3y: 6.1,
      presenze1y: 34,
      injury_score: 2,
      exp_assist: '4',
      exp_goal: '3',
      exp_presenze: '34',
      good_bet: 1
    }
  },
  // Example MID
  {
    id: 3,
    name: 'Koopmeiners',
    team: 'Atalanta',
    role: Role.MID,
    price: 45,
    recommendation: 5,
    skills: [Skill.Titolare, Skill.Rigorista, Skill.Goleador],
    score: 92,
    stats: {
      fm1y: 7.0,
      fm2y: 6.8,
      fm3y: 6.7,
      presenze1y: 36,
      injury_score: 1,
      exp_assist: '5',
      exp_goal: '12',
      exp_presenze: '36',
      good_bet: 1
    }
  },
  // Example FWD
  {
    id: 4,
    name: 'Lautaro Martínez',
    team: 'Inter',
    role: Role.FWD,
    price: 100,
    recommendation: 5,
    skills: [Skill.Titolare, Skill.Goleador],
    score: 98,
    stats: {
      fm1y: 8.5,
      fm2y: 8.2,
      fm3y: 8.0,
      presenze1y: 37,
      injury_score: 1,
      exp_assist: '4',
      exp_goal: '24',
      exp_presenze: '37',
      good_bet: 1
    }
  }
];
