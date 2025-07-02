import { callApi } from './api';
import { TargetPlayer } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

export const getStrategyBoard = async (token: string) => {
  const resp = await callApi<{ data: { strategy_board: any } }>(
    BASE_URL + '/api/strategy-board',
    { method: 'GET' },
    token
  );
  return resp.data.strategy_board;
};

export const saveStrategyBoard = async (token: string, targetPlayers: TargetPlayer[]) => {
  await callApi(
    BASE_URL + '/api/strategy-board',
    {
      method: 'POST',
      body: JSON.stringify({ target_players: targetPlayers })
    },
    token
  );
};
