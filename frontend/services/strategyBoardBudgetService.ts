import { callApi } from './api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

export interface RoleBudget {
  role_budget_gk: number;
  role_budget_def: number;
  role_budget_mid: number;
  role_budget_fwd: number;
}

export const getStrategyBoardBudget = async (token: string) => {
  const resp = await callApi<{ data: { strategy_board: RoleBudget|null } }>(
    BASE_URL + '/api/strategy-board-budget',
    { method: 'GET' },
    token
  );
  return resp.data.strategy_board;
};

export const saveStrategyBoardBudget = async (token: string, budget: RoleBudget) => {
  await callApi(
    BASE_URL + '/api/strategy-board-budget',
    {
      method: 'POST',
      body: JSON.stringify(budget)
    },
    token
  );
};
