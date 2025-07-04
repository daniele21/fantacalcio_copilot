import { LeagueSettings } from '../types';
import { callApi } from './api';

const BASE_URL = import.meta.env.VITE_API_URL;

export const fetchLeagueSettings = async (token?: string) => {
  const resp = await callApi<{ data: { settings: LeagueSettings } }>(
    BASE_URL + '/api/league-settings',
    { method: 'GET' },
    token
  );
  const settings = resp.data.settings;
  if (!settings) return settings;
  // Map backend roster keys (P, D, C, A) to enum values (POR, DIF, CEN, ATT)
  const backendToEnum: Record<string, string> = { P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT' };
  const migratedRosterRaw = Object.fromEntries(
    Object.entries(settings.roster || {}).map(([k, v]) => [backendToEnum[k] || k, v])
  );
  const migratedRoster = {
    POR: migratedRosterRaw.POR ?? 0,
    DIF: migratedRosterRaw.DIF ?? 0,
    CEN: migratedRosterRaw.CEN ?? 0,
    ATT: migratedRosterRaw.ATT ?? 0,
  };
  return { ...settings, roster: migratedRoster };
};
