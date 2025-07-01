
import { LeagueSettings, Role } from './types';

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  participants: 4,
  budget: 500,
  participantNames: [],
  roster: {
    [Role.GK]: 3,
    [Role.DEF]: 8,
    [Role.MID]: 8,
    [Role.FWD]: 6,
  },
  useCleanSheetBonus: true,
  useDefensiveModifier: true,
  leagueName: 'Lega degli Eroi',
};