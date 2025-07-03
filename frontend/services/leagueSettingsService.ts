import { LeagueSettings } from '../types';
import { callApi } from './api';

const BASE_URL = import.meta.env.VITE_API_URL;

export const fetchLeagueSettings = async (token?: string) => {
  const resp = await callApi<{ data: { settings: LeagueSettings } }>(
    BASE_URL + '/api/league-settings',
    { method: 'GET' },
    token
  );
  return resp.data.settings;
};
